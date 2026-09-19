"""Сбор и хранение метрик симуляции.

Позволяет фиксировать динамику популяции, уровень энергии и распределение по зонам
для построения графиков и проверки научных гипотез.
"""

from typing import Any, Dict, List, Optional


class TickMetrics:
    def __init__(
        self,
        tick: int,
        alive_count: int,
        avg_energy: float,
        min_energy: float,
        max_energy: float,
        births: int,
        deaths: int,
        cumulative_births: int,
        cumulative_deaths: int,
        hot_count: int,
        cold_count: int,
        terminator_count: int,
        terminator_ratio: float,
    ) -> None:
        self.tick = tick
        self.alive_count = alive_count
        self.avg_energy = round(avg_energy, 2)
        self.min_energy = round(min_energy, 2)
        self.max_energy = round(max_energy, 2)
        self.births = births
        self.deaths = deaths
        self.cumulative_births = cumulative_births
        self.cumulative_deaths = cumulative_deaths
        self.hot_count = hot_count
        self.cold_count = cold_count
        self.terminator_count = terminator_count
        self.terminator_ratio = round(terminator_ratio, 4)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "tick": self.tick,
            "alive_count": self.alive_count,
            "avg_energy": self.avg_energy,
            "min_energy": self.min_energy,
            "max_energy": self.max_energy,
            "births": self.births,
            "deaths": self.deaths,
            "cumulative_births": self.cumulative_births,
            "cumulative_deaths": self.cumulative_deaths,
            "distribution": {
                "hot": self.hot_count,
                "cold": self.cold_count,
                "terminator": self.terminator_count,
            },
            "terminator_ratio": self.terminator_ratio,
        }


class MetricsCollector:
    """Коллектор временных рядов метрик симуляции."""

    def __init__(self, max_history: int = 10000) -> None:
        self.max_history = max_history
        self._history: List[TickMetrics] = []
        self._cum_births = 0
        self._cum_deaths = 0

    def record(
        self,
        tick: int,
        agents: List[Any],
        environment: Any,
        births: int = 0,
        deaths: int = 0,
    ) -> TickMetrics:
        self._cum_births += births
        self._cum_deaths += deaths

        alive_agents = [a for a in agents if a.is_alive]
        alive_count = len(alive_agents)

        if alive_count > 0:
            energies = [a.energy for a in alive_agents]
            avg_energy = sum(energies) / alive_count
            min_energy = min(energies)
            max_energy = max(energies)
        else:
            avg_energy = 0.0
            min_energy = 0.0
            max_energy = 0.0

        hot_cnt = 0
        cold_cnt = 0
        term_cnt = 0

        for a in alive_agents:
            z = environment.get_zone(a.x, a.y, tick)
            if z.value == "hot":
                hot_cnt += 1
            elif z.value == "cold":
                cold_cnt += 1
            elif z.value == "terminator":
                term_cnt += 1

        term_ratio = (term_cnt / alive_count) if alive_count > 0 else 0.0

        m = TickMetrics(
            tick=tick,
            alive_count=alive_count,
            avg_energy=avg_energy,
            min_energy=min_energy,
            max_energy=max_energy,
            births=births,
            deaths=deaths,
            cumulative_births=self._cum_births,
            cumulative_deaths=self._cum_deaths,
            hot_count=hot_cnt,
            cold_count=cold_cnt,
            terminator_count=term_cnt,
            terminator_ratio=term_ratio,
        )

        self._history.append(m)
        if len(self._history) > self.max_history:
            self._history.pop(0)

        return m

    def get_latest(self) -> Optional[Dict[str, Any]]:
        if not self._history:
            return None
        return self._history[-1].as_dict()

    def get_history(
        self,
        from_tick: int = 0,
        to_tick: Optional[int] = None,
        step: int = 1,
    ) -> List[Dict[str, Any]]:
        step = max(1, step)
        filtered = [m for m in self._history if m.tick >= from_tick]
        if to_tick is not None:
            filtered = [m for m in filtered if m.tick <= to_tick]

        sliced = filtered[::step]
        return [m.as_dict() for m in sliced]

    def clear(self) -> None:
        self._history.clear()
        self._cum_births = 0
        self._cum_deaths = 0
