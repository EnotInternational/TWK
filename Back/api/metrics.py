from flask import Blueprint, jsonify, request
from state import sim_manager

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")


@metrics_bp.route("/current", methods=["GET"])
def get_current_metrics():
    """
    Получить текущие метрики симуляции (последний тик).
    ---
    tags: [metrics]
    responses:
      200: {description: Сводка метрик}
    """
    latest = sim_manager.get_metrics_latest()
    if latest is None:
        return jsonify({"message": "Симуляция не содержит данных"}), 200
    return jsonify(latest), 200


@metrics_bp.route("/history", methods=["GET"])
def get_metrics_history():
    """
    Получить временные ряды для графиков (численность, энергия, смертность).
    ---
    tags: [metrics]
    parameters:
      - name: from_tick
        in: query
        type: integer
        default: 0
      - name: to_tick
        in: query
        type: integer
      - name: step
        in: query
        type: integer
        default: 1
        description: Шаг прореживания данных (downsample)
    responses:
      200: {description: История метрик по тикам}
    """
    try:
        from_tick = int(request.args.get("from_tick", 0))
        to_tick_param = request.args.get("to_tick")
        to_tick = int(to_tick_param) if to_tick_param is not None else None
        step = max(1, int(request.args.get("step", 1)))
    except (ValueError, TypeError):
        return jsonify({"error": "Параметры должны быть целыми числами"}), 400

    history = sim_manager.get_metrics_history(from_tick=from_tick, to_tick=to_tick, step=step)
    return jsonify({
        "count": len(history),
        "history": history,
    }), 200


@metrics_bp.route("/distribution", methods=["GET"])
def get_distribution():
    """
    Получить детальное распределение агентов по температурным зонам.
    ---
    tags: [metrics]
    responses:
      200: {description: Распределение агентов и энергии}
    """
    latest = sim_manager.get_metrics_latest()
    if latest is None:
        return jsonify({"message": "Нет данных"}), 200

    # Сбор распределения энергий по зонам
    zone_energies = {"hot": [], "cold": [], "terminator": []}
    with sim_manager.lock:
        tick = sim_manager.engine.tick
        env = sim_manager.engine.env
        for a in sim_manager.engine.agents.values():
            if a.is_alive:
                z = env.get_zone(a.x, a.y, tick).value
                zone_energies[z].append(round(a.energy, 1))

    return jsonify({
        "tick": latest["tick"],
        "counts": latest["distribution"],
        "terminator_ratio": latest["terminator_ratio"],
        "zone_energies": {
            zone: {
                "count": len(energies),
                "avg_energy": round(sum(energies) / len(energies), 2) if energies else 0.0,
                "values": energies,
            }
            for zone, energies in zone_energies.items()
        },
    }), 200
