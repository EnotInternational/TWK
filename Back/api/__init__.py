from .field import field_bp
from .agents import agents_bp
from .simulation import simulation_bp


def register_blueprints(app) -> None:
    app.register_blueprint(field_bp)
    app.register_blueprint(agents_bp)
    app.register_blueprint(simulation_bp)

    # Регистрируем WebSocket-обработчики (декораторы @socketio.on)
    from . import ws  # noqa: F401