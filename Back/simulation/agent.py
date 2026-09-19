"""Модель агента для симуляции Terra Nova: Mercury.

Агент обладает запасом энергии, возрастом, родословной (parent_id, generation),
тратит энергию на поддержание жизни и гибнет при её истощении.
"""

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
    ) -> "Agent":
        """Создать потомка, передав ему часть энергии."""
        self.energy -= cost
        if self.energy < 0:
            self.energy = 0.0
        return Agent(
            agent_id=child_id,
            x=child_x,
            y=child_y,
            energy=cost,
            age=0,
            generation=self.generation + 1,
            parent_id=self.id,
        )

    def die(self, reason: str, tick: int) -> None:
        """Зафиксировать гибель агента."""
        self.is_alive = False
        self.death_reason = reason
        self.death_tick = tick

    def as_dict(self, current_zone: Optional[str] = None) -> Dict[str, Any]:
        """Сериализация агента в словарь для API."""
        data = {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "energy": round(self.energy, 2),
            "age": self.age,
            "generation": self.generation,
            "parent_id": self.parent_id,
            "is_alive": self.is_alive,
        }
        if current_zone is not None:
            data["zone"] = current_zone
        if not self.is_alive:
            data["death_reason"] = self.death_reason
            data["death_tick"] = self.death_tick
        return data
