import pytest
from simulation.engine import SimulationConfig, SimulationEngine


def test_deterministic_reproducibility():
    """Тест главного научного критерия: одинаковый сид даёт одинаковый результат."""
    seed = 9999
    cfg1 = SimulationConfig(seed=seed, initial_agents=30, cycle_ticks=50)
    cfg2 = SimulationConfig(seed=seed, initial_agents=30, cycle_ticks=50)

    e1 = SimulationEngine(cfg1)
    e2 = SimulationEngine(cfg2)

    # Проверяем совпадение на каждом из 30 шагов
    for tick in range(1, 31):
        snap1 = e1.step()
        snap2 = e2.step()

        assert snap1["tick"] == snap2["tick"]
        assert snap1["state_hash"] == snap2["state_hash"]
        assert len(snap1["agents"]) == len(snap2["agents"])
        assert snap1["metrics"]["alive_count"] == snap2["metrics"]["alive_count"]
        assert snap1["metrics"]["avg_energy"] == snap2["metrics"]["avg_energy"]


def test_different_seeds_diverge():
    """Разные сиды должны давать разные результаты."""
    cfg1 = SimulationConfig(seed=111, initial_agents=30)
    cfg2 = SimulationConfig(seed=222, initial_agents=30)

    e1 = SimulationEngine(cfg1)
    e2 = SimulationEngine(cfg2)

    e1.run_batch(20)
    e2.run_batch(20)

    assert e1.get_state_hash() != e2.get_state_hash()
