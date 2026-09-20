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
        
        # Гены поведения, питания и социальности
        self.w_temp = float(w_temp)
        self.w_swarm = float(w_swarm)
        self.aggression = max(0.0, min(1.0, float(aggression)))
        self.fear = max(0.0, min(1.0, float(fear)))
        self.carnivore = max(0.0, min(1.0, float(carnivore)))
        self.altruism = max(0.0, min(1.0, float(altruism)))
        self.territorial = max(-1.0, min(1.0, float(territorial)))

        # Индивидуальная статистика поведения, боев и социальности
        self.fights_won = 0
        self.fights_lost = 0
        self.kills = 0
        self.energy_shared = 0.0
        self.energy_received = 0.0
        self.predation_energy = 0.0

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
        """Создать потомка, передав ему часть энергии и мутировавшие гены."""
        self.energy -= cost
        if self.energy < 0:
            self.energy = 0.0
            
        # Мутация генов (случайное блуждание)
        mutation_rate = 0.5
        child_w_temp = self.w_temp + rng.gauss(0, mutation_rate)
        child_w_swarm = self.w_swarm + rng.gauss(0, mutation_rate)
        child_aggression = max(0.0, min(1.0, self.aggression + rng.gauss(0, 0.1)))
        child_fear = max(0.0, min(1.0, self.fear + rng.gauss(0, 0.1)))
        child_carnivore = max(0.0, min(1.0, self.carnivore + rng.gauss(0, 0.1)))
        child_altruism = max(0.0, min(1.0, self.altruism + rng.gauss(0, 0.1)))
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
            aggression=child_aggression,
            fear=child_fear,
            carnivore=child_carnivore,
            altruism=child_altruism,
            territorial=child_territorial,
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
