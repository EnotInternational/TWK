from .field import field_bp
from .agents import agents_bp
from .simulation import simulation_bp
from .environment import environment_bp
from .metrics import metrics_bp
from .events import events_bp
from .experiments import experiments_bp


def register_blueprints(app) -> None:
    app.register_blueprint(field_bp)
    app.register_blueprint(agents_bp)
    app.register_blueprint(simulation_bp)
    app.register_blueprint(environment_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(events_bp)
    app.register_blueprint(experiments_bp)

    # Регистрируем WebSocket-обработчики (декораторы @socketio.on)
    from . import ws  # noqa: F401