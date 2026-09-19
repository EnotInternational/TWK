from flask import Blueprint, jsonify, request
from state import sim_manager

events_bp = Blueprint("events", __name__, url_prefix="/api/events")


@events_bp.route("", methods=["GET"])
def get_events():
    """
    Получить журнал значимых событий симуляции (рождения, смерти, вымирание).
    ---
    tags: [events]
    parameters:
      - name: since_tick
        in: query
        type: integer
        required: false
      - name: type
        in: query
        type: string
        required: false
        description: Фильтр по типу (SPAWN, BIRTH, DEATH_EXHAUSTION, DEATH_HEAT, DEATH_COLD, EXTINCTION)
      - name: limit
        in: query
        type: integer
        default: 50
      - name: offset
        in: query
        type: integer
        default: 0
    responses:
      200: {description: Список событий}
    """
    try:
        since_tick_param = request.args.get("since_tick")
        since_tick = int(since_tick_param) if since_tick_param is not None else None
        limit = min(500, max(1, int(request.args.get("limit", 50))))
        offset = max(0, int(request.args.get("offset", 0)))
    except (ValueError, TypeError):
        return jsonify({"error": "Параметры пагинации должны быть целыми числами"}), 400

    event_type = request.args.get("type")
    events = sim_manager.get_events(
        since_tick=since_tick,
        event_type=event_type,
        limit=limit,
        offset=offset,
    )

    return jsonify({
        "count": len(events),
        "events": events,
    }), 200
