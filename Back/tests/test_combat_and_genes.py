"""Тесты для Этапа 1: Гены агрессии и страха, поведенческий выбор (бой / бегство), статистика.
"""

import random
import pytest
from simulation.agent import Agent
from simulation.engine import SimulationConfig, SimulationEngine
from simulation.events import EventType


def test_agent_genes_initialization_and_archetypes():
    # Агрессивный архетип
    aggr_agent = Agent("aggr", x=0, y=0, aggression=0.8, fear=0.2)
    assert aggr_agent.aggression == 0.8
    assert aggr_agent.fear == 0.2
    assert aggr_agent.archetype in ("aggressive", "predator")

    # Пассивный архетип (беглец)
    passive_agent = Agent("pass", x=0, y=0, aggression=0.1, fear=0.7)
    assert passive_agent.archetype in ("passive", "fleeing_prey")

    # Нейтральный / сбалансированный
    neutral_agent = Agent("neut", x=0, y=0, aggression=0.4, fear=0.4)
    assert neutral_agent.archetype in ("neutral", "opportunist")


def test_genes_inheritance_and_bounds():
    rng = random.Random(42)
    parent = Agent("p1", x=0, y=0, energy=150.0, aggression=0.95, fear=0.05)
    
    # Рождаем несколько потомков и проверяем границы [0.0, 1.0]
    for i in range(10):
        child = parent.reproduce(f"c{i}", child_x=0, child_y=1, cost=40.0, rng=rng)
        assert 0.0 <= child.aggression <= 1.0
        assert 0.0 <= child.fear <= 1.0
        assert child.fights_won == 0
        assert child.kills == 0


def test_agent_serialization_includes_new_fields():
    agent = Agent("a1", x=3, y=4, energy=85.0, aggression=0.75, fear=0.15)
    agent.fights_won = 2
    agent.kills = 1
    d = agent.as_dict()

    assert d["aggression"] == 0.75
    assert d["fear"] == 0.15
    assert d["archetype"] in ("aggressive", "predator")
    assert d["fights_won"] == 2
    assert d["kills"] == 1
    assert "learning" in d
    assert d["learning"]["aggression"] == 0.75
    assert d["learning"]["fear"] == 0.15


def test_combat_mechanics_and_events():
    cfg = SimulationConfig(
        seed=123,
        width=10,
        height=10,
        initial_agents=0,
        base_metabolism=0.0,
        penalty_hot=0.0,
        penalty_cold=0.0,
    )
    engine = SimulationEngine(cfg)

    # Ставим агрессора рядом с пассивным агентом
    attacker = Agent("att", x=5, y=5, energy=100.0, aggression=0.9, fear=0.0)
    defender = Agent("def", x=6, y=5, energy=30.0, aggression=0.1, fear=0.8)
    engine.agents["att"] = attacker
    engine.agents["def"] = defender

    # Выполняем тик симуляции
    engine.step()

    # Проверяем, что произошел бой или бегство
    fight_events = [e for e in engine.events.get_events(limit=50) if e["type"] in ("FIGHT", "FLEE", "DEATH_COMBAT")]
    assert len(fight_events) > 0

    latest_metrics = engine.metrics.get_latest()
    assert latest_metrics["fights"] >= 1
    assert latest_metrics["cumulative_fights"] >= 1
    assert "archetypes" in latest_metrics


def test_metrics_collection_for_archetypes_and_combat():
    cfg = SimulationConfig(
        seed=777,
        width=20,
        height=20,
        initial_agents=20,
        starting_energy=100.0,
    )
    engine = SimulationEngine(cfg)

    # Делаем 5 шагов
    for _ in range(5):
        engine.step()

    metrics = engine.metrics.get_latest()
    assert "avg_aggression" in metrics
    assert "avg_fear" in metrics
    assert "archetypes" in metrics
    assert isinstance(metrics["archetypes"], dict)
    assert sum(metrics["archetypes"].values()) == metrics["alive_count"]
    assert metrics["cumulative_fights"] >= 0


def test_deterministic_combat_reproducibility():
    """Проверка строгой повторяемости боевых исходов при одинаковом seed."""
    cfg1 = SimulationConfig(seed=555, initial_agents=30, cycle_ticks=40)
    cfg2 = SimulationConfig(seed=555, initial_agents=30, cycle_ticks=40)

    e1 = SimulationEngine(cfg1)
    e2 = SimulationEngine(cfg2)

    for tick in range(1, 25):
        snap1 = e1.step()
        snap2 = e2.step()
        assert snap1["state_hash"] == snap2["state_hash"]
        assert snap1["metrics"]["fights"] == snap2["metrics"]["fights"]
        assert snap1["metrics"]["cumulative_fights"] == snap2["metrics"]["cumulative_fights"]
        assert snap1["metrics"]["avg_aggression"] == snap2["metrics"]["avg_aggression"]
        assert snap1["metrics"]["avg_fear"] == snap2["metrics"]["avg_fear"]
