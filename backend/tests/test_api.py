from fastapi.testclient import TestClient

from app.config import load_settings
from app.main import create_app


def test_library_lists_configured_footwork():
    client = TestClient(create_app())
    response = client.get("/api/v1/movements")
    assert response.status_code == 200
    body = response.json()
    ids = {item["id"] for item in body}
    assert ids >= {"advance", "retreat", "passing-step-forward", "passing-step-backward", "cross-step"}
    assert all(set(item) >= {"id", "name", "camera_view"} for item in body)
    detail = client.get("/api/v1/movements/passing-step-forward")
    assert detail.status_code == 200
    assert detail.json()["camera_view"] == "side"
    assert "passing" in detail.json()["name"].lower() or "Passing" in detail.json()["name"]


def test_unknown_movement_is_404():
    client = TestClient(create_app())
    assert client.get("/api/v1/movements/not-a-thing").status_code == 404


def test_delete_session_removes_metadata(tmp_path):
    settings = load_settings().model_copy(update={"data_dir": tmp_path})
    app = create_app(settings)
    session_id = "abc123abc123abc123abc123abc123ab"
    app.state.store.create(session_id, "advance", "2026-01-01T00:00:00+00:00", "video")
    client = TestClient(app)
    assert client.get(f"/api/v1/sessions/{session_id}").status_code == 200
    assert client.delete(f"/api/v1/sessions/{session_id}").status_code == 204
    assert client.get(f"/api/v1/sessions/{session_id}").status_code == 404
