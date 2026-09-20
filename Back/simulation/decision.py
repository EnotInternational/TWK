"""Evolutionary Decision Machine (EDM) — утилитарная машина выбора.

Гены агента конфигурируют utility-функцию, которая оценивает каждое
возможное намерение (intent). Выбор производится через softmax с
температурой T (тоже эволюционирующий параметр).

    наблюдение → scoring → softmax → intent → action

Архитектурно EDM — чистая функция без состояния: observe → score → choose.
"""

import math
from typing import Any, Dict, List, Optional, Set, Tuple


# Все намерения, доступные агенту
INTENTS = [
    "MOVE_TO_FOOD",   # Идти к солнечной энергии (терминатор / оазис)
    "ATTACK",         # Напасть на ближайшего подходящего соседа
    "FLEE",           # Уйти от угрозы
    "EXPLORE",        # Идти на случайную свободную безопасную клетку
    "REST",           # Остаться на месте
    "SHARE",          # Поделиться энергией с нуждающимся соседом
]


def observe(
    agent: Any,
    neighbors: List[Tuple[int, int]],
    occupied: Dict[Tuple[int, int], Any],
    rocks: Set[Tuple[int, int]],
    get_zone_fn,          # callable(x, y, tick) -> Zone
    get_penalty_fn,       # callable(Zone) -> float
    tick: int,
    depressions: Dict[Tuple[int, int], int],
    grid_width: int,
    grid_height: int,
) -> Dict[str, float]:
    """Собирает сенсорные данные окружения агента.

    Возвращает нормализованный словарь наблюдений для utility-scoring.
    """
    from .environment import Zone

    free_neighbors = [pos for pos in neighbors if pos not in occupied and pos not in rocks]
    occupied_neighbors = [
        pos for pos in neighbors
        if pos in occupied and occupied[pos].id != agent.id and pos not in rocks
    ]

    # Сколько свободных клеток в комфортной зоне рядом
    food_nearby = 0.0
    for pos in free_neighbors:
        zone = get_zone_fn(pos[0], pos[1], tick)
        if zone == Zone.TERMINATOR:
            food_nearby += 1.0
        elif zone == Zone.HOT:
            food_nearby -= 0.3  # Слабый отрицательный сигнал

    # Текущая зона агента
    agent_zone = get_zone_fn(agent.x, agent.y, tick)
    in_comfort = 1.0 if agent_zone == Zone.TERMINATOR else 0.0

    # Враги: агенты с высокой агрессией поблизости
    enemy_count = 0
    enemy_strength = 0.0
    weakest_prey_energy = 999.0
    has_prey = False
    for pos in occupied_neighbors:
        other = occupied[pos]
        if not other.is_alive:
            continue
        # Любой сосед — потенциальная угроза или добыча
        enemy_count += 1
        enemy_strength += max(0.0, other.w_aggression) * other.energy / 50.0
        if other.energy < weakest_prey_energy:
            weakest_prey_energy = other.energy
            has_prey = True

    # Друзья: соседи со схожим геномом (низкая агрессия или общая трофика)
    friend_count = 0
    needy_friend = False
    for pos in occupied_neighbors:
        other = occupied[pos]
        if not other.is_alive:
            continue
        # Схожесть генома = расстояние по w_aggression и w_carnivore
        genome_dist = abs(agent.w_aggression - other.w_aggression) + abs(agent.w_carnivore - other.w_carnivore)
        if genome_dist < 0.8:
            friend_count += 1
            if other.energy < 25.0:
                needy_friend = True

    # Наличие кратеров/углублений рядом
    depression_nearby = 0.0
    for pos in free_neighbors:
        if pos in depressions:
            depression_nearby += 1.0

    # Свободное пространство для исследования
    unexplored = float(len(free_neighbors))

    # Нормализованная энергия агента
    energy_ratio = agent.energy / 100.0  # >1.0 if high energy

    return {
        "energy": agent.energy,
        "energy_ratio": energy_ratio,
        "food_nearby": food_nearby,
        "in_comfort": in_comfort,
        "enemy_count": float(enemy_count),
        "enemy_strength": enemy_strength,
        "has_prey": 1.0 if has_prey else 0.0,
        "weakest_prey_energy": weakest_prey_energy if has_prey else 0.0,
        "friend_count": float(friend_count),
        "needy_friend": 1.0 if needy_friend else 0.0,
        "depression_nearby": depression_nearby,
        "unexplored": unexplored,
        "free_cells": float(len(free_neighbors)),
        "occupied_cells": float(len(occupied_neighbors)),
    }


def score_intents(agent: Any, obs: Dict[str, float]) -> Dict[str, float]:
    """Считает utility-score для каждого намерения на основе генома агента.

    Геном:
        w_aggression [-1, +1]: трус ↔ агрессор
        w_carnivore  [0, 1]:   фотосинтез ↔ хищник
        w_social     [-1, +1]: одиночка ↔ стайный
        w_explore    [0, 1]:   домосед ↔ исследователь
        w_territorial [-1, +1]: номад ↔ страж
        w_temp       ℝ:        предпочтение тепла/холода
    """
    scores = {}

    # === MOVE_TO_FOOD: идти к солнечной энергии ===
    # Мотивация растёт, когда: (1) много еды рядом, (2) агент не хищник, (3) энергия низкая
    hunger_drive = max(0.0, (100.0 - obs["energy"]) / 50.0)  # 0..2
    photosynthesis_affinity = 1.0 - agent.w_carnivore          # 0..1
    scores["MOVE_TO_FOOD"] = (
        obs["food_nearby"] * 1.5 * photosynthesis_affinity
        + hunger_drive * photosynthesis_affinity * 2.0
        + obs["depression_nearby"] * agent.w_territorial * 1.0
        + (1.0 - obs["in_comfort"]) * photosynthesis_affinity * 1.5  # Стимул выйти из опасной зоны
    )

    # === ATTACK: напасть на соседа ===
    # Мотивация растёт, когда: (1) агрессивный, (2) хищник, (3) голодный хищник
    predator_hunger = agent.w_carnivore * max(0.0, (90.0 - obs["energy"]) / 25.0) * 2.0
    attack_base = (
        agent.w_aggression * 3.0
        + agent.w_carnivore * 2.5
        + predator_hunger
        + agent.w_territorial * obs["depression_nearby"] * 1.0  # Территориальная атака
        - max(0.0, -agent.w_aggression) * obs["enemy_strength"] * 2.0  # Трусы боятся сильных
    )
    scores["ATTACK"] = attack_base * obs["has_prey"]  # Если нет добычи — score = 0

    # === FLEE: убежать от угрозы ===
    # Мотивация растёт, когда: (1) пугливый, (2) враги сильные, (3) мало энергии
    fear_factor = max(0.0, -agent.w_aggression)  # 0..1 для трусов
    flee_base = (
        fear_factor * obs["enemy_strength"] * 3.0
        + fear_factor * obs["enemy_count"] * 1.5
        + max(0.0, (40.0 - obs["energy"]) / 20.0) * fear_factor * 2.0
    )
    scores["FLEE"] = flee_base * min(1.0, obs["free_cells"])  # Если нет куда бежать — score ≈ 0

    # === EXPLORE: исследовать новые территории ===
    scores["EXPLORE"] = (
        agent.w_explore * obs["unexplored"] * 1.5
        + agent.w_explore * (1.0 - obs["in_comfort"]) * 0.5  # Стимул искать лучше
        - max(0.0, agent.w_territorial) * 2.0  # Территориальные не хотят уходить
    )

    # === REST: остаться на месте ===
    scores["REST"] = (
        obs["in_comfort"] * 2.0  # В комфорте — отдыхай
        + max(0.0, agent.w_territorial) * obs["depression_nearby"] * 1.5  # Стражи кратеров остаются
        - agent.w_explore * 1.0   # Исследователям скучно стоять
    )

    # === SHARE: поделиться энергией ===
    social_drive = max(0.0, agent.w_social)  # 0..1 для социальных
    share_base = (
        social_drive * 4.0
        + social_drive * obs["friend_count"] * 0.5
        - max(0.0, (60.0 - obs["energy"]) / 30.0) * 2.0  # Не делись если сам голодный
    )
    scores["SHARE"] = share_base * obs["needy_friend"]  # Если нет нуждающихся — score = 0

    return scores


def softmax_choose(
    scores: Dict[str, float],
    temperature: float,
    rng,
) -> Tuple[str, Dict[str, float]]:
    """Softmax-выбор намерения с заданной температурой.

    Детерминированность гарантирована через rng (seeded Random).

    Args:
        scores: utility-scores для каждого intent
        temperature: T в softmax (маленький → жадный, большой → случайный)
        rng: random.Random с фиксированным seed

    Returns:
        (chosen_intent, probabilities_dict)
    """
    T = max(0.05, temperature)
    keys = list(scores.keys())

    # Numerical stability: subtract max
    max_s = max(scores[k] for k in keys)
    exps = []
    for k in keys:
        exps.append(math.exp((scores[k] - max_s) / T))

    total = sum(exps)
    probs = {k: round(e / total, 4) for k, e in zip(keys, exps)}

    # Weighted random choice using rng for determinism
    r = rng.random()
    cumulative = 0.0
    for k in keys:
        cumulative += probs[k]
        if r <= cumulative:
            return k, probs

    return keys[-1], probs
