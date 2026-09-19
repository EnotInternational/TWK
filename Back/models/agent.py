"""Модель агента и логика его создания."""

import random
import uuid
from typing import Any, Dict, Set


def create_agent(field_w: int, field_h: int, occupied: Set[tuple]) -> Dict[str, Any]:
    """Создать агента со случайными координатами (не пересекается с occupied) и голодом."""
    while True:
        x = random.randint(0, field_w - 1)
        y = random.randint(0, field_h - 1)
        if (x, y) not in occupied:
            occupied.add((x, y))
            break

    return {
        "id": str(uuid.uuid4())[:8],
        "x": x,
        "y": y,
        "hunger": random.randint(0, 100),
    }


def create_agents(count: int, field_w: int, field_h: int) -> list:
    """Создать пачку агентов без пересечений."""
    occupied: Set[tuple] = set()
    return [create_agent(field_w, field_h, occupied) for _ in range(count)]