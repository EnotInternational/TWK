"""Логирование значимых событий симуляции.

Фиксирует появление, размножение, гибель и вымирание популяции с номерами тиков
для исследовательской аналитики и верификации гипотез.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
import time


class EventType(str, Enum):
    SPAWN = "SPAWN"
    BIRTH = "BIRTH"
    DEATH_EXHAUSTION = "DEATH_EXHAUSTION"
    DEATH_HEAT = "DEATH_HEAT"
    DEATH_COLD = "DEATH_COLD"
    DEATH_COMBAT = "DEATH_COMBAT"
    FIGHT = "FIGHT"
    FLEE = "FLEE"
    PREDATION = "PREDATION"
    SHARE_ENERGY = "SHARE_ENERGY"
    ENCOUNTER_FRIEND = "ENCOUNTER_FRIEND"
    ENCOUNTER_BRIBE = "ENCOUNTER_BRIBE"
    ENCOUNTER_FLEE = "ENCOUNTER_FLEE"
    ENCOUNTER_RETALIATE = "ENCOUNTER_RETALIATE"
    EXTINCTION = "EXTINCTION"
    METEORITE = "METEORITE"
    WIND = "WIND"
    ROCKS = "ROCKS"
    DEPRESSION = "DEPRESSION"
    ERASER = "ERASER"

class SimulationEvent:
    def __init__(
        self,
        event_id: int,
        tick: int,
        event_type: EventType,
        agent_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        x: Optional[int] = None,
        y: Optional[int] = None,
        details: str = "",
    ) -> None:
        self.id = event_id
        self.tick = tick
        self.timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.type = event_type
        self.agent_id = agent_id
        self.parent_id = parent_id
        self.x = x
        self.y = y
        self.details = details

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "tick": self.tick,
            "timestamp": self.timestamp,
            "type": self.type.value,
            "agent_id": self.agent_id,
            "parent_id": self.parent_id,
            "coordinates": {"x": self.x, "y": self.y} if self.x is not None else None,
            "details": self.details,
        }


class EventLogger:
    """Хранилище событий симуляции с поиском и пагинацией."""

    def __init__(self, max_events: int = 5000) -> None:
        self.max_events = max_events
        self._events: List[SimulationEvent] = []
        self._next_id = 1

    def log(
        self,
        tick: int,
        event_type: EventType,
        agent_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        x: Optional[int] = None,
        y: Optional[int] = None,
        details: str = "",
    ) -> SimulationEvent:
        event = SimulationEvent(
            event_id=self._next_id,
            tick=tick,
            event_type=event_type,
            agent_id=agent_id,
            parent_id=parent_id,
            x=x,
            y=y,
            details=details,
        )
        self._next_id += 1
        self._events.append(event)
        if len(self._events) > self.max_events:
            self._events.pop(0)
        return event

    def get_events(
        self,
        since_tick: Optional[int] = None,
        event_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        filtered = self._events
        if since_tick is not None:
            filtered = [e for e in filtered if e.tick >= since_tick]
        if event_type is not None:
            event_type_upper = event_type.upper()
            filtered = [e for e in filtered if e.type.value == event_type_upper]

        # Сортировка от свежих к старым
        slice_events = list(reversed(filtered))[offset : offset + limit]
        return [e.as_dict() for e in slice_events]

    def clear(self) -> None:
        self._events.clear()
        self._next_id = 1
