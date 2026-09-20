from flask import Blueprint, jsonify, request
from state import sim_manager

simulation_bp = Blueprint("simulation", __name__, url_prefix="/api/simulation")


@simulation_bp.route("/init", methods=["POST"])
def init_simulation():
    """
    Инициализировать симуляцию с заданными параметрами и сидом.
    ---
    tags: [simulation]
    parameters:
      - name: body
        in: body
        required: false
        schema:
          type: object
          properties:
            seed: {type: integer, example: 42}
            width: {type: integer, example: 60}
            height: {type: integer, example: 30}
            initial_agents: {type: integer, example: 40}
            starting_energy: {type: number, example: 100}
            base_metabolism: {type: number, example: 1.0}
            penalty_hot: {type: number, example: 3.0}
            penalty_cold: {type: number, example: 3.0}
            penalty_terminator: {type: number, example: 0.0}
            cycle_ticks: {type: integer, example: 200}
            terminator_width: {type: integer, example: 4}
            reproduction_threshold: {type: number, example: 140.0}
            reproduction_cost: {type: number, example: 50.0}
            require_partner: {type: boolean, example: true}
            max_ticks: {type: integer, example: 1000}
            wind_penalty: {type: number, example: 0.5}
            rocks_count: {type: integer, example: 50}
    responses:
      200: {description: Симуляция инициализирована}
    """
    data = request.get_json(silent=True) or {}
    snapshot = sim_manager.init_simulation(data)
    return jsonify(snapshot), 200


@simulation_bp.route("/start", methods=["POST"])
def start_simulation():
    """
    Запустить автоматическое выполнение симуляции.
    ---
    tags: [simulation]
    parameters:
      - name: body
        in: body
        required: false
        schema:
          type: object
          properties:
            interval_sec: {type: number, example: 0.5, description: Интервал между тиками в секундах}
    responses:
      200: {description: Симуляция запущена}
    """
    data = request.get_json(silent=True) or {}
    interval = data.get("interval_sec")
    if interval is not None:
        try:
            interval = float(interval)
        except (ValueError, TypeError):
            interval = None

    sim_manager.start_auto(interval)
    return jsonify(sim_manager.get_status()), 200


@simulation_bp.route("/pause", methods=["POST"])
def pause_simulation():
    """
    Приостановить автоматическую симуляцию.
    ---
    tags: [simulation]
    responses:
      200: {description: Симуляция приостановлена}
    """
    sim_manager.stop_auto()
    return jsonify(sim_manager.get_status()), 200


@simulation_bp.route("/step", methods=["POST"])
def step_simulation():
    """
    Выполнить один шаг (тик) симуляции.
    ---
    tags: [simulation]
    responses:
      200: {description: Шаг успешно выполнен}
    """
    snapshot = sim_manager.step()
    return jsonify(snapshot), 200


@simulation_bp.route("/reset", methods=["POST"])
def reset_simulation():
    """
    Сбросить симуляцию к тику 0 с текущими параметрами.
    ---
    tags: [simulation]
    responses:
      200: {description: Симуляция сброшена}
    """
    snapshot = sim_manager.reset_simulation()
    return jsonify(snapshot), 200


@simulation_bp.route("/status", methods=["GET"])
def get_status():
    """
    Получить текущий статус симуляции и конфигурацию.
    ---
    tags: [simulation]
    responses:
      200: {description: Статус симуляции}
    """
    return jsonify(sim_manager.get_status()), 200


@simulation_bp.route("/speed", methods=["POST"])
def set_speed():
    """
    Изменить скорость симуляции (интервал между тиками).
    ---
    tags: [simulation]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [interval_sec]
          properties:
            interval_sec: {type: number, example: 0.2}
    responses:
      200: {description: Скорость обновлена}
      400: {description: Некорректный интервал}
    """
    data = request.get_json(silent=True) or {}
    interval = data.get("interval_sec")
    if interval is None:
        return jsonify({"error": "Поле interval_sec обязательно"}), 400
    try:
        val = float(interval)
        new_val = sim_manager.set_interval(val)
        return jsonify({"interval_sec": new_val}), 200
    except (ValueError, TypeError):
        return jsonify({"error": "interval_sec должен быть числом"}), 400


@simulation_bp.route("/meteorite", methods=["POST"])
def throw_meteorite():
    """
    Бросить метеорит в заданную точку, уничтожив агентов в радиусе.
    ---
    tags: [simulation]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [x, y, radius]
          properties:
            x: {type: integer, example: 10}
            y: {type: integer, example: 10}
            radius: {type: number, example: 3.0}
    responses:
      200: {description: Метеорит сброшен}
      400: {description: Некорректные параметры}
    """
    data = request.get_json(silent=True) or {}
    try:
        x = int(data.get("x", 0))
        y = int(data.get("y", 0))
        radius = float(data.get("radius", 3.0))
    except (ValueError, TypeError):
        return jsonify({"error": "Некорректные параметры x, y, radius"}), 400

    sim_manager.throw_meteorite(x, y, radius)
    return jsonify({"message": "Meteorite thrown", "x": x, "y": y, "radius": radius}), 200


@simulation_bp.route("/rocks", methods=["POST"])
def add_rocks():
    """
    Добавить блок скал.
    """
    data = request.get_json(silent=True) or {}
    try:
        x = int(data.get("x", 0))
        y = int(data.get("y", 0))
        size = int(data.get("size", 3))
    except (ValueError, TypeError):
        return jsonify({"error": "Некорректные параметры"}), 400

    sim_manager.add_rocks(x, y, size)
    return jsonify({"message": "Rocks added", "x": x, "y": y, "size": size}), 200

@simulation_bp.route("/depression", methods=["POST"])
def add_depression():
    """
    Добавить углубление (уровень 1 - обычная, уровень 2 - глубокая).
    """
    data = request.get_json(silent=True) or {}
    try:
        x = int(data.get("x", 0))
        y = int(data.get("y", 0))
        level = int(data.get("level", 1))
        size = int(data.get("size", 1))
    except (ValueError, TypeError):
        return jsonify({"error": "Некорректные параметры"}), 400

    sim_manager.add_depression(x, y, level, size)
    return jsonify({"message": "Depression added", "x": x, "y": y, "level": level, "size": size}), 200

@simulation_bp.route("/eraser", methods=["POST"])
def remove_rocks():
    """
    Удалить скалы и углубления в радиусе (Ластик).
    """
    data = request.get_json(silent=True) or {}
    try:
        x = int(data.get("x", 0))
        y = int(data.get("y", 0))
        radius = float(data.get("radius", 2.0))
    except (ValueError, TypeError):
        return jsonify({"error": "Некорректные параметры"}), 400

    sim_manager.remove_rocks(x, y, radius)
    return jsonify({"message": "Rocks and depressions removed", "x": x, "y": y, "radius": radius}), 200

@simulation_bp.route("/wind", methods=["POST"])
def apply_wind():
    """
    Применить ветер от центра нажатия указателя (радиальный).
    """
    data = request.get_json(silent=True) or {}
    try:
        x = int(data.get("x", 0))
        y = int(data.get("y", 0))
        strength = int(data.get("strength", 7))
        direction = data.get("direction", None)
    except (ValueError, TypeError):
        return jsonify({"error": "Некорректные параметры"}), 400

    sim_manager.apply_wind(x, y, strength, direction)
    return jsonify({"message": "Wind applied", "x": x, "y": y, "strength": strength}), 200
