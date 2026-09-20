"""Главный детерминированный движок симуляции Terra Nova: Mercury.

Реализует пошаговую физику Меркурия, жизненный цикл агентов и сбор метрик.
Детерминированность обеспечивается отдельным генератором random.Random(seed).
"""

import hashlib
import json
import math
import random
from typing import Any, Dict, List, Optional, Set, Tuple

from .agent import Agent
from .environment import MercuryEnvironment, Zone
from .events import EventLogger, EventType
from .metrics import MetricsCollector, TickMetrics


class SimulationConfig:
    def __init__(
        self,
        seed: int = 42,
        width: int = 60,
        height: int = 30,
        initial_agents: int = 40,
        starting_energy: float = 100.0,
        base_metabolism: float = 1.0,
        penalty_hot: float = 3.0,
        penalty_cold: float = 3.0,
        penalty_terminator: float = 0.0,
        cycle_ticks: int = 200,
        terminator_width: int = 4,
        reproduction_threshold: float = 140.0,
        reproduction_cost: float = 50.0,
        require_partner: bool = True,
        max_ticks: Optional[int] = None,
        wind_penalty: float = 0.0,
        rocks_count: int = 0,
    ) -> None:
        self.seed = seed
        self.width = max(10, width)
        self.height = max(10, height)
        self.initial_agents = max(0, min(initial_agents, self.width * self.height))
        self.starting_energy = max(1.0, starting_energy)
        self.base_metabolism = max(0.0, base_metabolism)
        self.penalty_hot = max(0.0, penalty_hot)
        self.penalty_cold = max(0.0, penalty_cold)
        self.penalty_terminator = max(0.0, penalty_terminator)
        self.cycle_ticks = max(10, cycle_ticks)
        self.terminator_width = max(1, terminator_width)
        self.reproduction_threshold = max(10.0, reproduction_threshold)
        self.reproduction_cost = max(5.0, reproduction_cost)
        self.require_partner = require_partner
        self.max_ticks = max_ticks
        self.wind_penalty = max(0.0, wind_penalty)
        self.rocks_count = max(0, rocks_count)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SimulationConfig":
        return cls(
            seed=int(data.get("seed", 42)),
            width=int(data.get("width", 60)),
            height=int(data.get("height", 30)),
            initial_agents=int(data.get("initial_agents", 40)),
            starting_energy=float(data.get("starting_energy", 100.0)),
            base_metabolism=float(data.get("base_metabolism", 1.0)),
            penalty_hot=float(data.get("penalty_hot", 3.0)),
            penalty_cold=float(data.get("penalty_cold", 3.0)),
            penalty_terminator=float(data.get("penalty_terminator", 0.0)),
            cycle_ticks=int(data.get("cycle_ticks", 200)),
            terminator_width=int(data.get("terminator_width", 4)),
            reproduction_threshold=float(data.get("reproduction_threshold", 140.0)),
            reproduction_cost=float(data.get("reproduction_cost", 50.0)),
            require_partner=bool(data.get("require_partner", True)),
            max_ticks=data.get("max_ticks"),
            wind_penalty=float(data.get("wind_penalty", 0.0)),
            rocks_count=int(data.get("rocks_count", 0)),
        )

    def as_dict(self) -> Dict[str, Any]:
        return {
            "seed": self.seed,
            "width": self.width,
            "height": self.height,
            "initial_agents": self.initial_agents,
            "starting_energy": self.starting_energy,
            "base_metabolism": self.base_metabolism,
            "penalty_hot": self.penalty_hot,
            "penalty_cold": self.penalty_cold,
            "penalty_terminator": self.penalty_terminator,
            "cycle_ticks": self.cycle_ticks,
            "terminator_width": self.terminator_width,
            "reproduction_threshold": self.reproduction_threshold,
            "reproduction_cost": self.reproduction_cost,
            "require_partner": self.require_partner,
            "max_ticks": self.max_ticks,
            "wind_penalty": self.wind_penalty,
            "rocks_count": self.rocks_count,
        }


class SimulationEngine:
    """Научный симулятор самоорганизации на Меркурии."""

    def __init__(self, config: Optional[SimulationConfig] = None) -> None:
        self.config = config or SimulationConfig()
        self.rng = random.Random(self.config.seed)
        self.env = MercuryEnvironment(
            width=self.config.width,
            height=self.config.height,
            cycle_ticks=self.config.cycle_ticks,
            terminator_width=self.config.terminator_width,
            penalty_hot=self.config.penalty_hot,
            penalty_cold=self.config.penalty_cold,
            penalty_terminator=self.config.penalty_terminator,
        )
        self.events = EventLogger()
        self.metrics = MetricsCollector()
        self.tick = 0
        self.status = "idle"  # idle | running | paused | extinct | completed
        self.agents: Dict[str, Agent] = {}
        self.rocks: Set[Tuple[int, int]] = set()
        self.depressions: Dict[Tuple[int, int], int] = {}  # (x, y) -> depth_level (1: обычная, 2: глубокая)
        self._next_agent_seq = 1

        self._spawn_initial_agents()

    def get_effective_zone(self, x: int, y: int, tick: int) -> Zone:
        """Определяет эффективную температурную зону клетки с учетом углублений рельефа.

        В углублении сохраняется холодная температура. Если на углубление светит солнечный свет
        (дневная зона HOT), встреча холода и тепла образует пригодную для жизни среду (комфортный оазис TERMINATOR).
        """
        base_zone = self.env.get_zone(x, y, tick)
        dep_lvl = self.depressions.get((x, y), 0)
        if dep_lvl > 0 and base_zone == Zone.HOT:
            return Zone.TERMINATOR
        return base_zone

    def _generate_agent_id(self) -> str:
        aid = f"ag_{self._next_agent_seq:04d}"
        self._next_agent_seq += 1
        return aid

    def _spawn_initial_agents(self) -> None:
        """Детерминированная начальная расстановка агентов и скал."""
        self.agents.clear()
        self.rocks.clear()
        self.depressions.clear()
        self._next_agent_seq = 1
        occupied: Set[Tuple[int, int]] = set()

        all_coords = [(x, y) for x in range(self.config.width) for y in range(self.config.height)]
        self.rng.shuffle(all_coords)

        # 1. Спавн скал
        rocks_to_spawn = min(self.config.rocks_count, len(all_coords))
        for i in range(rocks_to_spawn):
            rx, ry = all_coords[i]
            self.rocks.add((rx, ry))
            occupied.add((rx, ry))

        # 2. Спавн агентов
        agents_to_spawn = min(self.config.initial_agents, len(all_coords) - rocks_to_spawn)
        for i in range(rocks_to_spawn, rocks_to_spawn + agents_to_spawn):
            x, y = all_coords[i]
            occupied.add((x, y))
            aid = self._generate_agent_id()
            aggr = max(0.0, min(1.0, self.rng.gauss(0.3, 0.25)))
            fear = max(0.0, min(1.0, self.rng.gauss(0.5, 0.25)))
            carn = max(0.0, min(1.0, self.rng.gauss(0.15, 0.2)))
            altr = max(0.0, min(1.0, self.rng.gauss(0.2, 0.2)))
            terr = max(-1.0, min(1.0, self.rng.gauss(0.0, 0.35)))
            agent = Agent(
                agent_id=aid,
                x=x,
                y=y,
                energy=self.config.starting_energy,
                age=0,
                generation=0,
                parent_id=None,
                w_temp=self.rng.gauss(-1.0, 2.0), # Склонность избегать штрафов (в среднем отрицательная)
                w_swarm=self.rng.gauss(0.5, 2.0), # Склонность кучковаться (в среднем положительная)
                aggression=aggr,
                fear=fear,
                carnivore=carn,
                altruism=altr,
                territorial=terr,
            )
            self.agents[aid] = agent
            self.events.log(
                tick=0,
                event_type=EventType.SPAWN,
                agent_id=aid,
                x=x,
                y=y,
                details=f"Spawned with energy {self.config.starting_energy}, aggr={round(aggr, 2)}, fear={round(fear, 2)}, carn={round(carn, 2)}, altr={round(altr, 2)}, terr={round(terr, 2)}",
            )

        # Запись метрики для тика 0
        self.metrics.record(
            tick=0,
            agents=list(self.agents.values()),
            environment=self.env,
            births=0,
            deaths=0,
            fights=0,
            combat_deaths=0,
            energy_shared=0.0,
            predation_energy=0.0,
        )

    def reset(self, new_config: Optional[SimulationConfig] = None) -> None:
        """Сброс симуляции к начальному состоянию."""
        if new_config is not None:
            self.config = new_config

        self.rng = random.Random(self.config.seed)
        self.env = MercuryEnvironment(
            width=self.config.width,
            height=self.config.height,
            cycle_ticks=self.config.cycle_ticks,
            terminator_width=self.config.terminator_width,
            penalty_hot=self.config.penalty_hot,
            penalty_cold=self.config.penalty_cold,
            penalty_terminator=self.config.penalty_terminator,
        )
        self.events.clear()
        self.metrics.clear()
        self.tick = 0
        self.status = "idle"
        self._spawn_initial_agents()

    def _get_neighbors(self, x: int, y: int) -> List[Tuple[int, int]]:
        """Соседние клетки (4-связность с тороидальным зацикливанием по X)."""
        candidates = [
            ((x + 1) % self.config.width, y),
            ((x - 1) % self.config.width, y),
            (x, y + 1),
            (x, y - 1),
        ]
        return [(nx, ny) for nx, ny in candidates if 0 <= ny < self.config.height]

    def step(self) -> Dict[str, Any]:
        """Выполнить один шаг (тик) симуляции."""
        if self.status in ("extinct", "completed"):
            return self.get_snapshot()

        self.tick += 1
        current_tick = self.tick
        births_this_tick = 0
        deaths_this_tick = 0
        fights_this_tick = 0
        combat_deaths_this_tick = 0
        energy_shared_this_tick = 0.0
        predation_energy_this_tick = 0.0

        alive_agents = [a for a in self.agents.values() if a.is_alive]
        # Сортируем по ID для строгой детерминированности обработки
        alive_agents.sort(key=lambda a: a.id)

        # Карта занятости клеток живыми агентами
        occupied: Dict[Tuple[int, int], Agent] = {(a.x, a.y): a for a in alive_agents}

        # 1. Трата энергии на жизнь и штрафы зон
        for agent in alive_agents:
            agent.age += 1
            zone = self.get_effective_zone(agent.x, agent.y, current_tick)
            
            if zone == Zone.TERMINATOR:
                # В зоне терминатора или освещенном углублении агенты получают солнечную энергию
                dep_lvl = self.depressions.get((agent.x, agent.y), 0)
                if dep_lvl == 1:
                    base_solar = 1.5
                else:
                    base_solar = 3.0
                # Трофическая адаптация: хищники получают значительно меньше энергии от солнца (стимул охотиться)
                solar_efficiency = max(0.05, 1.0 - 0.85 * agent.carnivore)
                agent.energy += base_solar * solar_efficiency
                
            zone_penalty = self.env.get_energy_penalty(zone)
            total_consumption = self.config.base_metabolism + zone_penalty + self.config.wind_penalty
            agent.consume_energy(total_consumption)

            # Проверка смерти от истощения
            if agent.energy <= 0.0:
                if zone == Zone.HOT:
                    death_type = EventType.DEATH_HEAT
                    reason = "Overheating exhaustion in HOT zone"
                elif zone == Zone.COLD:
                    death_type = EventType.DEATH_COLD
                    reason = "Freezing exhaustion in COLD zone"
                else:
                    death_type = EventType.DEATH_EXHAUSTION
                    reason = "Energy exhaustion"

                agent.die(reason, current_tick)
                deaths_this_tick += 1
                occupied.pop((agent.x, agent.y), None)

                self.events.log(
                    tick=current_tick,
                    event_type=death_type,
                    agent_id=agent.id,
                    x=agent.x,
                    y=agent.y,
                    details=reason,
                )

        # Обновленный список выживших
        survivors = [a for a in alive_agents if a.is_alive]

        # 1.5. Фаза альтруизма и взаимопомощи
        # Агенты с высоким altruism делятся избытком энергии с умирающими сородичами до перемещения
        for agent in survivors:
            if not agent.is_alive or agent.energy < 55.0 or agent.altruism < 0.3:
                continue

            neighbors = self._get_neighbors(agent.x, agent.y)
            needy_neighbors = [
                occupied[pos] for pos in neighbors
                if pos in occupied and occupied[pos].is_alive and occupied[pos].id != agent.id and occupied[pos].energy < 25.0
            ]
            if needy_neighbors:
                needy_neighbors.sort(key=lambda n: (n.energy, n.id))
                recipient = needy_neighbors[0]

                share_amount = min(8.0, agent.energy - 45.0)
                if share_amount >= 3.0:
                    agent.consume_energy(share_amount)
                    transferred = share_amount * 0.9
                    recipient.energy += transferred

                    agent.energy_shared += share_amount
                    recipient.energy_received += transferred
                    energy_shared_this_tick += share_amount

                    self.events.log(
                        tick=current_tick,
                        event_type=EventType.SHARE_ENERGY,
                        agent_id=agent.id,
                        parent_id=recipient.id,
                        x=agent.x,
                        y=agent.y,
                        details=f"{agent.id} shared {round(share_amount, 1)} energy with starving {recipient.id}",
                    )

        # 2. Перемещение и поведенческий выбор выживших агентов
        for agent in survivors:
            if not agent.is_alive:
                continue

            neighbors = self._get_neighbors(agent.x, agent.y)
            free_neighbors = [pos for pos in neighbors if pos not in occupied and pos not in self.rocks]
            occupied_neighbors = [
                pos for pos in neighbors 
                if pos in occupied and occupied[pos].id != agent.id and pos not in self.rocks
            ]

            # Варианты: остаться на месте, шагнуть на свободную клетку или напасть на соседа
            options = [(agent.x, agent.y)] + free_neighbors
            if agent.aggression >= 0.25 or agent.carnivore >= 0.3:
                options += occupied_neighbors

            best_score = float("-inf")
            best_pos = (agent.x, agent.y)

            for pos in options:
                is_attack = (pos in occupied and occupied[pos].id != agent.id)
                if is_attack:
                    target = occupied[pos]
                    target_zone = self.get_effective_zone(target.x, target.y, current_tick)
                    zone_bonus = 2.0 if target_zone == Zone.TERMINATOR else 0.0
                    energy_diff = (agent.energy - target.energy) / 50.0

                    # Голодный стимул хищника: чем выше carnivore и ниже энергия, тем сильнее тяга атаковать
                    hunger_drive = agent.carnivore * max(0.0, (90.0 - agent.energy) / 25.0) * 2.0

                    # Территориальный стимул: стремление занять оазис/кратер
                    pos_dep = self.depressions.get(pos, 0)
                    territorial_incentive = 2.0 * agent.territorial if pos_dep > 0 and agent.territorial > 0 else 0.0

                    combat_incentive = (
                        (agent.aggression * 3.0) 
                        + energy_diff 
                        + zone_bonus 
                        + hunger_drive 
                        + territorial_incentive 
                        - (agent.fear * target.aggression * 3.0)
                    )

                    if combat_incentive <= 0.4:
                        continue
                    score = combat_incentive + self.rng.gauss(0, 0.3)
                else:
                    pos_zone = self.get_effective_zone(pos[0], pos[1], current_tick)
                    pos_penalty = self.env.get_energy_penalty(pos_zone)
                    pos_neighbors = self._get_neighbors(pos[0], pos[1])
                    swarm_count = sum(1 for n in pos_neighbors if n in occupied and occupied[n].id != agent.id)

                    # Учет страха: избегание клеток рядом с агрессивными соседями
                    threat_sum = sum(
                        occupied[n].aggression for n in pos_neighbors
                        if n in occupied and occupied[n].id != agent.id and occupied[n].aggression > 0.4
                    )
                    fear_penalty = agent.fear * threat_sum * 3.0

                    # Территориальная привязка к кратеру
                    pos_dep = self.depressions.get(pos, 0)
                    stay_dep_bonus = 3.0 * agent.territorial if pos_dep > 0 and agent.territorial > 0 else (
                        -1.0 * abs(agent.territorial) if pos_dep == 0 and agent.territorial > 0 and (agent.x, agent.y) in self.depressions else 0.0
                    )

                    score = (
                        (agent.w_temp * pos_penalty) 
                        + (agent.w_swarm * swarm_count) 
                        - fear_penalty 
                        + stay_dep_bonus 
                        + self.rng.gauss(0, 0.5)
                    )

                if score > best_score:
                    best_score = score
                    best_pos = pos

            target_pos = best_pos

            if target_pos == (agent.x, agent.y):
                continue
            elif target_pos in occupied and occupied[target_pos].id != agent.id:
                # Боевое столкновение
                defender = occupied[target_pos]
                fights_this_tick += 1

                agent.consume_energy(2.5)
                defender.consume_energy(2.5)

                att_power = agent.energy * (0.6 + agent.aggression)
                # Бонус защиты в своем кратере для территориальных агентов
                def_dep = self.depressions.get(target_pos, 0)
                dep_defense_mult = (1.0 + defender.territorial * 0.6) if def_dep > 0 and defender.territorial > 0 else 1.0
                def_power = defender.energy * (0.6 + defender.aggression) * dep_defense_mult
                total_power = max(0.1, att_power + def_power)
                win_prob = att_power / total_power

                attacker_wins = (self.rng.random() < win_prob)

                if attacker_wins:
                    agent.fights_won += 1
                    defender.fights_lost += 1

                    # Доля отнимаемой энергии и процент усвоения зависят от плотоядности хищника
                    steal_pct = 0.20 + 0.40 * agent.carnivore
                    absorption_efficiency = 0.40 + 0.50 * agent.carnivore

                    dmg = min(defender.energy, max(6.0, defender.energy * steal_pct))
                    defender.consume_energy(dmg)
                    gained_energy = dmg * absorption_efficiency
                    agent.energy += gained_energy
                    agent.predation_energy += gained_energy
                    predation_energy_this_tick += gained_energy

                    is_predation = (agent.carnivore >= 0.35)

                    if defender.energy <= 0.0:
                        death_type = EventType.PREDATION if is_predation else EventType.DEATH_COMBAT
                        reason = f"Predated and devoured by {agent.id}" if is_predation else f"Killed in combat by {agent.id}"

                        defender.die(reason, current_tick)
                        agent.kills += 1
                        deaths_this_tick += 1
                        combat_deaths_this_tick += 1
                        occupied.pop((defender.x, defender.y), None)

                        self.events.log(
                            tick=current_tick,
                            event_type=death_type,
                            agent_id=defender.id,
                            parent_id=agent.id,
                            x=defender.x,
                            y=defender.y,
                            details=f"{defender.id} was {'devoured' if is_predation else 'slain'} by {agent.id} in combat (+{round(gained_energy, 1)} energy absorbed)",
                        )
                        occupied.pop((agent.x, agent.y), None)
                        agent.x, agent.y = target_pos
                        occupied[target_pos] = agent
                    else:
                        def_neighbors = self._get_neighbors(defender.x, defender.y)
                        retreat_options = [p for p in def_neighbors if p not in occupied and p not in self.rocks]
                        if retreat_options:
                            retreat_pos = self.rng.choice(retreat_options)
                            occupied.pop((defender.x, defender.y), None)
                            defender.x, defender.y = retreat_pos
                            occupied[retreat_pos] = defender

                            self.events.log(
                                tick=current_tick,
                                event_type=EventType.FLEE,
                                agent_id=defender.id,
                                x=defender.x,
                                y=defender.y,
                                details=f"{defender.id} fled to ({retreat_pos[0]}, {retreat_pos[1]}) after assault by {agent.id}",
                            )
                            occupied.pop((agent.x, agent.y), None)
                            agent.x, agent.y = target_pos
                            occupied[target_pos] = agent
                        else:
                            defender.consume_energy(12.0)
                            if defender.energy <= 0.0:
                                death_type = EventType.PREDATION if is_predation else EventType.DEATH_COMBAT
                                reason = f"Trapped, crushed and devoured by {agent.id}" if is_predation else f"Trapped and crushed in combat by {agent.id}"

                                defender.die(reason, current_tick)
                                agent.kills += 1
                                deaths_this_tick += 1
                                combat_deaths_this_tick += 1
                                occupied.pop((defender.x, defender.y), None)
                                occupied.pop((agent.x, agent.y), None)
                                agent.x, agent.y = target_pos
                                occupied[target_pos] = agent

                                self.events.log(
                                    tick=current_tick,
                                    event_type=death_type,
                                    agent_id=defender.id,
                                    parent_id=agent.id,
                                    x=defender.x,
                                    y=defender.y,
                                    details=f"{defender.id} trapped and devoured by {agent.id}",
                                )

                    self.events.log(
                        tick=current_tick,
                        event_type=EventType.PREDATION if is_predation else EventType.FIGHT,
                        agent_id=agent.id,
                        parent_id=defender.id,
                        x=target_pos[0],
                        y=target_pos[1],
                        details=f"{'Predation assault' if is_predation else 'Assault'} on ({target_pos[0]}, {target_pos[1]}): {agent.id} defeated {defender.id} (stole {round(dmg, 1)} energy, absorbed {round(gained_energy, 1)})",
                    )
                else:
                    defender.fights_won += 1
                    agent.fights_lost += 1

                    counter_dmg = min(agent.energy, max(4.0, agent.energy * 0.2))
                    agent.consume_energy(counter_dmg)

                    if agent.energy <= 0.0:
                        agent.die(f"Killed during failed assault on {defender.id}", current_tick)
                        defender.kills += 1
                        deaths_this_tick += 1
                        combat_deaths_this_tick += 1
                        occupied.pop((agent.x, agent.y), None)

                        self.events.log(
                            tick=current_tick,
                            event_type=EventType.DEATH_COMBAT,
                            agent_id=agent.id,
                            parent_id=defender.id,
                            x=agent.x,
                            y=agent.y,
                            details=f"{agent.id} perished attacking {defender.id}",
                        )

                    self.events.log(
                        tick=current_tick,
                        event_type=EventType.FIGHT,
                        agent_id=agent.id,
                        parent_id=defender.id,
                        x=target_pos[0],
                        y=target_pos[1],
                        details=f"Failed assault: {defender.id} repelled {agent.id} (-{round(counter_dmg, 1)} energy)",
                    )
            else:
                occupied.pop((agent.x, agent.y), None)
                agent.x, agent.y = target_pos
                occupied[target_pos] = agent

        # 3. Размножение
        new_offspring: List[Agent] = []
        for agent in survivors:
            if not agent.can_reproduce(self.config.reproduction_threshold):
                continue

            can_breed = True
            if self.config.require_partner:
                # Проверяем наличие рядом хотя бы одного живого партнера
                neighbors = self._get_neighbors(agent.x, agent.y)
                has_partner = any(pos in occupied and occupied[pos].id != agent.id for pos in neighbors)
                if not has_partner:
                    can_breed = False

            if not can_breed:
                continue

            # Ищем свободную соседнюю клетку для потомка
            neighbors = self._get_neighbors(agent.x, agent.y)
            free_neighbors = [pos for pos in neighbors if pos not in occupied and pos not in self.rocks]

            if free_neighbors:
                child_x, child_y = self.rng.choice(free_neighbors)
                child_id = self._generate_agent_id()
                child = agent.reproduce(
                    child_id=child_id,
                    child_x=child_x,
                    child_y=child_y,
                    cost=self.config.reproduction_cost,
                    rng=self.rng,
                )
                new_offspring.append(child)
                occupied[(child_x, child_y)] = child
                births_this_tick += 1

                self.events.log(
                    tick=current_tick,
                    event_type=EventType.BIRTH,
                    agent_id=child_id,
                    parent_id=agent.id,
                    x=child_x,
                    y=child_y,
                    details=f"Born from {agent.id}. Parent energy: {round(agent.energy, 1)}, Child: {round(child.energy, 1)}",
                )

        for child in new_offspring:
            self.agents[child.id] = child

        # 4. Запись метрик
        all_current = list(self.agents.values())
        latest_metrics = self.metrics.record(
            tick=current_tick,
            agents=all_current,
            environment=self.env,
            births=births_this_tick,
            deaths=deaths_this_tick,
            fights=fights_this_tick,
            combat_deaths=combat_deaths_this_tick,
            energy_shared=energy_shared_this_tick,
            predation_energy=predation_energy_this_tick,
        )

        # 5. Проверка окончания симуляции
        if latest_metrics.alive_count == 0:
            self.status = "extinct"
            self.events.log(
                tick=current_tick,
                event_type=EventType.EXTINCTION,
                details=f"Entire population went extinct at tick {current_tick}",
            )
        elif self.config.max_ticks is not None and current_tick >= self.config.max_ticks:
            self.status = "completed"

        return self.get_snapshot()

    def get_state_hash(self) -> str:
        """Контрольная сумма состояния для строгой научной верификации повторяемости."""
        alive_agents = sorted(
            [a for a in self.agents.values() if a.is_alive],
            key=lambda a: a.id,
        )
        data = {
            "tick": self.tick,
            "seed": self.config.seed,
            "alive_count": len(alive_agents),
            "agents": [
                {
                    "id": a.id,
                    "x": a.x,
                    "y": a.y,
                    "energy": round(a.energy, 4),
                    "age": a.age,
                    "gen": a.generation,
                    "wt": round(a.w_temp, 4),
                    "ws": round(a.w_swarm, 4),
                    "ag": round(a.aggression, 4),
                    "fr": round(a.fear, 4),
                    "cr": round(a.carnivore, 4),
                    "al": round(a.altruism, 4),
                    "tr": round(a.territorial, 4),
                }
                for a in alive_agents
            ],
        }
        serialized = json.dumps(data, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def run_batch(self, ticks: int) -> Dict[str, Any]:
        """Пакетный запуск N тиков без задержек (для headless экспериментов)."""
        for _ in range(ticks):
            if self.status in ("extinct", "completed"):
                break
            self.step()

        return {
            "final_tick": self.tick,
            "status": self.status,
            "state_hash": self.get_state_hash(),
            "latest_metrics": self.metrics.get_latest(),
        }

    def get_snapshot(self) -> Dict[str, Any]:
        """Полный срез текущего состояния для отправки клиенту."""
        alive_agents = [
            a.as_dict(current_zone=self.get_effective_zone(a.x, a.y, self.tick).value)
            for a in self.agents.values()
            if a.is_alive
        ]
        return {
            "tick": self.tick,
            "status": self.status,
            "state_hash": self.get_state_hash(),
            "environment": {
                **self.env.get_state(self.tick),
                "rocks": [{"x": r[0], "y": r[1]} for r in sorted(self.rocks)],
                "depressions": [{"x": pos[0], "y": pos[1], "level": lvl} for pos, lvl in sorted(self.depressions.items())],
            },
            "agents": alive_agents,
            "metrics": self.metrics.get_latest(),
            "recent_events": self.events.get_events(since_tick=self.tick, limit=20),
        }

    def throw_meteorite(self, target_x: int, target_y: int, radius: float) -> None:
        """
        Сбросить метеорит:
        - В центре удара все агенты гарантированно погибают.
        - Урон уменьшается равноудаленно от центра к границе радиуса.
        - Скалы в радиусе поражения разрушаются.
        - В центре после падения метеорита остается скала и не исчезает.
        """
        killed_agents = []
        damaged_agents = []

        # Эпицентр полного уничтожения (центр удара)
        epicenter_radius = max(1.0, radius * 0.35)
        max_damage = 180.0  # Урон на границе эпицентра, убывающий к краю

        for agent in list(self.agents.values()):
            if not agent.is_alive:
                continue

            # Учитываем тороидальность по X (width)
            dx = abs(agent.x - target_x)
            dx = min(dx, self.config.width - dx)
            dy = abs(agent.y - target_y)

            dist = (dx**2 + dy**2) ** 0.5
            if dist <= radius:
                if dist <= epicenter_radius:
                    # В центре удара все агенты гарантированно умирают
                    agent.die("Killed by meteorite (epicenter)", self.tick)
                    agent.energy = 0.0
                    killed_agents.append(agent)
                    self.events.log(
                        tick=self.tick,
                        event_type=EventType.METEORITE,
                        agent_id=agent.id,
                        x=agent.x,
                        y=agent.y,
                        details=f"Killed in meteorite epicenter at ({target_x}, {target_y})"
                    )
                else:
                    # Урон уменьшается равноудаленно от центра к границе радиуса
                    damage_factor = (radius - dist) / max(0.001, (radius - epicenter_radius))
                    damage = max_damage * damage_factor

                    if damage >= agent.energy:
                        agent.die("Killed by meteorite shockwave", self.tick)
                        agent.energy = 0.0
                        killed_agents.append(agent)
                        self.events.log(
                            tick=self.tick,
                            event_type=EventType.METEORITE,
                            agent_id=agent.id,
                            x=agent.x,
                            y=agent.y,
                            details=f"Killed by meteorite shockwave at ({agent.x}, {agent.y}), dist={dist:.2f}, damage={damage:.1f}"
                        )
                    else:
                        agent.consume_energy(damage)
                        damaged_agents.append(agent)
                        self.events.log(
                            tick=self.tick,
                            event_type=EventType.METEORITE,
                            agent_id=agent.id,
                            x=agent.x,
                            y=agent.y,
                            details=f"Damaged by meteorite shockwave: -{damage:.1f} energy (left: {agent.energy:.1f})"
                        )

        # Разрушаем старые скалы в радиусе поражения
        destroyed_rocks = set()
        for rx, ry in self.rocks:
            dx = abs(rx - target_x)
            dx = min(dx, self.config.width - dx)
            dy = abs(ry - target_y)
            dist = (dx**2 + dy**2) ** 0.5
            if dist <= radius:
                destroyed_rocks.add((rx, ry))

        self.rocks -= destroyed_rocks

        # Формируем углубления: чем ближе к центру кратера, тем сильнее углубление
        # Уровень 2 (глубокая): dist <= radius * 0.5
        # Уровень 1 (обычная): radius * 0.5 < dist <= radius
        r_int = int(math.ceil(radius))
        for dy in range(-r_int, r_int + 1):
            for dx_offset in range(-r_int, r_int + 1):
                nx = (target_x + dx_offset) % self.config.width
                ny = target_y + dy
                if 0 <= ny < self.config.height:
                    dx = abs(nx - target_x)
                    dx = min(dx, self.config.width - dx)
                    dist = (dx**2 + dy**2) ** 0.5
                    if 0 < dist <= radius:
                        if dist <= radius * 0.5:
                            self.depressions[(nx, ny)] = 2
                        else:
                            self.depressions[(nx, ny)] = max(self.depressions.get((nx, ny), 0), 1)

        # В центре после падения метеорита остается скала и не исчезает
        if 0 <= target_y < self.config.height:
            norm_target_x = target_x % self.config.width
            self.rocks.add((norm_target_x, target_y))

        # Логируем само событие падения
        self.events.log(
            tick=self.tick,
            event_type=EventType.METEORITE,
            x=target_x,
            y=target_y,
            details=f"Meteorite impact at ({target_x}, {target_y}) with radius {radius}. Killed {len(killed_agents)} agents, damaged {len(damaged_agents)} agents, left central rock and depressions."
        )

    def add_rocks(self, target_x: int, target_y: int, size: int) -> None:
        """Добавить блок скал размера size x size."""
        offset = size // 2
        added = 0
        for dx in range(-offset, size - offset):
            for dy in range(-offset, size - offset):
                nx = (target_x + dx) % self.config.width
                ny = target_y + dy
                if 0 <= ny < self.config.height:
                    self.rocks.add((nx, ny))
                    added += 1
                    
        self.events.log(
            tick=self.tick,
            event_type=EventType.ROCKS,
            x=target_x,
            y=target_y,
            details=f"Added {added} rocks around ({target_x}, {target_y}) with size {size}"
        )

    def add_depression(self, target_x: int, target_y: int, level: int = 1, size: int = 1) -> None:
        """Добавить углубление (уровень 1 - обычная, уровень 2 - глубокая) размера size."""
        level = max(1, min(2, int(level)))
        offset = size // 2
        added = 0
        for dx in range(-offset, size - offset):
            for dy in range(-offset, size - offset):
                nx = (target_x + dx) % self.config.width
                ny = target_y + dy
                if 0 <= ny < self.config.height:
                    self.depressions[(nx, ny)] = level
                    added += 1

        self.events.log(
            tick=self.tick,
            event_type=EventType.DEPRESSION,
            x=target_x,
            y=target_y,
            details=f"Added depression level {level} with size {size} around ({target_x}, {target_y})"
        )

    def remove_rocks(self, target_x: int, target_y: int, radius: float) -> None:
        """Удалить скалы и углубления в заданном радиусе (Ластик)."""
        to_remove_rocks = set()
        for rx, ry in self.rocks:
            dx = abs(rx - target_x)
            dx = min(dx, self.config.width - dx)
            dy = abs(ry - target_y)
            if (dx**2 + dy**2) ** 0.5 <= radius:
                to_remove_rocks.add((rx, ry))
        self.rocks -= to_remove_rocks

        to_remove_dep = set()
        for (dx_coord, dy_coord) in self.depressions:
            dx = abs(dx_coord - target_x)
            dx = min(dx, self.config.width - dx)
            dy = abs(dy_coord - target_y)
            if (dx**2 + dy**2) ** 0.5 <= radius:
                to_remove_dep.add((dx_coord, dy_coord))
        for key in to_remove_dep:
            self.depressions.pop(key, None)

        self.events.log(
            tick=self.tick,
            event_type=EventType.ERASER,
            x=target_x,
            y=target_y,
            details=f"Removed {len(to_remove_rocks)} rocks and {len(to_remove_dep)} depressions around ({target_x}, {target_y}) with radius {radius}"
        )

    def apply_wind(self, target_x: int, target_y: int, strength: int = 7, direction: Optional[str] = None) -> None:
        """Применить ветер. Сдувает агентов радиально от центра нажатия указателя."""
        radius = 15.0
        affected = 0
        
        for agent in list(self.agents.values()):
            if not agent.is_alive:
                continue
            
            # Учитываем тороидальность по X
            dx_raw = (agent.x - target_x) % self.config.width
            if dx_raw > self.config.width / 2:
                dx = dx_raw - self.config.width
            else:
                dx = dx_raw
            dy = agent.y - target_y
            dist = (dx**2 + dy**2) ** 0.5
            
            if dist <= radius:
                if dist < 0.001:
                    angle = self.rng.uniform(0, 2 * math.pi)
                    dir_x = math.cos(angle)
                    dir_y = math.sin(angle)
                else:
                    dir_x = dx / dist
                    dir_y = dy / dist

                push_mag = max(1, round(strength * (1.0 - dist / (radius + 2.0))))
                new_x = int(round(agent.x + dir_x * push_mag)) % self.config.width
                new_y = max(0, min(self.config.height - 1, int(round(agent.y + dir_y * push_mag))))

                if (new_x, new_y) not in self.rocks:
                    agent.x = new_x
                    agent.y = new_y
                    
                # Отнимаем энергию за сдувание
                agent.consume_energy(float(strength * 0.5))
                if agent.energy <= 0:
                    agent.die("Exhausted by wind", self.tick)
                affected += 1
                
        self.events.log(
            tick=self.tick,
            event_type=EventType.WIND,
            x=target_x,
            y=target_y,
            details=f"Radial wind with strength {strength} from ({target_x}, {target_y}) affected {affected} agents."
        )
