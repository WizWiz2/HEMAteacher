import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import load_settings
from app.main import create_app
from app.storage.drills import CheckpointModel, DrillModel


def test_library_lists_configured_footwork():
    client = TestClient(create_app())
    response = client.get("/api/v1/movements")
    assert response.status_code == 200
    body = response.json()
    ids = {item["id"] for item in body}
    assert ids >= {"advance", "retreat", "passing-step-forward", "passing-step-backward", "cross-step"}
    assert all(set(item) >= {"id", "name", "camera_view"} for item in body)


def test_beginner_drill_library_is_data_driven():
    client = TestClient(create_app())
    listing = client.get("/api/v1/drills")
    assert listing.status_code == 200
    body = listing.json()
    ids = {item["id"] for item in body}
    assert ids >= {
        "advance", "retreat", "passing-step-forward", "passing-step-backward", "guards-basic",
        "zornhau", "krumphau", "zwerchhau", "schielhau", "scheitelhau",
    }
    detail = client.get("/api/v1/drills/passing-step-forward")
    assert detail.status_code == 200
    drill = detail.json()
    assert drill["cameraView"] == "side"
    assert drill["unvalidated"] is True
    assert drill["trackingMode"] == "full_body"
    assert len(drill["checkpoints"]) >= 4
    assert len({item["id"] for item in drill["checkpoints"]}) == len(drill["checkpoints"])


def test_invalid_checkpoint_schema_is_rejected():
    with pytest.raises(ValidationError):
        CheckpointModel.model_validate({
            "id": "bad", "title": "bad", "holdMs": 100,
            "constraints": {"foot_distance": {"target": 1.0}},
        })
    with pytest.raises(ValidationError):
        CheckpointModel.model_validate({
            "id": "bad", "title": "bad", "holdMs": 100,
            "constraints": {"foot_distance": {"min": 2.0, "max": 1.0}},
        })
    with pytest.raises(ValidationError):
        CheckpointModel.model_validate({
            "id": "bad", "title": "bad", "holdMs": 100, "passThreshold": 0.2,
            "constraints": {"foot_distance": {"target": 1.0, "tolerance": 0.2}},
        })


def test_duplicate_checkpoint_ids_are_rejected():
    cp = {
        "id": "same", "title": "x", "holdMs": 100,
        "constraints": {"foot_distance": {"target": 1.0, "tolerance": 0.2}},
    }
    with pytest.raises(ValidationError):
        DrillModel.model_validate({
            "id": "bad-drill", "name": "bad", "description": "",
            "cameraView": "side", "checkpoints": [cp, cp],
        })


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


def test_guards_use_upper_body_mode_and_optional_weapon_tracking():
    client = TestClient(create_app())
    drill = client.get("/api/v1/drills/guards-basic").json()
    assert drill["trackingMode"] == "upper_body"
    assert drill["weaponTracking"] == "optional"
    vom_tag = drill["checkpoints"][0]
    assert vom_tag["passThreshold"] < 0.7
    assert "hand_center_y" in vom_tag["requiredFeatures"]
