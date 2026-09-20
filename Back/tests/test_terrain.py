import random
import pytest
from simulation.terrain import PerlinNoise2D, generate_rock_clusters
from simulation.engine import SimulationConfig, SimulationEngine


def test_rock_clusters_count():
    width, height = 60, 30

    # 1. Zero rocks
    rocks_0 = generate_rock_clusters(width, height, rocks_count=0, seed=42)
    assert len(rocks_0) == 0

    # 2. Specific count
    rocks_50 = generate_rock_clusters(width, height, rocks_count=50, seed=42)
    assert len(rocks_50) == 50

    # 3. All coords
    total = width * height
    rocks_all = generate_rock_clusters(width, height, rocks_count=total + 100, seed=42)
    assert len(rocks_all) == total


def test_rock_clusters_clustering_metric():
    """Тест того, что скалы группируются кучками, а не разбросаны хаотично."""
    width, height = 60, 30
    rocks_count = 50
    seed = 42

    # Кластеры на основе шума Перлина
    perlin_rocks = generate_rock_clusters(width, height, rocks_count=rocks_count, seed=seed)

    # Вычисляем среднее число 8-соседей у каждой скалы
    def compute_avg_neighbors(rock_set, w, h):
        counts = []
        for rx, ry in rock_set:
            neighbors = 0
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx = (rx + dx) % w
                    ny = ry + dy
                    if (nx, ny) in rock_set:
                        neighbors += 1
            counts.append(neighbors)
        return sum(counts) / len(counts) if counts else 0.0

    perlin_avg = compute_avg_neighbors(perlin_rocks, width, height)

    # Сравнение с чисто случайным распределением
    rng = random.Random(seed)
    all_coords = [(x, y) for x in range(width) for y in range(height)]
    rng.shuffle(all_coords)
    random_rocks = set(all_coords[:rocks_count])
    random_avg = compute_avg_neighbors(random_rocks, width, height)

    # В шуме Перлина среднее число соседей должно быть в разы выше (обычно > 2.5 против ~ 0.2 у рандома)
    assert perlin_avg > 2.0
    assert perlin_avg > random_avg * 4.0


def test_rock_clusters_determinism():
    """Одинаковый сид дает одинаковые скалы, разные сиды — разные."""
    width, height = 50, 25
    rocks_count = 30

    rocks_a = generate_rock_clusters(width, height, rocks_count=rocks_count, seed=12345)
    rocks_b = generate_rock_clusters(width, height, rocks_count=rocks_count, seed=12345)
    rocks_c = generate_rock_clusters(width, height, rocks_count=rocks_count, seed=54321)

    assert rocks_a == rocks_b
    assert rocks_a != rocks_c


def test_simulation_engine_integration_with_clustered_rocks():
    """Интеграция с движком: скалы инициализируются и агенты не накладываются на них."""
    cfg = SimulationConfig(
        seed=100,
        width=40,
        height=20,
        initial_agents=25,
        rocks_count=40
    )
    engine = SimulationEngine(cfg)

    # Проверяем, что создано ровно 40 скал
    assert len(engine.rocks) == 40

    # Проверяем, что создано 25 агентов
    assert len(engine.agents) == 25

    # Ни один агент не должен стоять на скале
    for agent in engine.agents.values():
        assert (agent.x, agent.y) not in engine.rocks

    # Шаг симуляции выполняется без ошибок
    snap = engine.step()
    assert snap["tick"] == 1
    assert len(snap["environment"]["rocks"]) == 40
