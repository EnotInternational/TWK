"""Модель агента для симуляции Terra Nova: Mercury.

Агент обладает запасом энергии, возрастом, родословной (parent_id, generation),
тратит энергию на поддержание жизни и гибнет при её истощении.

ГЕНОМ (6 эволюционирующих генов + температура softmax):
    w_aggression [-1, +1]: −1 = трус/пацифист, +1 = агрессор
    w_carnivore  [0, 1]:   0 = фотосинтез, 1 = хищник
    w_social     [-1, +1]: −1 = одиночка, +1 = стайный/альтруист
    w_explore    [0, 1]:   0 = домосед, 1 = исследователь
    w_territorial [-1, +1]: −1 = номад, +1 = страж кратера
    w_temp       ℝ:         предпочтение тепла/холода (без ограничения)
    temperature  > 0:       температура softmax (жадность выбора)
"""

import random
from typing import Any, Dict, List, Optional, Tuple


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


class Agent:
    def __init__(
        self,
        agent_id: str,
        x: int,
        y: int,
        energy: float = 100.0,
        age: int = 0,
        generation: int = 0,
        parent_id: Optional[str] = None,
        # === Геном (6 чистых генов) ===
        w_aggression: float = 0.0,
        w_carnivore: float = 0.0,
        w_social: float = 0.0,
        w_explore: float = 0.3,
        w_territorial: float = 0.0,
        w_temp: float = 0.0,
        temperature: float = 0.6,
        # === Legacy compatibility kwargs (used for migration only) ===
        aggression: Optional[float] = None,
        fear: Optional[float] = None,
        carnivore: Optional[float] = None,
        altruism: Optional[float] = None,
        territorial: Optional[float] = None,
        caste: Optional[str] = None,
        ferocity: Optional[float] = None,
        friendliness: Optional[float] = None,
        courage: Optional[float] = None,
        diplomacy: Optional[float] = None,
        caution: Optional[float] = None,
        w_swarm: Optional[float] = None,
        choice_history: Optional[Dict[str, int]] = None,
    ) -> None:
        self.id = agent_id
        self.x = x
        self.y = y
        self.energy = float(energy)
        self.age = age
        self.generation = generation
        self.parent_id = parent_id
        self.is_alive = True
        self.death_reason: Optional[str] = None
        self.death_tick: Optional[int] = None

        # === Геном ===
        self.w_aggression = _clamp(float(w_aggression), -1.0, 1.0)
        self.w_carnivore = _clamp(float(w_carnivore), 0.0, 1.0)
        self.w_social = _clamp(float(w_social), -1.0, 1.0)
        self.w_explore = _clamp(float(w_explore), 0.0, 1.0)
        self.w_territorial = _clamp(float(w_territorial), -1.0, 1.0)
        self.w_temp = float(w_temp)
        self.temperature = max(0.05, float(temperature))

        # === Послужной список жизненных выборов агента ===
        self.choice_history: Dict[str, int] = dict(choice_history) if choice_history else {
            "friend": 0,
            "fight": 0,
            "bribe": 0,
            "flee": 0,
            "retaliate": 0,
        }
        # Детальная хроника выборов и их последствий (лента решений)
        self.choice_chronicle: List[Dict[str, Any]] = []

        # Индивидуальная статистика поведения, боев и социальности
        self.fights_won = 0
        self.fights_lost = 0
        self.kills = 0
        self.energy_shared = 0.0
        self.energy_received = 0.0
        self.predation_energy = 0.0

        # Последнее решение EDM (для визуализации на фронтенде)
        self.last_decision: Optional[Dict[str, Any]] = None

    # ──────────────────────────────────────────────
    # Вычисляемые свойства (из генома, для обратной совместимости)
    # ──────────────────────────────────────────────

    @property
    def aggression(self) -> float:
        return max(0.0, self.w_aggression)

    @property
    def fear(self) -> float:
        return max(0.0, -self.w_aggression)

    @property
    def carnivore(self) -> float:
        return self.w_carnivore

    @property
    def altruism(self) -> float:
        return max(0.0, self.w_social) * 0.5

    @property
    def territorial(self) -> float:
        return self.w_territorial

    @property
    def ferocity(self) -> float:
        return max(0.0, self.w_aggression)

    @property
    def friendliness(self) -> float:
        return max(0.0, -self.w_aggression) * 0.5 + max(0.0, self.w_social) * 0.5

    @property
    def courage(self) -> float:
        return _clamp(0.5 + self.w_aggression * 0.5, 0.0, 1.0)

    @property
    def caution(self) -> float:
        return _clamp(0.5 - self.w_aggression * 0.5, 0.0, 1.0)

    @property
    def diplomacy(self) -> float:
        return _clamp(max(0.0, self.w_social) * 0.7 + max(0.0, -self.w_aggression) * 0.3, 0.0, 1.0)

    @property
    def w_swarm(self) -> float:
        return self.w_social

    @property
    def caste(self) -> str:
        """Каста — эмерджентное свойство генома, а не жёстко заданный параметр."""
        if self.w_carnivore >= 0.4 and self.w_aggression >= 0.1:
            return "predator"
        return "peaceful"

    @property
    def character_title(self) -> str:
        """Динамический титул характера, сформированный на основе генома и опыта."""
        if self.caste == "predator":
            if self.w_aggression >= 0.6:
                return "Кровожадный хищник"
            elif self.w_aggression < 0.3 and self.w_social > 0.0:
                return "Благородный хищник"
            elif self.w_social >= 0.3 or self.choice_history.get("bribe", 0) >= 1:
                return "Рэкетир-собиратель"
            elif self.w_aggression < 0.4:
                return "Осторожный охотник"
            return "Охотник стаи"
        else:
            if self.w_aggression >= 0.2 or self.choice_history.get("retaliate", 0) >= 1:
                return "Боевой защитник"
            elif (self.w_social >= 0.3 or self.choice_history.get("bribe", 0) >= 1) and self.choice_history.get("bribe", 0) >= self.choice_history.get("flee", 0):
                return "Хитрый дипломат"
            elif (self.w_aggression <= -0.3 or self.choice_history.get("flee", 0) >= 1) and self.choice_history.get("flee", 0) > self.choice_history.get("bribe", 0):
                return "Осторожный беглец"
            return "Мирный обыватель"

    @property
    def archetype(self) -> str:
        """Определяет доминирующий тип поведения (архетип) агента из 6 устойчивых стратегий."""
        if self.w_territorial >= 0.3 and self.w_aggression >= 0.2 and self.w_carnivore < 0.5:
            return "oasis_guardian"
        elif self.w_carnivore >= 0.4 and self.w_aggression >= 0.2:
            return "predator"
        elif self.w_aggression >= 0.6:
            return "predator"
        elif self.w_social >= 0.4:
            return "altruist_swarm"
        elif self.w_aggression <= -0.4:
            return "fleeing_prey"
        elif self.w_carnivore <= 0.2 and self.w_aggression <= 0.1 and self.w_territorial <= 0.2:
            return "grazer"
        return "opportunist"

    # ──────────────────────────────────────────────
    # Подкрепление характера на основе жизненных решений
    # (теперь двигает ген w_aggression / w_social)
    # ──────────────────────────────────────────────

    def reinforce_friendship(self, success: bool = True) -> None:
        """Подкрепление после мирного выбора / союза."""
        self.choice_history["friend"] = self.choice_history.get("friend", 0) + 1
        delta = -0.04 if success else 0.02  # Сдвиг w_aggression в сторону мирности
        self.w_aggression = _clamp(self.w_aggression + delta, -1.0, 1.0)
        self.w_social = _clamp(self.w_social + (0.03 if success else -0.01), -1.0, 1.0)

    def reinforce_bribe(self, as_predator: bool = False) -> None:
        """Подкрепление после передачи / принятия откупа."""
        self.choice_history["bribe"] = self.choice_history.get("bribe", 0) + 1
        if as_predator:
            self.w_social = _clamp(self.w_social + 0.03, -1.0, 1.0)
        else:
            self.w_aggression = _clamp(self.w_aggression - 0.03, -1.0, 1.0)
            self.w_social = _clamp(self.w_social + 0.04, -1.0, 1.0)

    def reinforce_flee(self, escaped: bool = True) -> None:
        """Подкрепление после попытки побега."""
        self.choice_history["flee"] = self.choice_history.get("flee", 0) + 1
        if escaped:
            self.w_aggression = _clamp(self.w_aggression - 0.05, -1.0, 1.0)
        else:
            self.w_aggression = _clamp(self.w_aggression - 0.02, -1.0, 1.0)

    def reinforce_retaliate(self, won: bool = True) -> None:
        """Подкрепление после решительного отпора."""
        self.choice_history["retaliate"] = self.choice_history.get("retaliate", 0) + 1
        if won:
            self.w_aggression = _clamp(self.w_aggression + 0.10, -1.0, 1.0)
        else:
            self.w_aggression = _clamp(self.w_aggression - 0.06, -1.0, 1.0)
            self.w_social = _clamp(self.w_social + 0.04, -1.0, 1.0)

    def reinforce_fight(self, won: bool = True) -> None:
        """Подкрепление после боя (хищник)."""
        self.choice_history["fight"] = self.choice_history.get("fight", 0) + 1
        if won:
            self.w_aggression = _clamp(self.w_aggression + 0.06, -1.0, 1.0)
            self.w_social = _clamp(self.w_social - 0.03, -1.0, 1.0)
        else:
            self.w_aggression = _clamp(self.w_aggression - 0.05, -1.0, 1.0)

    def record_choice(
        self,
        tick: int,
        choice: str,  # "friend", "bribe", "flee", "retaliate", "fight"
        opponent_id: str,
        opponent_caste: str,
        opponent_title: str,
        outcome: str,
        energy_delta: float,
        details: str,
        trait_deltas: Optional[Dict[str, str]] = None,
    ) -> None:
        """Зафиксировать выбор агента в столкновении и последствия этого выбора."""
        entry = {
            "tick": tick,
            "choice": choice,
            "opponent_id": opponent_id,
            "opponent_caste": opponent_caste,
            "opponent_title": opponent_title,
            "outcome": outcome,
            "energy_delta": round(energy_delta, 1),
            "resulting_energy": round(self.energy, 1),
            "details": details,
            "trait_deltas": trait_deltas or {},
            "resulting_title": self.character_title,
        }
        self.choice_chronicle.append(entry)
        if len(self.choice_chronicle) > 60:
            self.choice_chronicle.pop(0)

    def consume_energy(self, amount: float) -> None:
        """Потребление энергии за тик."""
        self.energy -= amount
        if self.energy < 0:
            self.energy = 0.0

    def can_reproduce(self, threshold: float) -> bool:
        """Проверка достаточности энергии для размножения."""
        return self.is_alive and self.energy >= threshold

    def reproduce(
        self,
        child_id: str,
        child_x: int,
        child_y: int,
        cost: float,
        rng: random.Random,
    ) -> "Agent":
        """Создать потомка, передав ему геном предка со случайной мутацией."""
        self.energy -= cost
        if self.energy < 0:
            self.energy = 0.0

        # Наследование генов с мутацией
        gene_sigma = 0.10
        child_w_aggression = _clamp(self.w_aggression + rng.gauss(0, gene_sigma), -1.0, 1.0)
        child_w_carnivore = _clamp(self.w_carnivore + rng.gauss(0, gene_sigma), 0.0, 1.0)
        child_w_social = _clamp(self.w_social + rng.gauss(0, gene_sigma), -1.0, 1.0)
        child_w_explore = _clamp(self.w_explore + rng.gauss(0, gene_sigma), 0.0, 1.0)
        child_w_territorial = _clamp(self.w_territorial + rng.gauss(0, 0.12), -1.0, 1.0)
        child_w_temp = self.w_temp + rng.gauss(0, 0.5)
        child_temperature = max(0.05, self.temperature + rng.gauss(0, 0.05))

        return Agent(
            agent_id=child_id,
            x=child_x,
            y=child_y,
            energy=cost,
            age=0,
            generation=self.generation + 1,
            parent_id=self.id,
            w_aggression=child_w_aggression,
            w_carnivore=child_w_carnivore,
            w_social=child_w_social,
            w_explore=child_w_explore,
            w_territorial=child_w_territorial,
            w_temp=child_w_temp,
            temperature=child_temperature,
            choice_history={"friend": 0, "fight": 0, "bribe": 0, "flee": 0, "retaliate": 0},
        )

    def die(self, reason: str, tick: int) -> None:
        """Зафиксировать гибель агента."""
        self.is_alive = False
        self.death_reason = reason
        self.death_tick = tick

    def as_dict(self, current_zone: Optional[str] = None) -> Dict[str, Any]:
        """Сериализация агента в словарь для API."""
        strategy = "Кооперация (термофоб)" if self.w_social > 0 and self.w_temp < 0 else (
            "Одиночка (термофоб)" if self.w_social <= 0 and self.w_temp < 0 else (
                "Экстремал-стайный" if self.w_social > 0 else "Экстремал-одиночка"
            )
        )
        data = {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "energy": round(self.energy, 2),
            "age": self.age,
            "generation": self.generation,
            "parent_id": self.parent_id,
            "is_alive": self.is_alive,
            "caste": self.caste,
            "character_title": self.character_title,
            "character": {
                "ferocity": round(self.ferocity, 3),
                "friendliness": round(self.friendliness, 3),
                "courage": round(self.courage, 3),
                "diplomacy": round(self.diplomacy, 3),
                "caution": round(self.caution, 3),
            },
            "choices": dict(self.choice_history),
            "choice_chronicle": list(self.choice_chronicle),
            "aggression": round(self.aggression, 3),
            "fear": round(self.fear, 3),
            "carnivore": round(self.carnivore, 3),
            "altruism": round(self.altruism, 3),
            "territorial": round(self.territorial, 3),
            "archetype": self.archetype,
            "fights_won": self.fights_won,
            "fights_lost": self.fights_lost,
            "kills": self.kills,
            "energy_shared": round(self.energy_shared, 2),
            "energy_received": round(self.energy_received, 2),
            "predation_energy": round(self.predation_energy, 2),
            # Новые поля: геном и решения EDM
            "genome": {
                "w_aggression": round(self.w_aggression, 4),
                "w_carnivore": round(self.w_carnivore, 4),
                "w_social": round(self.w_social, 4),
                "w_explore": round(self.w_explore, 4),
                "w_territorial": round(self.w_territorial, 4),
                "w_temp": round(self.w_temp, 4),
                "temperature": round(self.temperature, 4),
            },
            "last_decision": self.last_decision,
            "learning": {
                "w_temp": round(self.w_temp, 4),
                "w_swarm": round(self.w_swarm, 4),
                "caste": self.caste,
                "character_title": self.character_title,
                "ferocity": round(self.ferocity, 4),
                "friendliness": round(self.friendliness, 4),
                "courage": round(self.courage, 4),
                "diplomacy": round(self.diplomacy, 4),
                "caution": round(self.caution, 4),
                "choices": dict(self.choice_history),
                "aggression": round(self.aggression, 4),
                "fear": round(self.fear, 4),
                "carnivore": round(self.carnivore, 4),
                "altruism": round(self.altruism, 4),
                "territorial": round(self.territorial, 4),
                "generation": self.generation,
                "strategy": strategy,
                "archetype": self.archetype,
                "mutation_rate": 0.10,
            },
        }
        if current_zone is not None:
            data["zone"] = current_zone
        if not self.is_alive:
            data["death_reason"] = self.death_reason
            data["death_tick"] = self.death_tick
        return data
