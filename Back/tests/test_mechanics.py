import pytest
from simulation.agent import Agent
from simulation.engine import SimulationConfig, SimulationEngine


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
