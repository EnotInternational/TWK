"""Ядро симуляции Terra Nova: Mercury.

Содержит чистую логику моделирования без зависимости от Flask/HTTP:
- MercuryEnvironment: физическая среда, движение Солнца, температурные зоны.
- Agent: модель агента, расход энергии, размножение, смертность.
- EventLogger: логирование значимых событий симуляции.
- MetricsCollector: агрегация метрик для графиков и аналитики.
- SimulationEngine: главный детерминированный движок симуляции с поддержкой сидов.
"""

from .agent import Agent
from .environment import MercuryEnvironment, Zone
from .events import EventLogger, SimulationEvent, EventType
from .metrics import MetricsCollector, TickMetrics
from .engine import SimulationEngine, SimulationConfig

__all__ = [
    "Agent",
    "MercuryEnvironment",
    "Zone",
    "EventLogger",
    "SimulationEvent",
    "EventType",
    "MetricsCollector",
    "TickMetrics",
    "SimulationEngine",
    "SimulationConfig",
]
