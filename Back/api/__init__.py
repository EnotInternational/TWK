from .field import field_bp
from .agents import agents_bp


def register_blueprints(app) -> None:
    app.register_blueprint(field_bp)
    app.register_blueprint(agents_bp)
    # сюда добавляются будущие:
    # app.register_blueprint(simulation_bp)
    # app.register_blueprint(stats_bp)