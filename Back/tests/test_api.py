import json
import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_simulation_lifecycle_api(client):
    # 1. Init
    res = client.post(
        "/api/simulation/init",
        json={"seed": 42, "initial_agents": 20, "width": 40, "height": 20},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["tick"] == 0
    assert len(data["agents"]) == 20

    # 2. Status
    res = client.get("/api/simulation/status")
    assert res.status_code == 200
    assert res.get_json()["alive_count"] == 20

    # 3. Step
    res = client.post("/api/simulation/step")
    assert res.status_code == 200
    assert res.get_json()["tick"] == 1

    # 4. Speed
    res = client.post("/api/simulation/speed", json={"interval_sec": 0.1})
    assert res.status_code == 200
    assert res.get_json()["interval_sec"] == 0.1

    # 5. Pause
    res = client.post("/api/simulation/pause")
    assert res.status_code == 200

    # 6. Reset
    res = client.post("/api/simulation/reset")
    assert res.status_code == 200
    assert res.get_json()["tick"] == 0


def test_environment_api(client):
    res = client.get("/api/environment")
    assert res.status_code == 200
    data = res.get_json()
    assert "sun_x" in data
    assert "terminator_bands" in data

    res = client.get("/api/environment/cell?x=5&y=5")
    assert res.status_code == 200
    cell_data = res.get_json()
    assert "zone" in cell_data
    assert "energy_penalty" in cell_data


def test_agents_api(client):
    client.post("/api/simulation/init", json={"seed": 42, "initial_agents": 10})
    res = client.get("/api/agents")
    assert res.status_code == 200
    agents_data = res.get_json()
    assert agents_data["count"] == 10
    agent_id = agents_data["agents"][0]["id"]

    res = client.get(f"/api/agents/{agent_id}")
    assert res.status_code == 200
    assert res.get_json()["id"] == agent_id


def test_metrics_and_events_api(client):
    client.post("/api/simulation/init", json={"seed": 42, "initial_agents": 10})
    client.post("/api/simulation/step")

    # Metrics current
    res = client.get("/api/metrics/current")
    assert res.status_code == 200
    assert "alive_count" in res.get_json()

    # Metrics history
    res = client.get("/api/metrics/history")
    assert res.status_code == 200
    assert len(res.get_json()["history"]) >= 2

    # Distribution
    res = client.get("/api/metrics/distribution")
    assert res.status_code == 200
    assert "terminator_ratio" in res.get_json()

    # Events
    res = client.get("/api/events")
    assert res.status_code == 200
    assert res.get_json()["count"] > 0


def test_experiments_verify_api(client):
    res = client.post(
        "/api/experiments/verify",
        json={"seed": 777, "ticks": 15},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["reproducible"] is True
    assert data["run_1"]["state_hash"] == data["run_2"]["state_hash"]


def test_experiments_run_and_export_api(client):
    res = client.post("/api/experiments/run", json={"ticks": 10})
    assert res.status_code == 200
    assert "state_hash" in res.get_json()

    res = client.get("/api/experiments/export")
    assert res.status_code == 200
    data = res.get_json()
    assert "metrics_history" in data
    assert "events" in data


def test_backward_compatibility_field_api(client):
    res = client.post("/api/field", json={"width": 30, "height": 15, "agents_count": 5})
    assert res.status_code == 200
    data = res.get_json()
    assert data["width"] == 30
    assert len(data["agents"]) == 5

    res = client.get("/api/field")
    assert res.status_code == 200
    assert res.get_json()["width"] == 30

    res = client.delete("/api/field")
    assert res.status_code == 200
