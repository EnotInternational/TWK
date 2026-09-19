from flask import Blueprint, jsonify, request
from state import sim_manager

environment_bp = Blueprint("environment", __name__, url_prefix="/api/environment")


@environment_bp.route("", methods=["GET"])
def get_environment():
    """
    Получить текущее состояние среды Меркурия.
    ---
    tags: [environment]
    responses:
      200: {description: Состояние среды, координаты Солнца и терминатора}
    """
    return jsonify(sim_manager.get_environment()), 200


@environment_bp.route("/cell", methods=["GET"])
def inspect_cell():
    """
    Инспекция условий в конкретной клетке поля.
    ---
    tags: [environment]
    parameters:
      - name: x
        in: query
        type: integer
        required: true
      - name: y
        in: query
        type: integer
        required: true
    responses:
      200: {description: Информация о клетке}
      400: {description: Ошибка параметров}
    """
    try:
        x = int(request.args.get("x", 0))
        y = int(request.args.get("y", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "x и y должны быть целыми числами"}), 400

    env = sim_manager.engine.env
    tick = sim_manager.engine.tick

    if x < 0 or x >= env.width or y < 0 or y >= env.height:
        return jsonify({"error": f"Координаты вне поля (0..{env.width-1}, 0..{env.height-1})"}), 400

    zone = env.get_zone(x, y, tick)
    penalty = env.get_energy_penalty(zone)

    # Проверка наличия агента в клетке
    agent_in_cell = None
    for a in sim_manager.engine.agents.values():
        if a.is_alive and a.x == x and a.y == y:
            agent_in_cell = a.as_dict(current_zone=zone.value)
            break

    return jsonify({
        "coordinates": {"x": x, "y": y},
        "tick": tick,
        "zone": zone.value,
        "energy_penalty": penalty,
        "agent": agent_in_cell,
    }), 200
