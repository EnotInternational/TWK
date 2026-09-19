from flask import Flask
from flask_cors import CORS
from flasgger import Swagger

from config import Config
from extensions import socketio


def create_app(config_object=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    CORS(app)
    Swagger(app)

    from api import register_blueprints
    register_blueprints(app)

    socketio.init_app(app)

    return app


app = create_app()


if __name__ == "__main__":
    socketio.run(
        app,
        debug=Config.DEBUG,
        host=Config.HOST,
        port=Config.PORT,
        allow_unsafe_werkzeug=True,
    )
