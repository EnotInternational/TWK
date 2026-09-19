import pytest
from simulation.environment import MercuryEnvironment, Zone


def test_sun_movement():
    env = MercuryEnvironment(width=100, height=50, cycle_ticks=100)
    assert env.get_sun_x(0) == 0.0
    assert env.get_sun_x(25) == 25.0
    assert env.get_sun_x(50) == 50.0
    assert env.get_sun_x(100) == 0.0  # Полный оборот
    assert env.get_sun_x(125) == 25.0


def test_zones_distribution():
    # width=100, terminator_width=4
    # sun_x at 0
    # terminator lines at x=25 and x=75
    # terminator bands: [23..27] and [73..77]
    env = MercuryEnvironment(width=100, height=50, cycle_ticks=100, terminator_width=4)

    # В подсолнечной точке x=0 (день -> hot)
    assert env.get_zone(0, 10, tick=0) == Zone.HOT
    assert env.get_zone(10, 10, tick=0) == Zone.HOT

    # В терминаторе x=25 (между днем и ночью)
    assert env.get_zone(25, 10, tick=0) == Zone.TERMINATOR
    assert env.get_zone(75, 10, tick=0) == Zone.TERMINATOR

    # В глубокой тени x=50 (полночь -> cold)
    assert env.get_zone(50, 10, tick=0) == Zone.COLD


def test_penalties():
    env = MercuryEnvironment(penalty_hot=5.0, penalty_cold=4.0, penalty_terminator=0.5)
    assert env.get_energy_penalty(Zone.HOT) == 5.0
    assert env.get_energy_penalty(Zone.COLD) == 4.0
    assert env.get_energy_penalty(Zone.TERMINATOR) == 0.5
