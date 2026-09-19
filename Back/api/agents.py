from flask import Blueprint, jsonify, request

from state import field_state
from extensions import socketio


agents_bp = Blueprint("agents", __name__, url_prefix="/api/agents")


@agents_bp.route("", methods=["GET"])
def get_agents():
    """
    Получить список агентов.
    ---
    tags:
      - agents
    responses:
      200: {description: Список агентов}
    """
    return jsonify(field_state.agents), 200


@agents_bp.route("/<agent_id>", methods=["GET"])
def get_agent(agent_id: str):
    """
    Получить одного агента по id.
    ---
    tags:
      - agents
    parameters:
      - {name: agent_id, in: path, type: string, required: true}
    responses:
      200: {description: Агент найден}
      404: {description: Агент не найден}
    """
    agent = field_state.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "агент не найден"}), 404
    return jsonify(agent), 200


@agents_bp.route("/<agent_id>", methods=["PATCH"])
def update_agent(agent_id: str):
    """
    Обновить параметры агента (голод, координаты).
    ---
    tags:
      - agents
    parameters:
      - {name: agent_id, in: path, type: string, required: true}
      - name: body
        in: body
        schema:
          type: object
          properties:
            hunger: {type: integer, example: 42}
            x: {type: integer, example: 3}
            y: {type: integer, example: 4}
    responses:
      200: {description: Агент обновлён}
      404: {description: Агент не найден}
    """
    agent = field_state.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "агент не найден"}), 404

    data = request.get_json(silent=True) or {}
    for key in ("hunger", "x", "y"):
        if key in data and isinstance(data[key], int):
            agent[key] = data[key]

    socketio.emit("field_update", field_state.as_dict())
    return jsonify(agent), 200
