from flask import Blueprint, jsonify, request
from state import sim_manager

environment_bp = Blueprint("environment", __name__, url_prefix="/api/environment")


@environment_bp.route("/disaster", methods=["POST"])
def trigger_disaster():
    """
    Применить катастрофу к симуляции.
    ---
    tags: [environment]
    parameters:
      - name: body
        in: body
        schema:
          type: object
          properties:
            type: {type: string, enum: [meteorite, wind, rocks, depression, eraser]}
            x: {type: integer}
            y: {type: integer}
            params: {type: object}
    responses:
      200: {description: Катастрофа применена}
      400: {description: Неверные параметры}
    """
    data = request.get_json(force=True, silent=True) or {}
    disaster_type = data.get("type")
    x = data.get("x")
    y = data.get("y")
    params = data.get("params", {})

    if disaster_type is None or x is None or y is None:
        return jsonify({"error": "Нужны поля: type, x, y"}), 400

    try:
        x = int(x)
        y = int(y)
    except (ValueError, TypeError):
        return jsonify({"error": "x и y должны быть целыми числами"}), 400

    try:
        if disaster_type == "meteorite":
            radius = float(params.get("radius", 3.0))
            sim_manager.throw_meteorite(x, y, radius)
        elif disaster_type == "wind":
            strength = int(params.get("strength", 7))
            direction = params.get("direction")
            sim_manager.apply_wind(x, y, strength, direction)
        elif disaster_type == "rocks":
            size = int(params.get("size", 3))
            sim_manager.add_rocks(x, y, size)
        elif disaster_type == "depression":
            level = int(params.get("level", 1))
            size = int(params.get("size", 2))
            sim_manager.add_depression(x, y, level, size)
        elif disaster_type == "eraser":
            radius = float(params.get("radius", 2.0))
            sim_manager.remove_rocks(x, y, radius)
        else:
            return jsonify({"error": f"Неизвестный тип катастрофы: {disaster_type}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"success": True, "type": disaster_type, "x": x, "y": y}), 200


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
