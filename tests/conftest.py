import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from config import Config


class TestConfig(Config):
    pass


@pytest.fixture
def app():
    db_fd, db_path = tempfile.mkstemp()
    upload_dir = tempfile.mkdtemp()

    class _Cfg(TestConfig):
        DATABASE = db_path
        UPLOAD_FOLDER = upload_dir
        SECRET_KEY = "test-secret-only-for-pytest-01234567890123456789"

    app = create_app(_Cfg)
    app.config.update(TESTING=True)

    yield app

    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    return app.test_client()


def register_and_login(client, username="demo", password="demo1234"):
    client.post("/api/register", json={"username": username, "password": password})
    res = client.post("/api/login", json={"username": username, "password": password})
    return res.get_json()["token"]
