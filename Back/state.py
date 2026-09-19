"""Глобальный менеджер состояния симуляции.

Обеспечивает потокобезопасный доступ к ядру симуляции (SimulationEngine)
и управление фоновым потоком автоматического выполнения шагов.
"""

import threading
import time
from typing import Any, Dict, List, Optional

from extensions import socketio
from simulation.engine import SimulationConfig, SimulationEngine


class SimulationManager:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.engine = SimulationEngine()

        # Фоновый поток
        self._interval: float = 0.5  # секунды между тиками
        self._stop_event: threading.Event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    # --- Управление симуляцией ---------------------------------------------

    def init_simulation(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            self.stop_auto()
            config = SimulationConfig.from_dict(config_dict)
            self.engine.reset(config)
            snapshot = self.engine.get_snapshot()
            self._broadcast(snapshot)
            return snapshot

    def reset_simulation(self) -> Dict[str, Any]:
        with self.lock:
            self.stop_auto()
            self.engine.reset()
            snapshot = self.engine.get_snapshot()
            self._broadcast(snapshot)
            return snapshot

    def step(self) -> Dict[str, Any]:
        with self.lock:
            snapshot = self.engine.step()
            self._broadcast(snapshot)
            return snapshot

    def set_interval(self, interval_sec: float) -> float:
        with self.lock:
            self._interval = max(0.01, min(interval_sec, 10.0))
            return self._interval

    def start_auto(self, interval_sec: Optional[float] = None) -> None:
        with self.lock:
            if interval_sec is not None:
                self.set_interval(interval_sec)

            if self._thread is not None and self._thread.is_alive():
                return

            self._stop_event.clear()
            self.engine.status = "running"
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

    def stop_auto(self) -> None:
        with self.lock:
            if self._thread is not None and self._thread.is_alive():
                self._stop_event.set()
                self._thread = None
            if self.engine.status == "running":
                self.engine.status = "paused"

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            time.sleep(self._interval)
            with self.lock:
                if self._stop_event.is_set():
                    break
                snapshot = self.engine.step()
                self._broadcast(snapshot)
                if self.engine.status in ("extinct", "completed"):
                    self._stop_event.set()
                    self._thread = None
                    socketio.emit("simulation:ended", {
                        "status": self.engine.status,
                        "tick": self.engine.tick,
                    })
                    break

    def _broadcast(self, snapshot: Dict[str, Any]) -> None:
        """Рассылка состояния по WebSocket."""
        # Новое структурированное событие
        socketio.emit("simulation:tick", snapshot)
        # Обратная совместимость для базового field_update
        socketio.emit("field_update", {
            "tick": snapshot["tick"],
            "width": snapshot["environment"]["width"],
            "height": snapshot["environment"]["height"],
            "agents": snapshot["agents"],
            "metrics": snapshot["metrics"],
        })

    # --- Запросы данных -----------------------------------------------------

    def get_snapshot(self) -> Dict[str, Any]:
        with self.lock:
            return self.engine.get_snapshot()

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "tick": self.engine.tick,
                "status": self.engine.status,
                "is_running": (self._thread is not None and self._thread.is_alive()),
                "interval_sec": self._interval,
                "state_hash": self.engine.get_state_hash(),
                "config": self.engine.config.as_dict(),
                "alive_count": len([a for a in self.engine.agents.values() if a.is_alive]),
            }

    def get_agents(self, zone: Optional[str] = None, alive_only: bool = True) -> List[Dict[str, Any]]:
        with self.lock:
            results = []
            for a in self.engine.agents.values():
                if alive_only and not a.is_alive:
                    continue
                current_zone = self.engine.env.get_zone(a.x, a.y, self.engine.tick).value
                if zone and current_zone != zone.lower():
                    continue
                results.append(a.as_dict(current_zone=current_zone))
            return results

    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            agent = self.engine.agents.get(agent_id)
            if agent is None:
                return None
            zone = self.engine.env.get_zone(agent.x, agent.y, self.engine.tick).value
            return agent.as_dict(current_zone=zone)

    def get_environment(self) -> Dict[str, Any]:
        with self.lock:
            return self.engine.env.get_state(self.engine.tick)

    def get_metrics_latest(self) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.engine.metrics.get_latest()

    def get_metrics_history(self, from_tick: int = 0, to_tick: Optional[int] = None, step: int = 1) -> List[Dict[str, Any]]:
        with self.lock:
            return self.engine.metrics.get_history(from_tick=from_tick, to_tick=to_tick, step=step)

    def get_events(self, since_tick: Optional[int] = None, event_type: Optional[str] = None, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        with self.lock:
            return self.engine.events.get_events(since_tick=since_tick, event_type=event_type, limit=limit, offset=offset)

    def run_headless(self, ticks: int) -> Dict[str, Any]:
        with self.lock:
            return self.engine.run_batch(ticks)


# Глобальный синглтон менеджера симуляции
sim_manager = SimulationManager()