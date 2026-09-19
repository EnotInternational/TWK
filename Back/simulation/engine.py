"""Главный детерминированный движок симуляции Terra Nova: Mercury.

Реализует пошаговую физику Меркурия, жизненный цикл агентов и сбор метрик.
Детерминированность обеспечивается отдельным генератором random.Random(seed).
"""

import hashlib
import json
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
        agent_max_age: int = 100,
        wind_penalty: float = 0.0,
        rocks_count: int = 0,
        rocks_coords: Optional[List[Tuple[int, int]]] = None,
        meteorite_prob: float = 0.0,
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
        self.agent_max_age = max(1, agent_max_age)
        self.wind_penalty = max(0.0, wind_penalty)
        self.rocks_count = max(0, rocks_count)
        self.rocks_coords = rocks_coords if rocks_coords is not None else []
        self.meteorite_prob = max(0.0, min(1.0, meteorite_prob))

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
            agent_max_age=int(data.get("agent_max_age", 100)),
            wind_penalty=float(data.get("wind_penalty", 0.0)),
            rocks_count=int(data.get("rocks_count", 0)),
            rocks_coords=[tuple(c) for c in data.get("rocks_coords", [])],
            meteorite_prob=float(data.get("meteorite_prob", 0.0)),
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
            "agent_max_age": self.agent_max_age,
            "wind_penalty": self.wind_penalty,
            "rocks_count": self.rocks_count,
            "rocks_coords": self.rocks_coords,
            "meteorite_prob": self.meteorite_prob,
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
        self._next_agent_seq = 1

        self._spawn_initial_agents()

    def _generate_agent_id(self) -> str:
        aid = f"ag_{self._next_agent_seq:04d}"
        self._next_agent_seq += 1
        return aid

    def _spawn_initial_agents(self) -> None:
        """Детерминированная начальная расстановка агентов."""
        self.agents.clear()
        self._next_agent_seq = 1
        occupied: Set[Tuple[int, int]] = set()

        # Скалы из конфига
        rocks = set(self.config.rocks_coords)
        all_coords = [(x, y) for x in range(self.config.width) for y in range(self.config.height)]
        self.rng.shuffle(all_coords)

        # Добавляем случайные скалы
        rocks_to_add = self.config.rocks_count
        for pos in all_coords:
            if rocks_to_add <= 0:
                break
            if pos not in rocks:
                rocks.add(pos)
                rocks_to_add -= 1
        self.env.rocks = rocks

        # Клетки, доступные для агентов
        available_coords = [pos for pos in all_coords if pos not in rocks]

        count = min(self.config.initial_agents, len(available_coords))
        for i in range(count):
            x, y = available_coords[i]
            occupied.add((x, y))
            aid = self._generate_agent_id()
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
                max_age=self.config.agent_max_age,
            )
            self.agents[aid] = agent
            self.events.log(
                tick=0,
                event_type=EventType.SPAWN,
                agent_id=aid,
                x=x,
                y=y,
                details=f"Spawned with energy {self.config.starting_energy}",
            )

        # Запись метрики для тика 0
        self.metrics.record(
            tick=0,
            agents=list(self.agents.values()),
            environment=self.env,
            births=0,
            deaths=0,
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

        alive_agents = [a for a in self.agents.values() if a.is_alive]
        # Сортируем по ID для строгой детерминированности обработки
        alive_agents.sort(key=lambda a: a.id)

        # Карта занятости клеток живыми агентами
        occupied: Dict[Tuple[int, int], Agent] = {(a.x, a.y): a for a in alive_agents}

        # 1. Трата энергии на жизнь и штрафы зон
        for agent in alive_agents:
            agent.age += 1
            if agent.age >= agent.max_age:
                agent.die("Old age", current_tick)
                deaths_this_tick += 1
                occupied.pop((agent.x, agent.y), None)
                self.events.log(
                    tick=current_tick,
                    event_type=EventType.DEATH_AGE,
                    agent_id=agent.id,
                    x=agent.x,
                    y=agent.y,
                    details="Died of old age",
                )
                continue

            zone = self.env.get_zone(agent.x, agent.y, current_tick)
            
            if zone == Zone.TERMINATOR:
                # В зоне терминатора агенты получают энергию солнца на рассвете/закате
                agent.energy += 3.0
                
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

        # 1.5 Метеориты
        if self.config.meteorite_prob > 0 and self.rng.random() < self.config.meteorite_prob:
            mx = self.rng.randint(0, self.config.width - 1)
            my = self.rng.randint(0, self.config.height - 1)
            
            self.events.log(
                tick=current_tick,
                event_type=EventType.METEORITE_STRIKE,
                x=mx,
                y=my,
                details="Meteorite struck",
            )
            
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    nx, ny = (mx + dx) % self.config.width, my + dy
                    if 0 <= ny < self.config.height:
                        if (nx, ny) in occupied:
                            victim = occupied.pop((nx, ny))
                            victim.die("Meteorite strike", current_tick)
                            deaths_this_tick += 1

        # Обновляем выживших после метеоритов
        survivors = [a for a in alive_agents if a.is_alive]

        # 2. Перемещение выживших агентов
        # Детерминированный порядок перемещения
        for agent in survivors:
            neighbors = self._get_neighbors(agent.x, agent.y)
            free_neighbors = [pos for pos in neighbors if pos not in occupied and pos not in self.env.rocks]

            # Агент может остаться на месте или шагнуть на свободную клетку
            options = [(agent.x, agent.y)] + free_neighbors
            
            best_score = float("-inf")
            best_pos = (agent.x, agent.y)
            
            for pos in options:
                # 1. Штраф зоны (отрицательный стимул)
                pos_zone = self.env.get_zone(pos[0], pos[1], current_tick)
                pos_penalty = self.env.get_energy_penalty(pos_zone)
                
                # 2. Плотность соседей (социальный стимул)
                pos_neighbors = self._get_neighbors(pos[0], pos[1])
                swarm_count = sum(1 for n in pos_neighbors if n in occupied and occupied[n].id != agent.id)
                
                # Функция приспособленности
                score = (agent.w_temp * pos_penalty) + (agent.w_swarm * swarm_count) + self.rng.gauss(0, 0.5)
                
                if score > best_score:
                    best_score = score
                    best_pos = pos

            target_pos = best_pos

            if target_pos != (agent.x, agent.y):
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
            free_neighbors = [pos for pos in neighbors if pos not in occupied and pos not in self.env.rocks]

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
            a.as_dict(current_zone=self.env.get_zone(a.x, a.y, self.tick).value)
            for a in self.agents.values()
            if a.is_alive
        ]
        return {
            "tick": self.tick,
            "status": self.status,
            "state_hash": self.get_state_hash(),
            "environment": self.env.get_state(self.tick),
            "agents": alive_agents,
            "metrics": self.metrics.get_latest(),
            "recent_events": self.events.get_events(since_tick=self.tick, limit=20),
        }
