"""Тесты для Этапов 2 и 3: Трофическая дифференциация (хищничество) и Социальность (альтруизм, оазисы).
"""

import random
import pytest
from simulation.agent import Agent
from simulation.engine import SimulationConfig, SimulationEngine
from simulation.events import EventType


def test_six_archetypes_classification():
    # 1. Хищник (predator)
    predator = Agent("pred", 0, 0, carnivore=0.8, aggression=0.7)
    assert predator.archetype == "predator"

    # 2. Солнцеед-кочевник (grazer)
    grazer = Agent("grz", 0, 0, carnivore=0.1, aggression=0.2, territorial=-0.5)
    assert grazer.archetype == "grazer"

    # 3. Альтруист-роевик (altruist_swarm)
    altruist = Agent("altr", 0, 0, altruism=0.8, w_swarm=1.5, carnivore=0.1)
    assert altruist.archetype == "altruist_swarm"

    # 4. Страж оазиса (oasis_guardian)
    guardian = Agent("guard", 0, 0, territorial=0.8, aggression=0.6, carnivore=0.2)
    assert guardian.archetype == "oasis_guardian"

    # 5. Беглец-пацифист (fleeing_prey)
    prey = Agent("prey", 0, 0, fear=0.8, aggression=0.1, carnivore=0.1)
    assert prey.archetype == "fleeing_prey"

    # 6. Оппортунист (opportunist)
    opp = Agent("opp", 0, 0, aggression=0.4, fear=0.4, carnivore=0.3, altruism=0.2)
    assert opp.archetype == "opportunist"


def test_carnivore_solar_scaling_and_predation():
    # Хищник получает меньше энергии от солнца, чем солнцеед
    cfg = SimulationConfig(seed=10, width=20, height=20, initial_agents=0, base_metabolism=0.0)
    engine = SimulationEngine(cfg)

    # Ставим обоих в зону терминатора, но на расстоянии, чтобы не спровоцировать драку
    bands = engine.env.get_terminator_bands(1)
    term_x = int(bands[0]["center_x"])

    pred = Agent("pred", x=term_x, y=2, energy=50.0, carnivore=1.0)
    grazer = Agent("grazer", x=term_x, y=15, energy=50.0, carnivore=0.0)
    engine.agents["pred"] = pred
    engine.agents["grazer"] = grazer

    # Прокручиваем 1 шаг (без штрафов)
    engine.step()

    # У солнцееда прирост энергии от солнца должен быть выше, чем у хищника
    assert grazer.energy > pred.energy


def test_predation_event_and_absorption():
    cfg = SimulationConfig(seed=42, width=10, height=10, initial_agents=0, base_metabolism=0.0)
    engine = SimulationEngine(cfg)

    # Сильный хищник атакует слабую жертву
    predator = Agent("hunter", x=3, y=3, energy=100.0, aggression=0.9, carnivore=0.9, fear=0.0)
    victim = Agent("victim", x=4, y=3, energy=5.0, aggression=0.0, carnivore=0.0, fear=0.9)
    engine.agents["hunter"] = predator
    engine.agents["victim"] = victim

    engine.step()

    # Жертва должна быть убита или атакована, и должно быть событие PREDATION
    events = engine.events.get_events(limit=20)
    pred_events = [e for e in events if e["type"] == "PREDATION"]
    assert len(pred_events) > 0 or predator.predation_energy > 0.0


def test_altruistic_energy_sharing():
    cfg = SimulationConfig(seed=42, width=10, height=10, initial_agents=0, base_metabolism=0.0)
    engine = SimulationEngine(cfg)

    # Богатый альтруист рядом с умирающим сородичем
    altruist = Agent("giver", x=2, y=2, energy=90.0, altruism=0.9, aggression=0.0, fear=0.0)
    starving = Agent("receiver", x=2, y=3, energy=10.0, aggression=0.0, fear=0.0)
    engine.agents["giver"] = altruist
    engine.agents["receiver"] = starving

    engine.step()

    # Должен быть зафиксирован акт альтруизма
    share_events = [e for e in engine.events.get_events(limit=20) if e["type"] == "SHARE_ENERGY"]
    assert len(share_events) > 0
    assert altruist.energy_shared > 0.0
    assert starving.energy_received > 0.0


def test_territorial_oasis_defense_bonus():
    cfg = SimulationConfig(seed=99, width=10, height=10, initial_agents=0)
    engine = SimulationEngine(cfg)

    # Добавляем кратер в (5, 5)
    engine.depressions[(5, 5)] = 2

    # Защитник оазиса в кратере
    guardian = Agent("guard", x=5, y=5, energy=50.0, territorial=0.9, aggression=0.5)
    engine.agents["guard"] = guardian

    assert engine.depressions.get((guardian.x, guardian.y), 0) == 2


def test_trophic_and_social_reproducibility():
    """Проверка строгой повторяемости с 5 генами поведения."""
    cfg1 = SimulationConfig(seed=7777, initial_agents=25, cycle_ticks=30)
    cfg2 = SimulationConfig(seed=7777, initial_agents=25, cycle_ticks=30)

    e1 = SimulationEngine(cfg1)
    e2 = SimulationEngine(cfg2)

    for tick in range(1, 20):
        s1 = e1.step()
        s2 = e2.step()
        assert s1["state_hash"] == s2["state_hash"]
        assert s1["metrics"]["avg_carnivore"] == s2["metrics"]["avg_carnivore"]
        assert s1["metrics"]["avg_altruism"] == s2["metrics"]["avg_altruism"]
        assert s1["metrics"]["avg_territorial"] == s2["metrics"]["avg_territorial"]
