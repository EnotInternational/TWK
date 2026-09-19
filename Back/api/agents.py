from flask import Blueprint, jsonify, request
from state import sim_manager

agents_bp = Blueprint("agents", __name__, url_prefix="/api/agents")


@agents_bp.route("", methods=["GET"])
def get_agents():
    """
    Получить список агентов.
    ---
    tags: [agents]
    parameters:
      - name: zone
        in: query
        type: string
        required: false
        description: Фильтр по зоне (hot, cold, terminator)
      - name: alive_only
        in: query
        type: boolean
        required: false
        default: true
        description: Только живые агенты
    responses:
      200: {description: Список агентов}
    """
    zone = request.args.get("zone")
    alive_only_param = request.args.get("alive_only", "true").lower()
    alive_only = alive_only_param not in ("false", "0", "no")

    agents = sim_manager.get_agents(zone=zone, alive_only=alive_only)
    return jsonify({
        "count": len(agents),
        "agents": agents,
    }), 200


@agents_bp.route("/<agent_id>", methods=["GET"])
def get_agent(agent_id: str):
    """
    Получить подробные данные об агенте по id.
    ---
    tags: [agents]
    parameters:
      - name: agent_id
        in: path
        type: string
        required: true
    responses:
      200: {description: Данные агента}
      404: {description: Агент не найден}
    """
    agent = sim_manager.get_agent(agent_id)
    if agent is None:
        return jsonify({"error": "Агент не найден"}), 404
    return jsonify(agent), 200
