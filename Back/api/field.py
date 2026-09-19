from flask import Blueprint, jsonify, request
from state import sim_manager

field_bp = Blueprint("field", __name__, url_prefix="/api/field")


@field_bp.route("", methods=["POST"])
def init_field():
    """
    Инициализировать поле (обратная совместимость).
    ---
    tags: [field]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            width:  {type: integer, example: 60}
            height: {type: integer, example: 30}
            agents_count: {type: integer, example: 40}
            seed: {type: integer, example: 42}
    responses:
      200: {description: Поле успешно создано}
      400: {description: Некорректные параметры}
    """
    data = request.get_json(silent=True) or {}
    width = data.get("width", 60)
    height = data.get("height", 30)
    agents_count = data.get("agents_count", 40)
    seed = data.get("seed", 42)

    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        return jsonify({"error": "width и height должны быть натуральными числами"}), 400

    cfg_dict = {
        "width": width,
        "height": height,
        "initial_agents": agents_count,
        "seed": seed,
    }
    snapshot = sim_manager.init_simulation(cfg_dict)
    return jsonify({
        "width": snapshot["environment"]["width"],
        "height": snapshot["environment"]["height"],
        "agents": snapshot["agents"],
    }), 200


@field_bp.route("", methods=["GET"])
def get_field():
    """
    Получить текущее состояние поля (обратная совместимость).
    ---
    tags: [field]
    responses:
      200: {description: Текущее состояние поля}
    """
    snapshot = sim_manager.get_snapshot()
    return jsonify({
        "width": snapshot["environment"]["width"],
        "height": snapshot["environment"]["height"],
        "agents": snapshot["agents"],
    }), 200


@field_bp.route("", methods=["DELETE"])
def clear_field():
    """
    Сбросить поле.
    ---
    tags: [field]
    responses:
      200: {description: Поле очищено}
    """
    sim_manager.reset_simulation()
    return jsonify({"status": "cleared"}), 200
