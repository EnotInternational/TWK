"""Тесты для новой системы динамического характера и поведенческих выборов (Хищники vs Мирные).
"""

import random
import pytest
from simulation.agent import Agent
from simulation.engine import SimulationConfig, SimulationEngine
from simulation.events import EventType


def test_two_castes_initialization_and_traits():
    """Проверка спавна двух каст и начальных черт характера."""
    pred = Agent("p1", 0, 0, caste="predator", ferocity=0.75, friendliness=0.2, courage=0.7, diplomacy=0.1, caution=0.2)
    assert pred.caste == "predator"
    assert pred.ferocity == 0.75
    assert pred.character_title in ("Кровожадный хищник", "Охотник стаи")
    assert pred.choice_history["friend"] == 0

    peace = Agent("m1", 0, 0, caste="peaceful", ferocity=0.1, friendliness=0.7, courage=0.3, diplomacy=0.6, caution=0.6)
    assert peace.caste == "peaceful"
    assert peace.character_title in ("Хитрый дипломат", "Осторожный беглец", "Мирный обыватель")
    assert peace.choice_history["bribe"] == 0


def test_character_reinforcement_on_choices():
    """Проверка динамического изменения характера в зависимости от опыта."""
    agent = Agent("test", 0, 0, caste="peaceful", diplomacy=0.4, caution=0.5, courage=0.3)
    
    # 1. Откуп усиливает дипломатию
    agent.reinforce_bribe(as_predator=False)
    assert agent.choice_history["bribe"] == 1
    assert agent.diplomacy > 0.4
    assert agent.character_title == "Хитрый дипломат"

    # 2. Успешный побег усиливает осторожность
    agent.reinforce_flee(escaped=True)
    assert agent.choice_history["flee"] == 1
    assert agent.caution > 0.5

    # 3. Победа в отпоре резко увеличивает храбрость
    agent.reinforce_retaliate(won=True)
    assert agent.choice_history["retaliate"] == 1
    assert round(agent.courage, 2) >= 0.40
    assert agent.character_title == "Боевой защитник"


def test_predator_reinforcement_on_friend_and_bribe():
    """Хищник принимает откуп или дружит: растет дружелюбие и дипломатия."""
    pred = Agent("p_test", 0, 0, caste="predator", ferocity=0.6, friendliness=0.3, diplomacy=0.2)
    
    pred.reinforce_bribe(as_predator=True)
    assert pred.choice_history["bribe"] == 1
    assert pred.diplomacy > 0.2
    assert pred.friendliness > 0.3

    pred.reinforce_friendship(success=True)
    assert pred.choice_history["friend"] == 1
    assert pred.friendliness > 0.35


def test_encounter_bribe_resolution():
    """Мирный откупается данью: оба выживают, энергия передается, событие логируется."""
    cfg = SimulationConfig(seed=42, width=10, height=10, initial_agents=0, base_metabolism=0.0)
    engine = SimulationEngine(cfg)

    # Хищник голоден и воинственен, но мирный очень дипломатичен
    hunter = Agent("hunter", x=4, y=5, energy=80.0, caste="predator", ferocity=0.9, friendliness=0.0)
    diplomat = Agent("dip", x=5, y=5, energy=70.0, caste="peaceful", diplomacy=0.9, caution=0.1, courage=0.0)
    engine.agents["hunter"] = hunter
    engine.agents["dip"] = diplomat

    engine.step()

    # Проверяем, что зафиксирован откуп
    bribe_events = [e for e in engine.events.get_events(limit=20) if e["type"] == EventType.ENCOUNTER_BRIBE]
    assert len(bribe_events) > 0 or diplomat.choice_history["bribe"] > 0
    assert hunter.predation_energy > 0.0
    assert diplomat.is_alive


def test_encounter_retaliation_resolution():
    """Храбрый мирный агент дает отпор хищнику."""
    cfg = SimulationConfig(seed=999, width=10, height=10, initial_agents=0, base_metabolism=0.0)
    engine = SimulationEngine(cfg)

    # Хищник атакует, но мирный агент обладает высокой храбростью и дает отпор
    hunter = Agent("hunter", x=2, y=2, energy=85.0, caste="predator", ferocity=0.9, friendliness=0.0)
    warrior = Agent("warrior", x=3, y=2, energy=80.0, caste="peaceful", courage=0.95, caution=0.0, diplomacy=0.0)
    engine.agents["hunter"] = hunter
    engine.agents["warrior"] = warrior

    engine.step()

    retaliate_events = [e for e in engine.events.get_events(limit=20) if e["type"] in (EventType.ENCOUNTER_RETALIATE, EventType.FIGHT)]
    assert len(retaliate_events) > 0 or warrior.choice_history["retaliate"] > 0


def test_character_metrics_telemetry():
    """Метрики собирают статистику каст, выборов и средних черт характера."""
    cfg = SimulationConfig(seed=555, width=15, height=15, initial_agents=25)
    engine = SimulationEngine(cfg)

    engine.step()
    latest = engine.metrics.get_latest()

    assert "castes" in latest
    assert latest["castes"]["predator"] > 0
    assert latest["castes"]["peaceful"] > 0
    assert "character" in latest
    assert "avg_ferocity" in latest["character"]
    assert "avg_courage" in latest["character"]
    assert "avg_diplomacy" in latest["character"]
    assert "bribes" in latest
    assert "flees" in latest


def test_choice_chronicle_recording():
    """Тест записи подробной хроники каждого выбора агента и сериализации."""
    agent = Agent(agent_id="chronicle_test", x=5, y=5, energy=100.0, caste="peaceful")
    assert agent.choice_chronicle == []

    agent.record_choice(
        tick=42,
        choice="bribe",
        opponent_id="pred_99",
        opponent_caste="predator",
        opponent_title="Кровожадный хищник",
        outcome="paid_bribe",
        energy_delta=-20.0,
        details="Агент передал 20 HP дани хищнику",
        trait_deltas={"diplomacy": "+0.06", "caution": "+0.08"}
    )

    assert len(agent.choice_chronicle) == 1
    entry = agent.choice_chronicle[0]
    assert entry["tick"] == 42
    assert entry["choice"] == "bribe"
    assert entry["opponent_id"] == "pred_99"
    assert entry["opponent_caste"] == "predator"
    assert entry["outcome"] == "paid_bribe"
    assert entry["energy_delta"] == -20.0
    assert entry["resulting_energy"] == 100.0
    assert "diplomacy" in entry["trait_deltas"]
    assert entry["resulting_title"] == agent.character_title

    # Проверка сериализации в as_dict
    data = agent.as_dict()
    assert "choice_chronicle" in data
    assert len(data["choice_chronicle"]) == 1
    assert data["choice_chronicle"][0]["choice"] == "bribe"

