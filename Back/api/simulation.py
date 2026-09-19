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
            agent_max_age: {type: integer, example: 100}
            wind_penalty: {type: number, example: 0.0}
            rocks_count: {type: integer, example: 0}
            rocks_coords: {
              type: array,
              items: {
                type: array,
                items: {type: integer},
                example: [10, 15]
              },
              example: [[10, 15], [12, 18]]
            }
            meteorite_prob: {type: number, example: 0.0}
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
