from flask import Blueprint, jsonify, request
from state import sim_manager
from simulation.engine import SimulationConfig, SimulationEngine

experiments_bp = Blueprint("experiments", __name__, url_prefix="/api/experiments")


@experiments_bp.route("/run", methods=["POST"])
def run_batch():
    """
    Пакетный запуск симуляции на N тиков без графических задержек (Headless).
    ---
    tags: [experiments]
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            ticks: {type: integer, example: 100}
    responses:
      200: {description: Результаты пакетного прогона}
      400: {description: Некорректные параметры}
    """
    data = request.get_json(silent=True) or {}
    ticks = data.get("ticks", 100)
    if not isinstance(ticks, int) or ticks <= 0 or ticks > 50000:
        return jsonify({"error": "ticks должен быть положительным числом (до 50000)"}), 400

    result = sim_manager.run_headless(ticks)
    return jsonify(result), 200


@experiments_bp.route("/verify", methods=["POST"])
def verify_reproducibility():
    """
    Научная проверка воспроизводимости: два независимых прогона с одинаковым сидом.
    Сравнивает итоговые контрольные суммы и метрики.
    ---
    tags: [experiments]
    parameters:
      - name: body
        in: body
        required: false
        schema:
          type: object
          properties:
            seed: {type: integer, example: 12345}
            ticks: {type: integer, example: 50}
    responses:
      200: {description: Отчет о воспроизводимости}
    """
    data = request.get_json(silent=True) or {}
    seed = int(data.get("seed", 42))
    ticks = min(5000, max(1, int(data.get("ticks", 50))))

    cfg1 = SimulationConfig.from_dict({**data, "seed": seed})
    cfg2 = SimulationConfig.from_dict({**data, "seed": seed})

    engine1 = SimulationEngine(cfg1)
    engine2 = SimulationEngine(cfg2)

    res1 = engine1.run_batch(ticks)
    res2 = engine2.run_batch(ticks)

    hashes_match = (res1["state_hash"] == res2["state_hash"])
    ticks_match = (res1["final_tick"] == res2["final_tick"])
    status_match = (res1["status"] == res2["status"])

    is_reproducible = hashes_match and ticks_match and status_match

    return jsonify({
        "reproducible": is_reproducible,
        "seed": seed,
        "ticks_simulated": ticks,
        "run_1": {
            "final_tick": res1["final_tick"],
            "state_hash": res1["state_hash"],
            "status": res1["status"],
            "alive_count": res1["latest_metrics"]["alive_count"] if res1["latest_metrics"] else 0,
        },
        "run_2": {
            "final_tick": res2["final_tick"],
            "state_hash": res2["state_hash"],
            "status": res2["status"],
            "alive_count": res2["latest_metrics"]["alive_count"] if res2["latest_metrics"] else 0,
        },
        "conclusion": "Результаты строго воспроизводятся" if is_reproducible else "Ошибка: результаты расходятся",
    }), 200


@experiments_bp.route("/export", methods=["GET"])
def export_dataset():
    """
    Экспорт полного датасета текущего прогона для внешнего анализа (Jupyter/pandas).
    ---
    tags: [experiments]
    responses:
      200: {description: Полный датасет симуляции}
    """
    with sim_manager.lock:
        return jsonify({
            "config": sim_manager.engine.config.as_dict(),
            "status": sim_manager.engine.status,
            "tick": sim_manager.engine.tick,
            "state_hash": sim_manager.engine.get_state_hash(),
            "environment": sim_manager.engine.env.get_state(sim_manager.engine.tick),
            "agents": [a.as_dict() for a in sim_manager.engine.agents.values()],
            "metrics_history": sim_manager.engine.metrics.get_history(from_tick=0),
            "events": [e.as_dict() for e in sim_manager.engine.events._events],
        }), 200
