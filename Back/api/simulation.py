from flask import Blueprint, jsonify
from state import field_state
from extensions import socketio

simulation_bp = Blueprint("simulation", __name__, url_prefix="/api/simulation")

@simulation_bp.route("/step", methods=["POST"])
def step():
    """
    Один шаг симуляции.
    ---
    tags: [simulation]
    responses:
      200: {description: Шаг выполнен}
    """
    for agent in field_state.agents:
        agent["hunger"] = max(0, agent["hunger"] - 1)
    socketio.emit("field_update", field_state.as_dict())
    return jsonify(field_state.as_dict()), 200
