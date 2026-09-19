"""WebSocket-обработчики для связи фронтенда с ядром симуляции.

События (клиент -> сервер):
  connect          -- клиент подключился
  disconnect       -- клиент отключился
  request_field    -- клиент запрашивает текущий снимок
  simulation:step  -- выполнить 1 тик
  simulation:start -- запустить симуляцию (данные: {"interval_sec": 0.5})
  simulation:pause -- поставить на паузу
  simulation:reset -- сбросить состояние
  simulation:speed -- изменить скорость (данные: {"interval_sec": 0.2})

События (сервер -> клиент):
  simulation:tick  -- полный пакет каждого тика (Солнце, терминатор, агенты, метрики)
  field_update     -- обратная совместимость
  simulation:ended -- сигнал об остановке / вымирании популяции
"""

from flask_socketio import emit
from extensions import socketio
from state import sim_manager


@socketio.on("connect")
def handle_connect():
    """Клиент подключился - отправить текущий снимок симуляции."""
    snapshot = sim_manager.get_snapshot()
    emit("simulation:tick", snapshot)
    emit("field_update", {
        "tick": snapshot["tick"],
        "width": snapshot["environment"]["width"],
        "height": snapshot["environment"]["height"],
        "agents": snapshot["agents"],
        "metrics": snapshot["metrics"],
    })


@socketio.on("disconnect")
def handle_disconnect():
    """Клиент отключился."""
    pass


@socketio.on("request_field")
def handle_request_field():
    """Клиент запросил актуальный снимок."""
    snapshot = sim_manager.get_snapshot()
    emit("simulation:tick", snapshot)


@socketio.on("simulation:step")
@socketio.on("simulation_step")
def handle_simulation_step():
    """Сделать 1 шаг симуляции."""
    sim_manager.step()


@socketio.on("simulation:start")
@socketio.on("start_auto")
def handle_simulation_start(data=None):
    """Запустить непрерывную симуляцию."""
    interval_sec = None
    if isinstance(data, dict):
        # Поддержка как interval_sec, так и interval
        val = data.get("interval_sec", data.get("interval"))
        if val is not None:
            try:
                interval_sec = float(val)
            except (ValueError, TypeError):
                pass
    sim_manager.start_auto(interval_sec)


@socketio.on("simulation:pause")
@socketio.on("stop_auto")
def handle_simulation_pause():
    """Приостановить симуляцию."""
    sim_manager.stop_auto()


@socketio.on("simulation:reset")
def handle_simulation_reset():
    """Сбросить симуляцию."""
    sim_manager.reset_simulation()


@socketio.on("simulation:speed")
def handle_simulation_speed(data):
    """Изменить скорость выполнения."""
    if isinstance(data, dict):
        val = data.get("interval_sec", data.get("interval"))
        if val is not None:
            try:
                sim_manager.set_interval(float(val))
            except (ValueError, TypeError):
                pass
