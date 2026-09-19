class Config:
    """Базовые настройки приложения."""
    DEBUG = True
    HOST = "0.0.0.0"
    PORT = 5000

    SWAGGER = {
        "title": "Agent Field API",
        "uiversion": 3,
        "description": "API для работы с полем агентов",
        "version": "0.1.0",
    }