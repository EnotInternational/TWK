"""Процедурная генерация рельефа и скал с использованием 2D-шума Перлина.

Обеспечивает естественное кластерное распределение («кучками» и горными грядами)
вместо равномерного случайного шума.
Поддерживает бесшовное горизонтальное смыкание (периодичность по оси X)
для цилиндрических и сферических проекций планет.
"""

import math
import random
from typing import List, Set, Tuple


class PerlinNoise2D:
    """Генератор 2D шума Перлина (Ken Perlin's Improved Noise).

    Поддерживает:
    - Детерминированную инициализацию от заданного сида.
    - Квинтическую интерполяцию f(t) = 6t^5 - 15t^4 + 10t^3 с нулевыми 1-й и 2-й производными на концах.
    - Горизонтальную периодичность по оси X (тайлинг на окружности планеты).
    - Фрактальное броуновское движение (fBm / многооктавный шум).
    """

    GRADIENTS = [
        (1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0),
        (0.70710678, 0.70710678), (-0.70710678, 0.70710678),
        (0.70710678, -0.70710678), (-0.70710678, -0.70710678)
    ]

    def __init__(self, seed: int = 42) -> None:
        self.seed = seed
        rng = random.Random(seed)
        p = list(range(256))
        rng.shuffle(p)
        self.p = p + p

    @staticmethod
    def _fade(t: float) -> float:
        """Квинтическая сглаживающая функция: 6t^5 - 15t^4 + 10t^3."""
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

    @staticmethod
    def _lerp(a: float, b: float, t: float) -> float:
        return a + t * (b - a)

    def sample(self, x: float, y: float, period_x: int = 0) -> float:
        """Вычислить значение базового шума Перлина в точке (x, y).

        Если period_x > 0, координата X циклически повторяется с периодом period_x решетки.
        """
        x0_raw = math.floor(x)
        y0_raw = math.floor(y)

        dx = x - x0_raw
        dy = y - y0_raw

        if period_x > 0:
            x0 = x0_raw % period_x
            x1 = (x0 + 1) % period_x
        else:
            x0 = x0_raw & 255
            x1 = (x0 + 1) & 255

        y0 = y0_raw & 255
        y1 = (y0 + 1) & 255

        u = self._fade(dx)
        v = self._fade(dy)

        # Вычисление псевдослучайных градиентов по 4 углам ячейки
        p = self.p
        g00 = self.GRADIENTS[p[p[x0 % 256] + y0] % 8]
        g10 = self.GRADIENTS[p[p[x1 % 256] + y0] % 8]
        g01 = self.GRADIENTS[p[p[x0 % 256] + y1] % 8]
        g11 = self.GRADIENTS[p[p[x1 % 256] + y1] % 8]

        dot00 = g00[0] * dx + g00[1] * dy
        dot10 = g10[0] * (dx - 1.0) + g10[1] * dy
        dot01 = g01[0] * dx + g01[1] * (dy - 1.0)
        dot11 = g11[0] * (dx - 1.0) + g11[1] * (dy - 1.0)

        nx0 = self._lerp(dot00, dot10, u)
        nx1 = self._lerp(dot01, dot11, u)
        return self._lerp(nx0, nx1, v)

    def fbm(
        self,
        x: float,
        y: float,
        octaves: int = 2,
        persistence: float = 0.45,
        lacunarity: float = 2.0,
        period_x: int = 0
    ) -> float:
        """Фрактальное броуновское движение (fBm) для природной изрезанности форм."""
        total = 0.0
        frequency = 1.0
        amplitude = 1.0
        max_value = 0.0

        for _ in range(octaves):
            px = int(period_x * frequency) if period_x > 0 else 0
            total += self.sample(x * frequency, y * frequency, period_x=px) * amplitude
            max_value += amplitude
            amplitude *= persistence
            frequency *= lacunarity

        return total / max_value if max_value > 0 else 0.0


def generate_rock_clusters(
    width: int,
    height: int,
    rocks_count: int,
    seed: int = 42,
    cluster_scale: float = 8.0,
) -> Set[Tuple[int, int]]:
    """Сгенерировать координаты скал, сгруппированных в естественные кластеры («кучки»).

    Args:
        width: Ширина сетки симуляции.
        height: Высота сетки симуляции.
        rocks_count: Требуемое количество скал.
        seed: Сид псевдослучайного генератора (для детерминированности).
        cluster_scale: Длина волны/масштаб кластеров в клетках сетки (по умолчанию ~8 клеток).

    Returns:
        Множество уникальных координат (x, y) скал.
    """
    total_cells = width * height
    target_count = max(0, min(rocks_count, total_cells))

    if target_count == 0:
        return set()

    if target_count >= total_cells:
        return {(x, y) for x in range(width) for y in range(height)}

    # Рассчитываем период по X для бесшовного смыкания долгот планеты
    period_x = max(2, int(round(width / cluster_scale)))
    scale_x = width / period_x
    scale_y = scale_x

    noise = PerlinNoise2D(seed=seed)

    coords_with_noise: List[Tuple[float, int, int]] = []
    for y in range(height):
        for x in range(width):
            val = noise.fbm(
                x / scale_x,
                y / scale_y,
                octaves=2,
                persistence=0.45,
                lacunarity=2.0,
                period_x=period_x
            )
            # Сохраняем (-val, y, x) для строго детерминированной сортировки по убыванию высоты
            coords_with_noise.append((-val, y, x))

    # Сортируем: максимальные значения шума (пики рельефа) идут первыми
    coords_with_noise.sort()

    # Выбираем вершины и окружающие их гряды
    selected_rocks: Set[Tuple[int, int]] = set()
    for _, y, x in coords_with_noise[:target_count]:
        selected_rocks.add((x, y))

    return selected_rocks
