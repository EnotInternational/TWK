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


@metrics_bp.route("/genes", methods=["GET"])
def get_gene_metrics():
    """
    Получить агрегированную статистику и распределение генов популяции.
    ---
    tags: [metrics]
    responses:
      200: {description: Статистика генов и эволюции}
    """
    with sim_manager.lock:
        tick = sim_manager.engine.tick
        alive_agents = [a for a in sim_manager.engine.agents.values() if a.is_alive]
        total_count = len(alive_agents)

        if not alive_agents:
            return jsonify({
                "tick": tick,
                "alive_count": 0,
                "w_temp": {"avg": 0.0, "min": 0.0, "max": 0.0, "std": 0.0, "thermophobe_ratio": 0.0},
                "w_swarm": {"avg": 0.0, "min": 0.0, "max": 0.0, "std": 0.0, "swarm_ratio": 0.0},
                "generations": {"max": 0, "dominant": 0, "distribution": {}},
                "strategies": {},
                "agents": []
            }), 200

        w_temp_vals = [a.w_temp for a in alive_agents]
        w_swarm_vals = [a.w_swarm for a in alive_agents]

        def calc_stats(vals):
            avg = sum(vals) / len(vals)
            variance = sum((x - avg) ** 2 for x in vals) / len(vals)
            return {
                "avg": round(avg, 4),
                "min": round(min(vals), 4),
                "max": round(max(vals), 4),
                "std": round(variance ** 0.5, 4),
            }

        thermophobes = sum(1 for a in alive_agents if a.w_temp < 0)
        swarmers = sum(1 for a in alive_agents if a.w_swarm > 0)

        gen_counts = {}
        for a in alive_agents:
            gen_counts[a.generation] = gen_counts.get(a.generation, 0) + 1
        dominant_gen = max(gen_counts.items(), key=lambda x: x[1])[0] if gen_counts else 0

        strategy_counts = {
            "cooperation_thermophobe": 0,
            "lone_thermophobe": 0,
            "swarm_extremophile": 0,
            "lone_extremophile": 0,
        }
        for a in alive_agents:
            if a.w_temp < 0 and a.w_swarm > 0:
                strategy_counts["cooperation_thermophobe"] += 1
            elif a.w_temp < 0 and a.w_swarm <= 0:
                strategy_counts["lone_thermophobe"] += 1
            elif a.w_temp >= 0 and a.w_swarm > 0:
                strategy_counts["swarm_extremophile"] += 1
            else:
                strategy_counts["lone_extremophile"] += 1

        w_temp_stats = calc_stats(w_temp_vals)
        w_temp_stats["thermophobe_ratio"] = round(thermophobes / total_count, 4)

        w_swarm_stats = calc_stats(w_swarm_vals)
        w_swarm_stats["swarm_ratio"] = round(swarmers / total_count, 4)

        return jsonify({
            "tick": tick,
            "alive_count": total_count,
            "w_temp": w_temp_stats,
            "w_swarm": w_swarm_stats,
            "generations": {
                "max": max(a.generation for a in alive_agents),
                "dominant": dominant_gen,
                "distribution": gen_counts,
            },
            "strategies": {
                k: {
                    "count": v,
                    "percent": round((v / total_count) * 100, 1)
                }
                for k, v in strategy_counts.items()
            },
            "agents": [
                {
                    "id": a.id,
                    "w_temp": round(a.w_temp, 4),
                    "w_swarm": round(a.w_swarm, 4),
                    "generation": a.generation,
                    "age": a.age,
                    "hp": round(a.energy, 2),
                    "energy": round(a.energy, 2),
                    "parent_id": a.parent_id,
                }
                for a in alive_agents
            ]
        }), 200
