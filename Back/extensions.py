"""Расширения Flask, вынесенные в отдельный модуль для разрыва циклических импортов."""

from flask_socketio import SocketIO

# async_mode="threading" не требует monkey-patch и работает с Python 3.14+
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")
