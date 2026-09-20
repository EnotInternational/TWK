import pytest
from simulation.agent import Agent
from simulation.engine import SimulationConfig, SimulationEngine
from simulation.environment import Zone


def test_agent_lifecycle():
    agent = Agent(agent_id="test_01", x=10, y=10, energy=50.0)
    agent.consume_energy(20.0)
    assert agent.energy == 30.0
    assert agent.is_alive is True

    agent.consume_energy(40.0)
    assert agent.energy == 0.0
    agent.die("exhaustion", tick=5)
    assert agent.is_alive is False
    assert agent.death_reason == "exhaustion"
    assert agent.death_tick == 5


def test_agent_reproduction():
    parent = Agent(agent_id="parent_01", x=5, y=5, energy=160.0)
    assert parent.can_reproduce(threshold=150.0) is True

    import random
    child = parent.reproduce(
        child_id="child_01", 
        child_x=5, 
        child_y=6, 
        cost=50.0,
        rng=random.Random(42)
    )
    assert parent.energy == 110.0
    assert child.id == "child_01"
    assert child.x == 5
    assert child.y == 6
    assert child.energy == 50.0
    assert child.generation == 1
    assert child.parent_id == "parent_01"


def test_extinction_when_no_energy():
    # Симуляция с очень высоким расходом энергии должна быстро закончиться вымиранием
    cfg = SimulationConfig(
        seed=1,
        initial_agents=5,
        starting_energy=5.0,
        base_metabolism=10.0,
        penalty_hot=10.0,
        penalty_cold=10.0,
    )
    engine = SimulationEngine(cfg)
    assert engine.status == "idle"

    # За 1 шаг все должны умереть
    engine.step()
    assert engine.status == "extinct"
    latest_metrics = engine.metrics.get_latest()
    assert latest_metrics["alive_count"] == 0


def test_meteorite_destroys_rocks_and_leaves_center():
    cfg = SimulationConfig(seed=42, width=40, height=20, initial_agents=0, rocks_count=0)
    engine = SimulationEngine(cfg)
    
    # Manually add rocks
    engine.rocks.add((10, 10))
    engine.rocks.add((11, 10))
    engine.rocks.add((10, 11))
    engine.rocks.add((30, 15))  # Distant rock
    
    assert len(engine.rocks) == 4
    
    # Throw meteorite at (10, 10) with radius 2.0
    engine.throw_meteorite(target_x=10, target_y=10, radius=2.0)
    
    # Central rock remains ("в центре остается скала и не исчезает")
    assert (10, 10) in engine.rocks
    # Rocks near (10, 10) within blast radius must be destroyed
    assert (11, 10) not in engine.rocks
    assert (10, 11) not in engine.rocks
    
    # Distant rock must remain
    assert (30, 15) in engine.rocks
    assert len(engine.rocks) == 2


def test_meteorite_damage_radial_falloff():
    cfg = SimulationConfig(seed=42, width=40, height=20, initial_agents=0, rocks_count=0)
    engine = SimulationEngine(cfg)

    # 1. Agent in epicenter (10, 10) with max energy
    a_epicenter = Agent(agent_id="center", x=10, y=10, energy=200.0)
    # 2. Agent in mid zone (12, 10) -> dist = 2.0 (radius = 3.0) with high energy
    a_mid = Agent(agent_id="mid", x=12, y=10, energy=150.0)
    # 3. Agent near boundary (10, 13) -> dist = 3.0
    a_edge = Agent(agent_id="edge", x=10, y=13, energy=100.0)
    # 4. Agent outside (10, 16) -> dist = 6.0
    a_far = Agent(agent_id="far", x=10, y=16, energy=100.0)

    engine.agents = {
        a_epicenter.id: a_epicenter,
        a_mid.id: a_mid,
        a_edge.id: a_edge,
        a_far.id: a_far,
    }

    engine.throw_meteorite(target_x=10, target_y=10, radius=3.0)

    # Epicenter: all agents die
    assert a_epicenter.is_alive is False

    # Mid distance: took partial damage, alive
    assert a_mid.is_alive is True
    assert 0 < a_mid.energy < 150.0

    # Far agent: undamaged
    assert a_far.is_alive is True
    assert a_far.energy == 100.0


def test_meteorite_creates_depth_levels_and_central_rock():
    """Метеорит оставляет в центре скалу, вокруг глубокие (2) и по краям обычные (1) углубления."""
    config = SimulationConfig(width=60, height=30)
    engine = SimulationEngine(config)

    engine.throw_meteorite(target_x=20, target_y=15, radius=4.0)

    # В центре скала
    assert (20, 15) in engine.rocks

    # Внутренний радиус (dist <= 2.0) -> уровень 2 (глубокая)
    assert engine.depressions.get((21, 15)) == 2
    assert engine.depressions.get((20, 16)) == 2

    # Внешний радиус (2.0 < dist <= 4.0) -> уровень 1 (обычная)
    assert engine.depressions.get((23, 15)) == 1

    # За пределами радиуса -> нет углубления
    assert (26, 15) not in engine.depressions


def test_depression_thermal_oasis_under_sun():
    """В углублении холод: при освещении солнцем (HOT) образуется пригодная для жизни среда (TERMINATOR)."""
    config = SimulationConfig(width=60, height=30, cycle_ticks=200)
    engine = SimulationEngine(config)

    # При tick=0 sun_x = 0.0. Клетка (0, 15) находится в самом центре зоны HOT
    assert engine.env.get_zone(0, 15, tick=0) == Zone.HOT
    assert engine.get_effective_zone(0, 15, tick=0) == Zone.HOT

    # Добавляем углубление 1 уровня
    engine.add_depression(0, 15, level=1, size=1)
    # Теперь под солнцем образуется пригодный для жизни оазис
    assert engine.get_effective_zone(0, 15, tick=0) == Zone.TERMINATOR

    # На темной стороне (x=30, COLD) углубление остается COLD
    assert engine.env.get_zone(30, 15, tick=0) == Zone.COLD
    engine.add_depression(30, 15, level=1, size=1)
    assert engine.get_effective_zone(30, 15, tick=0) == Zone.COLD


def test_radial_wind_pushes_agents_outward():
    """Ветер сдувает агентов радиально от центра нажатия во все стороны."""
    config = SimulationConfig(width=60, height=30)
    engine = SimulationEngine(config)

    # Размещаем 4 агентов вокруг эпицентра (20, 15) на расстоянии 2 клеток
    a_east = Agent(agent_id="east", x=22, y=15, energy=100.0)
    a_west = Agent(agent_id="west", x=18, y=15, energy=100.0)
    a_south = Agent(agent_id="south", x=20, y=17, energy=100.0)
    a_north = Agent(agent_id="north", x=20, y=13, energy=100.0)

    engine.agents = {
        a_east.id: a_east,
        a_west.id: a_west,
        a_south.id: a_south,
        a_north.id: a_north,
    }

    # Применяем радиальный ветер в (20, 15) с силой 7
    engine.apply_wind(target_x=20, target_y=15, strength=7)

    # Все агенты должны быть отброшены наружу от центра
    assert a_east.x > 22  # отброшен еще дальше на восток
    assert a_west.x < 18  # отброшен еще дальше на запад
    assert a_south.y > 17  # отброшен на юг
    assert a_north.y < 13  # отброшен на север


def test_eraser_removes_rocks_and_depressions():
    """Ластик удаляет и скалы, и углубления в радиусе."""
    config = SimulationConfig(width=60, height=30)
    engine = SimulationEngine(config)

    engine.add_rocks(10, 10, size=3)
    engine.add_depression(10, 10, level=2, size=3)

    assert len(engine.rocks) > 0
    assert len(engine.depressions) > 0

    # Стираем ластиком
    engine.remove_rocks(10, 10, radius=3.0)

    assert (10, 10) not in engine.rocks
    assert (10, 10) not in engine.depressions



