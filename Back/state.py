"""Глобальное состояние поля.

Хранится в памяти. Все эндпоинты работают через этот модуль,
чтобы в будущем можно было заменить на Redis/SQLite без правок API.
"""

from typing import Any, Dict, List, Optional


class FieldState:
    def __init__(self) -> None:
        self._width: int = 0
        self._height: int = 0
        self._agents: List[Dict[str, Any]] = []

    # --- Поле ---------------------------------------------------------------
    def init(self, width: int, height: int, agents: List[Dict[str, Any]]) -> None:
        self._width = width
        self._height = height
        self._agents = agents

    def clear(self) -> None:
        self._width = 0
        self._height = 0
        self._agents = []

    @property
    def width(self) -> int:
        return self._width

    @property
    def height(self) -> int:
        return self._height

    @property
    def agents(self) -> List[Dict[str, Any]]:
        return self._agents

    def as_dict(self) -> Dict[str, Any]:
        return {
            "width": self._width,
            "height": self._height,
            "agents": self._agents,
        }

    # --- Агенты -------------------------------------------------------------
    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        for agent in self._agents:
            if agent["id"] == agent_id:
                return agent
        return None

    def occupied_cells(self) -> set:
        return {(a["x"], a["y"]) for a in self._agents}


# Единственный экземпляр на всё приложение
field_state = FieldState()