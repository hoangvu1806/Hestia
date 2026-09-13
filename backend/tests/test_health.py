from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "hestia-backend",
        "environment": "local",
        "version": "0.2.0",
    }
