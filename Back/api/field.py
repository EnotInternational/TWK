from flask import Blueprint, jsonify, request

from models import create_agents
from state import field_state
from extensions import socketio


field_bp = Blueprint("field", __name__, url_prefix="/api/field")


@field_bp.route("", methods=["POST"])
def init_field():
    """
    Инициализировать поле случайными агентами.
    ---
    tags:
      - field
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [width, height]
          properties:
            width:  {type: integer, example: 10}
            height: {type: integer, example: 10}
            agents_count: {type: integer, example: 5}
    responses:
      200: {description: Поле успешно создано}
      400: {description: Некорректные параметры}
    """
    data = request.get_json(silent=True) or {}

    width = data.get("width")
    height = data.get("height")
    agents_count = data.get("agents_count", 5)

    if not isinstance(width, int) or not isinstance(height, int):
        return jsonify({"error": "width и height должны быть целыми числами"}), 400
    if width <= 0 or height <= 0:
        return jsonify({"error": "width и height должны быть > 0"}), 400
    if not isinstance(agents_count, int) or agents_count < 0:
        return jsonify({"error": "agents_count должен быть >= 0"}), 400
    if agents_count > width * height:
        return jsonify({"error": "агентов больше, чем клеток на поле"}), 400

    agents = create_agents(agents_count, width, height)
    field_state.init(width, height, agents)
    socketio.emit("field_update", field_state.as_dict())
    return jsonify(field_state.as_dict()), 200


@field_bp.route("", methods=["GET"])
def get_field():
    """
    Получить текущее состояние поля.
    ---
    tags:
      - field
    responses:
      200: {description: Текущее состояние поля}
    """
    return jsonify(field_state.as_dict()), 200


@field_bp.route("", methods=["DELETE"])
def clear_field():
    """
    Очистить поле (удалить всех агентов).
    ---
    tags:
      - field
    responses:
      200: {description: Поле очищено}
    """
    field_state.clear()
    socketio.emit("field_update", field_state.as_dict())
    return jsonify({"status": "cleared"}), 200
