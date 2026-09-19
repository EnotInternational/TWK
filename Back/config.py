class Config:
    """Базовые настройки приложения Terra Nova: Mercury."""
    DEBUG = True
    HOST = "0.0.0.0"
    PORT = 5000

    SWAGGER = {
        "title": "Terra Nova: Mercury Scientific API",
        "uiversion": 3,
        "description": "API научной симуляции самоорганизации агентов на поверхности Меркурия",
        "version": "1.0.0",
    }