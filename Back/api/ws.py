"""WebSocket-обработчики для поля агентов.

События (client -> server):
  connect          -- сервер сразу шлёт текущее состояние поля
  disconnect       -- логирование
  request_field    -- клиент запрашивает снимок поля
  simulation_step  -- один тик симуляции через WS
  start_auto       -- запустить авто-симуляцию (data: {"interval": <секунды>})
  stop_auto        -- остановить авто-симуляцию

События (server -> client):
  field_update     -- broadcast текущего состояния поля всем клиентам
"""

import threading
from flask_socketio import emit

from state import field_state
from extensions import socketio

# Событие остановки авто-задачи
_stop_event: threading.Event = threading.Event()
_auto_thread: threading.Thread | None = None


def _broadcast_field():
    """Разослать текущее состояние поля всем подключённым клиентам."""
    socketio.emit("field_update", field_state.as_dict())


def _run_auto(interval: float, stop: threading.Event):
    """Фоновый поток: периодически делать шаг симуляции."""
    while not stop.wait(timeout=interval):
        for agent in field_state.agents:
            agent["hunger"] = max(0, agent["hunger"] - 1)
        _broadcast_field()


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

@socketio.on("connect")
def handle_connect():
    """Клиент подключился - немедленно отправить текущее состояние поля."""
    emit("field_update", field_state.as_dict())


@socketio.on("disconnect")
def handle_disconnect():
    """Клиент отключился."""
    pass


@socketio.on("request_field")
def handle_request_field():
    """Клиент запрашивает актуальный снимок поля."""
    emit("field_update", field_state.as_dict())


@socketio.on("simulation_step")
def handle_simulation_step():
    """Один тик симуляции: уменьшить голод каждого агента и транслировать результат."""
    for agent in field_state.agents:
        agent["hunger"] = max(0, agent["hunger"] - 1)
    _broadcast_field()


@socketio.on("start_auto")
def handle_start_auto(data):
    """Запустить авто-симуляцию.

    data: {"interval": <float, секунды>}  -- по умолчанию 1.0 сек.
    """
    global _auto_thread, _stop_event
    if _auto_thread is not None and _auto_thread.is_alive():
        return  # уже запущена

    interval = float((data or {}).get("interval", 1.0))
    interval = max(0.1, min(interval, 60.0))  # clamp [0.1; 60]

    _stop_event = threading.Event()
    _auto_thread = threading.Thread(
        target=_run_auto, args=(interval, _stop_event), daemon=True
    )
    _auto_thread.start()


@socketio.on("stop_auto")
def handle_stop_auto():
    """Остановить авто-симуляцию."""
    global _auto_thread
    _stop_event.set()
    _auto_thread = None
