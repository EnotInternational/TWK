from flask import Flask
from flask_cors import CORS
from flasgger import Swagger

from api import register_blueprints
from config import Config


def create_app(config_object=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    CORS(app)
    Swagger(app)

    register_blueprints(app)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        debug=Config.DEBUG,
        host=Config.HOST,
        port=Config.PORT,
    )