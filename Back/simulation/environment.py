"""Модель среды Меркурия.

Описывает движение Солнца, смену дня и ночи, температурные зоны (Hot, Cold, Terminator)
и штрафы к энергии агентов в зависимости от зоны.
"""

from enum import Enum
from typing import Any, Dict, List, Tuple


class Zone(str, Enum):
    HOT = "hot"                # Освещенная сторона (смертоносная жара)
    COLD = "cold"              # Темная сторона (смертоносный холод)
    TERMINATOR = "terminator"  # Полоса сумерек между светом и тенью (комфортная зона)


class MercuryEnvironment:
    """Окружающая среда поверхности Меркурия."""

    def __init__(
        self,
        width: int = 60,
        height: int = 30,
        cycle_ticks: int = 200,
        terminator_width: int = 4,
        penalty_hot: float = 3.0,
        penalty_cold: float = 3.0,
        penalty_terminator: float = 0.0,
    ) -> None:
        self.width = width
        self.height = height
        self.cycle_ticks = max(1, cycle_ticks)
        self.terminator_width = max(1, terminator_width)
        self.penalty_hot = penalty_hot
        self.penalty_cold = penalty_cold
        self.penalty_terminator = penalty_terminator

    def get_sun_x(self, tick: int) -> float:
        """Координата подсолнечной точки (зенита) на текущем тике."""
        return (tick % self.cycle_ticks) / self.cycle_ticks * self.width

    def _circular_distance(self, x1: float, x2: float) -> float:
        """Кратчайшее расстояние по окружности длины self.width."""
        dx = abs(x1 - x2) % self.width
        return min(dx, self.width - dx)

    def get_zone(self, x: int, y: int, tick: int) -> Zone:
        """Определить температурную зону в клетке (x, y) на заданном тике.

        Окружность планеты = width:
        - Подсолнечная точка: sun_x
        - Терминаторы находятся на расстоянии width / 4 с обеих сторон от sun_x.
        - Если расстояние от клетки до ближайшего терминатора <= terminator_width / 2,
          это зона TERMINATOR.
        - Иначе, если расстояние до sun_x < width / 4, это зона HOT (дневная сторона).
        - Иначе это зона COLD (ночная сторона).
        """
        sun_x = self.get_sun_x(tick)
        dist_to_sun = self._circular_distance(x + 0.5, sun_x)

        # Расстояние от центра дня до линии терминатора
        quarter_orbit = self.width / 4.0
        dist_to_terminator = abs(dist_to_sun - quarter_orbit)

        if dist_to_terminator <= (self.terminator_width / 2.0):
            return Zone.TERMINATOR
        elif dist_to_sun < quarter_orbit:
            return Zone.HOT
        else:
            return Zone.COLD

    def get_energy_penalty(self, zone: Zone) -> float:
        """Штраф к расходу энергии в зависимости от зоны."""
        if zone == Zone.HOT:
            return self.penalty_hot
        elif zone == Zone.COLD:
            return self.penalty_cold
        elif zone == Zone.TERMINATOR:
            return self.penalty_terminator
        return 0.0

    def get_terminator_bands(self, tick: int) -> List[Dict[str, float]]:
        """Границы двух полос терминатора (утренний и вечерний) для фронтенда/Canvas."""
        sun_x = self.get_sun_x(tick)
        quarter = self.width / 4.0
        half_w = self.terminator_width / 2.0

        t1_center = (sun_x - quarter) % self.width
        t2_center = (sun_x + quarter) % self.width

        return [
            {
                "id": "terminator_1",
                "center_x": round(t1_center, 2),
                "min_x": round((t1_center - half_w) % self.width, 2),
                "max_x": round((t1_center + half_w) % self.width, 2),
                "width": self.terminator_width,
            },
            {
                "id": "terminator_2",
                "center_x": round(t2_center, 2),
                "min_x": round((t2_center - half_w) % self.width, 2),
                "max_x": round((t2_center + half_w) % self.width, 2),
                "width": self.terminator_width,
            },
        ]

    def get_state(self, tick: int) -> Dict[str, Any]:
        """Состояние среды для передачи на фронтенд."""
        return {
            "width": self.width,
            "height": self.height,
            "cycle_ticks": self.cycle_ticks,
            "sun_x": round(self.get_sun_x(tick), 2),
            "terminator_width": self.terminator_width,
            "terminator_bands": self.get_terminator_bands(tick),
            "penalties": {
                "hot": self.penalty_hot,
                "cold": self.penalty_cold,
                "terminator": self.penalty_terminator,
            },
        }
