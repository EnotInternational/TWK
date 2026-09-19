# Terra Nova: Mercury — Backend

Научный бэкенд для моделирования самоорганизации популяции агентов в экстремальных условиях поверхности Меркурия.

## Архитектура проекта

```
Back/
├── app.py                      # Точка входа приложения (Flask + Flask-SocketIO)
├── config.py                   # Настройки сервера и Swagger
├── extensions.py               # Инициализация SocketIO
├── state.py                    # Менеджер симуляции (SimulationManager) и фоновый поток
├── simulation/                 # Чистая математическая модель (без веб-зависимостей)
│   ├── environment.py          # Среда Меркурия: Солнце, зоны (Hot, Cold, Terminator)
│   ├── agent.py                # Модель агента: энергия, возраст, размножение, смерть
│   ├── engine.py               # Детерминированный движок (RNG seed, state hashing)
│   ├── metrics.py              # Сборщик временных рядов (популяция, энергия, распределение)
│   └── events.py               # Журнал событий (SPAWN, BIRTH, DEATH_*, EXTINCTION)
├── api/                        # REST API + WebSocket
│   ├── simulation.py           # Жизненный цикл (init, start, pause, step, reset, speed, status)
│   ├── environment.py          # Данные о положении Солнца и зонах планеты
│   ├── agents.py               # Запрос агентов с фильтрацией по зонам
│   ├── metrics.py              # Метрики для графиков (численность, энергия, терминатор)
│   ├── events.py               # Журнал событий
│   ├── experiments.py          # Пакетный расчет, научная проверка воспроизводимости и экспорт
│   └── ws.py                   # Real-time WebSocket трансляция
└── tests/                      # Модульные и интеграционные тесты (pytest)
```

## Быстрый старт

### 1. Установка зависимостей
```bash
pip install -r requirements.txt
pip install pytest
```

### 2. Запуск сервера
```bash
python app.py
```
Сервер запустится по адресу: `http://127.0.0.1:5000`
Документация Swagger UI доступна по адресу: `http://127.0.0.1:5000/apidocs/`

### 3. Запуск тестов
```bash
python -m pytest tests/ -v
```

---

## Спецификация REST API

### Управление симуляцией (`/api/simulation`)
* `POST /api/simulation/init` — инициализация прогона с параметрами и сидом:
  ```json
  {
    "seed": 42,
    "width": 60,
    "height": 30,
    "initial_agents": 40,
    "starting_energy": 100,
    "base_metabolism": 1.0,
    "penalty_hot": 3.0,
    "penalty_cold": 3.0,
    "penalty_terminator": 0.0,
    "cycle_ticks": 200,
    "terminator_width": 4,
    "reproduction_threshold": 140.0,
    "reproduction_cost": 50.0,
    "require_partner": true
  }
  ```
* `POST /api/simulation/start` — запустить фоновый непрерывный расчет (опционально: `{"interval_sec": 0.2}`).
* `POST /api/simulation/pause` — приостановить симуляцию.
* `POST /api/simulation/step` — выполнить ровно 1 тик.
* `POST /api/simulation/reset` — сброс к начальному тику 0.
* `GET /api/simulation/status` — текущий статус, тик, контрольная сумма, живые агенты.
* `POST /api/simulation/speed` — установить интервал шага: `{"interval_sec": 0.1}`.

### Среда Меркурия (`/api/environment`)
* `GET /api/environment` — положение Солнца (`sun_x`), границы двух полос терминатора, штрафы.
* `GET /api/environment/cell?x=15&y=10` — инспекция температурных условий в конкретной клетке.

### Агенты (`/api/agents`)
* `GET /api/agents` — список агентов (поддерживает `?zone=terminator` и `?alive_only=true`).
* `GET /api/agents/<agent_id>` — карточка агента: координаты, энергия, возраст, поколение, `parent_id`.

### Метрики для графиков (`/api/metrics`)
* `GET /api/metrics/current` — текущие агрегированные метрики.
* `GET /api/metrics/history?from_tick=0&to_tick=500&step=1` — временные ряды:
  - `alive_count` — число живых агентов
  - `avg_energy`, `min_energy`, `max_energy` — динамика энергии
  - `births`, `deaths` — рождаемость и смертность
  - `terminator_ratio` — доля популяции в терминаторной зоне (проверка самоорганизации)
* `GET /api/metrics/distribution` — распределение популяции и уровней энергии по зонам (Hot/Cold/Terminator).

### Журнал событий (`/api/events`)
* `GET /api/events?since_tick=0&type=BIRTH&limit=50&offset=0` — история событий:
  - `SPAWN`, `BIRTH`, `DEATH_EXHAUSTION`, `DEATH_HEAT`, `DEATH_COLD`, `EXTINCTION`.

### Научные эксперименты (`/api/experiments`)
* `POST /api/experiments/run` — быстрый расчет $N$ тиков в headless-режиме (без задержек): `{"ticks": 500}`.
* `POST /api/experiments/verify` — верификация воспроизводимости: одновременный прогон двух независимых инстансов с одинаковым `seed` и сравнение контрольных сумм `state_hash`.
* `GET /api/experiments/export` — выгрузка полного датасета в формате JSON.

---

## WebSocket протокол (Socket.IO)

* **Подключение**: `connect` $\rightarrow$ сервер немедленно присылает событие `simulation:tick`.
* **Исходящие события сервера**:
  * `simulation:tick` — полный снимок каждого тика:
    ```json
    {
      "tick": 42,
      "status": "running",
      "state_hash": "...",
      "environment": { "sun_x": 12.6, "terminator_bands": [...] },
      "agents": [ { "id": "ag_0001", "x": 12, "y": 8, "energy": 84.5, "zone": "terminator" } ],
      "metrics": { "alive_count": 41, "avg_energy": 79.2, "terminator_ratio": 0.65 },
      "recent_events": [...]
    }
    ```
  * `simulation:ended` — сигнал об окончании симуляции (вымирание популяции или достижение лимита тиков).
* **Входящие команды от клиента**:
  * `simulation:step` — сделать один шаг.
  * `simulation:start` `{"interval_sec": 0.2}` — запустить непрерывный цикл.
  * `simulation:pause` — поставить на паузу.
  * `simulation:reset` — сбросить к тику 0.
  * `simulation:speed` `{"interval_sec": 0.05}` — изменить скорость.
