"""Модель агента для симуляции Terra Nova: Mercury.

Агент обладает запасом энергии, возрастом, родословной (parent_id, generation),
тратит энергию на поддержание жизни и гибнет при её истощении.
Также агент обладает генами поведения (w_temp, w_swarm).
"""

import random
from typing import Any, Dict, Optional


class Agent:
    def __init__(
        self,
        agent_id: str,
        x: int,
        y: int,
        energy: float = 100.0,
        age: int = 0,
        generation: int = 0,
        parent_id: Optional[str] = None,
        w_temp: float = 0.0,
        w_swarm: float = 0.0,
        aggression: float = 0.3,
        fear: float = 0.5,
        carnivore: float = 0.0,
        altruism: float = 0.1,
        territorial: float = 0.0,
        caste: Optional[str] = None,
        ferocity: Optional[float] = None,
        friendliness: Optional[float] = None,
        courage: Optional[float] = None,
        diplomacy: Optional[float] = None,
        caution: Optional[float] = None,
        choice_history: Optional[Dict[str, int]] = None,
    ) -> None:
        self.id = agent_id
        self.x = x
        self.y = y
        self.energy = float(energy)
        self.age = age
        self.generation = generation
        self.parent_id = parent_id
        self.is_alive = True
        self.death_reason: Optional[str] = None
        self.death_tick: Optional[int] = None
        
        # 1. Биологическая каста: predator (хищник) или peaceful (мирный)
        if caste is not None:
            self.caste = caste
        elif carnivore >= 0.4 or aggression >= 0.7:
            self.caste = "predator"
        else:
            self.caste = "peaceful"

        # 2. Динамические черты характера (формируются на основе выборов)
        if ferocity is not None:
            self.ferocity = max(0.0, min(1.0, float(ferocity)))
            self.aggression = self.ferocity
        else:
            self.ferocity = float(aggression)
            self.aggression = float(aggression)

        if friendliness is not None:
            self.friendliness = max(0.0, min(1.0, float(friendliness)))
        else:
            self.friendliness = 0.25 if self.caste == "predator" else max(0.45, float(altruism) * 2.0)

        if courage is not None:
            self.courage = max(0.0, min(1.0, float(courage)))
        else:
            self.courage = 0.65 if self.caste == "predator" else max(0.15, 1.0 - float(fear))

        if diplomacy is not None:
            self.diplomacy = max(0.0, min(1.0, float(diplomacy)))
        else:
            self.diplomacy = 0.15 if self.caste == "predator" else 0.50

        if caution is not None:
            self.caution = max(0.0, min(1.0, float(caution)))
            self.fear = self.caution
        else:
            self.caution = float(fear)
            self.fear = float(fear)

        # 3. Послужной список жизненных выборов агента
        self.choice_history: Dict[str, int] = dict(choice_history) if choice_history else {
            "friend": 0,
            "fight": 0,
            "bribe": 0,
            "flee": 0,
            "retaliate": 0,
        }
        # Детальная хроника выборов и их последствий (лента решений)
        self.choice_chronicle: List[Dict[str, Any]] = []

        # 4. Обратная совместимость с генами поведения и физиологии
        self.w_temp = float(w_temp)
        self.w_swarm = float(w_swarm)
        self.carnivore = float(carnivore) if carnivore > 0.0 else (0.85 if self.caste == "predator" else 0.0)
        self.altruism = float(altruism) if altruism != 0.1 else min(1.0, self.friendliness * 0.5)
        self.territorial = max(-1.0, min(1.0, float(territorial)))

        # Индивидуальная статистика поведения, боев и социальности
        self.fights_won = 0
        self.fights_lost = 0
        self.kills = 0
        self.energy_shared = 0.0
        self.energy_received = 0.0
        self.predation_energy = 0.0

    @property
    def character_title(self) -> str:
        """Динамический титул характера, сформированный на основе опыта и выборов."""
        if self.caste == "predator":
            if self.ferocity >= 0.65 and self.ferocity > self.friendliness:
                return "Кровожадный хищник"
            elif self.friendliness >= 0.45 and self.friendliness >= self.ferocity:
                return "Благородный хищник"
            elif self.diplomacy >= 0.38 or self.choice_history.get("bribe", 0) >= 1:
                return "Рэкетир-собиратель"
            elif self.caution >= 0.45:
                return "Осторожный охотник"
            return "Охотник стаи"
        else:
            if self.courage >= 0.45 or self.choice_history.get("retaliate", 0) >= 1:
                return "Боевой защитник"
            elif (self.diplomacy >= 0.45 or self.choice_history.get("bribe", 0) >= 1) and self.choice_history.get("bribe", 0) >= self.choice_history.get("flee", 0):
                return "Хитрый дипломат"
            elif (self.caution >= 0.50 or self.choice_history.get("flee", 0) >= 1) and self.choice_history.get("flee", 0) > self.choice_history.get("bribe", 0):
                return "Осторожный беглец"
            return "Мирный обыватель"

    @property
    def archetype(self) -> str:
        """Определяет доминирующий тип поведения (архетип) агента из 6 устойчивых стратегий."""
        if self.territorial >= 0.35 and self.aggression >= 0.35 and self.carnivore < 0.6:
            return "oasis_guardian"
        elif self.carnivore >= 0.45 and self.aggression >= 0.4:
            return "predator"
        elif self.aggression >= 0.75 and self.aggression > self.fear:
            return "predator"
        elif self.altruism >= 0.45 and self.w_swarm > 0.0:
            return "altruist_swarm"
        elif (self.fear >= 0.55 and self.aggression < 0.4) or (self.fear >= 0.65 and self.fear > self.aggression):
            return "fleeing_prey"
        elif self.carnivore <= 0.2 and self.aggression <= 0.25 and self.territorial <= 0.2:
            return "grazer"
        return "opportunist"

    # Методы подкрепления характера на основе жизненных решений
    def reinforce_friendship(self, success: bool = True) -> None:
        """Подкрепление черт после мирного выбора / союза."""
        self.choice_history["friend"] = self.choice_history.get("friend", 0) + 1
        delta = 0.05 if success else -0.02
        self.friendliness = max(0.0, min(1.0, self.friendliness + delta))
        self.ferocity = max(0.0, min(1.0, self.ferocity - 0.03))
        self.aggression = self.ferocity
        self.altruism = min(1.0, self.friendliness * 0.5)

    def reinforce_bribe(self, as_predator: bool = False) -> None:
        """Подкрепление черт после передачи / принятия откупа."""
        self.choice_history["bribe"] = self.choice_history.get("bribe", 0) + 1
        if as_predator:
            self.friendliness = max(0.0, min(1.0, self.friendliness + 0.04))
            self.diplomacy = max(0.0, min(1.0, self.diplomacy + 0.04))
        else:
            self.diplomacy = max(0.0, min(1.0, self.diplomacy + 0.08))
            self.caution = max(0.0, min(1.0, self.caution + 0.02))
            self.courage = max(0.0, min(1.0, self.courage - 0.02))
            self.fear = self.caution

    def reinforce_flee(self, escaped: bool = True) -> None:
        """Подкрепление черт после попытки побега."""
        self.choice_history["flee"] = self.choice_history.get("flee", 0) + 1
        if escaped:
            self.caution = max(0.0, min(1.0, self.caution + 0.06))
            self.courage = max(0.0, min(1.0, self.courage - 0.03))
        else:
            self.caution = max(0.0, min(1.0, self.caution + 0.03))
        self.fear = self.caution

    def reinforce_retaliate(self, won: bool = True) -> None:
        """Подкрепление черт после решительного отпора хищнику."""
        self.choice_history["retaliate"] = self.choice_history.get("retaliate", 0) + 1
        if won:
            self.courage = max(0.0, min(1.0, self.courage + 0.15))
            self.caution = max(0.0, min(1.0, self.caution - 0.08))
            self.ferocity = max(0.0, min(1.0, self.ferocity + 0.05))
        else:
            self.courage = max(0.0, min(1.0, self.courage - 0.10))
            self.caution = max(0.0, min(1.0, self.caution + 0.08))
            self.diplomacy = max(0.0, min(1.0, self.diplomacy + 0.06))
        self.fear = self.caution
        self.aggression = self.ferocity

    def reinforce_fight(self, won: bool = True) -> None:
        """Подкрепление черт хищника после боя."""
        self.choice_history["fight"] = self.choice_history.get("fight", 0) + 1
        if won:
            self.ferocity = max(0.0, min(1.0, self.ferocity + 0.07))
            self.courage = max(0.0, min(1.0, self.courage + 0.04))
            self.friendliness = max(0.0, min(1.0, self.friendliness - 0.04))
        else:
            self.ferocity = max(0.0, min(1.0, self.ferocity - 0.08))
            self.caution = max(0.0, min(1.0, self.caution + 0.06))
        self.aggression = self.ferocity
        self.fear = self.caution

    def record_choice(
        self,
        tick: int,
        choice: str,  # "friend", "bribe", "flee", "retaliate", "fight"
        opponent_id: str,
        opponent_caste: str,
        opponent_title: str,
        outcome: str,
        energy_delta: float,
        details: str,
        trait_deltas: Optional[Dict[str, str]] = None,
    ) -> None:
        """Зафиксировать выбор агента в столкновении и последствия этого выбора."""
        entry = {
            "tick": tick,
            "choice": choice,
            "opponent_id": opponent_id,
            "opponent_caste": opponent_caste,
            "opponent_title": opponent_title,
            "outcome": outcome,
            "energy_delta": round(energy_delta, 1),
            "resulting_energy": round(self.energy, 1),
            "details": details,
            "trait_deltas": trait_deltas or {},
            "resulting_title": self.character_title,
        }
        self.choice_chronicle.append(entry)
        if len(self.choice_chronicle) > 60:
            self.choice_chronicle.pop(0)

    def consume_energy(self, amount: float) -> None:
        """Потребление энергии за тик."""
        self.energy -= amount
        if self.energy < 0:
            self.energy = 0.0

    def can_reproduce(self, threshold: float) -> bool:
        """Проверка достаточности энергии для размножения."""
        return self.is_alive and self.energy >= threshold

    def reproduce(
        self,
        child_id: str,
        child_x: int,
        child_y: int,
        cost: float,
        rng: random.Random,
    ) -> "Agent":
        """Создать потомка, передав ему касту и характер предка со случайной мутацией."""
        self.energy -= cost
        if self.energy < 0:
            self.energy = 0.0
            
        mutation_rate = 0.5
        child_w_temp = self.w_temp + rng.gauss(0, mutation_rate)
        child_w_swarm = self.w_swarm + rng.gauss(0, mutation_rate)
        child_caste = self.caste
        
        # Наследование черт характера с небольшим дрейфом (nature + nurture)
        child_ferocity = max(0.0, min(1.0, self.ferocity + rng.gauss(0, 0.08)))
        child_friendliness = max(0.0, min(1.0, self.friendliness + rng.gauss(0, 0.08)))
        child_courage = max(0.0, min(1.0, self.courage + rng.gauss(0, 0.08)))
        child_diplomacy = max(0.0, min(1.0, self.diplomacy + rng.gauss(0, 0.08)))
        child_caution = max(0.0, min(1.0, self.caution + rng.gauss(0, 0.08)))
        child_territorial = max(-1.0, min(1.0, self.territorial + rng.gauss(0, 0.15)))
        
        return Agent(
            agent_id=child_id,
            x=child_x,
            y=child_y,
            energy=cost,
            age=0,
            generation=self.generation + 1,
            parent_id=self.id,
            w_temp=child_w_temp,
            w_swarm=child_w_swarm,
            territorial=child_territorial,
            caste=child_caste,
            ferocity=child_ferocity,
            friendliness=child_friendliness,
            courage=child_courage,
            diplomacy=child_diplomacy,
            caution=child_caution,
            choice_history={"friend": 0, "fight": 0, "bribe": 0, "flee": 0, "retaliate": 0},
        )

    def die(self, reason: str, tick: int) -> None:
        """Зафиксировать гибель агента."""
        self.is_alive = False
        self.death_reason = reason
        self.death_tick = tick

    def as_dict(self, current_zone: Optional[str] = None) -> Dict[str, Any]:
        """Сериализация агента в словарь для API."""
        strategy = "Кооперация (термофоб)" if self.w_swarm > 0 and self.w_temp < 0 else (
            "Одиночка (термофоб)" if self.w_swarm <= 0 and self.w_temp < 0 else (
                "Экстремал-стайный" if self.w_swarm > 0 else "Экстремал-одиночка"
            )
        )
        data = {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "energy": round(self.energy, 2),
            "age": self.age,
            "generation": self.generation,
            "parent_id": self.parent_id,
            "is_alive": self.is_alive,
            "caste": self.caste,
            "character_title": self.character_title,
            "character": {
                "ferocity": round(self.ferocity, 3),
                "friendliness": round(self.friendliness, 3),
                "courage": round(self.courage, 3),
                "diplomacy": round(self.diplomacy, 3),
                "caution": round(self.caution, 3),
            },
            "choices": dict(self.choice_history),
            "choice_chronicle": list(self.choice_chronicle),
            "aggression": round(self.aggression, 3),
            "fear": round(self.fear, 3),
            "carnivore": round(self.carnivore, 3),
            "altruism": round(self.altruism, 3),
            "territorial": round(self.territorial, 3),
            "archetype": self.archetype,
            "fights_won": self.fights_won,
            "fights_lost": self.fights_lost,
            "kills": self.kills,
            "energy_shared": round(self.energy_shared, 2),
            "energy_received": round(self.energy_received, 2),
            "predation_energy": round(self.predation_energy, 2),
            "learning": {
                "w_temp": round(self.w_temp, 4),
                "w_swarm": round(self.w_swarm, 4),
                "caste": self.caste,
                "character_title": self.character_title,
                "ferocity": round(self.ferocity, 4),
                "friendliness": round(self.friendliness, 4),
                "courage": round(self.courage, 4),
                "diplomacy": round(self.diplomacy, 4),
                "caution": round(self.caution, 4),
                "choices": dict(self.choice_history),
                "aggression": round(self.aggression, 4),
                "fear": round(self.fear, 4),
                "carnivore": round(self.carnivore, 4),
                "altruism": round(self.altruism, 4),
                "territorial": round(self.territorial, 4),
                "generation": self.generation,
                "strategy": strategy,
                "archetype": self.archetype,
                "mutation_rate": 0.5,
            },
        }
        if current_zone is not None:
            data["zone"] = current_zone
        if not self.is_alive:
            data["death_reason"] = self.death_reason
            data["death_tick"] = self.death_tick
        return data
