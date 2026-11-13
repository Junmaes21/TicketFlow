from conftest import register_and_login


def test_register_and_login(client):
    res = client.post(
        "/api/register", json={"username": "ana", "password": "claveana1"}
    )
    assert res.status_code == 201
    assert res.get_json()["role"] == "admin"  # primer usuario = admin

    res = client.post(
        "/api/login", json={"username": "ana", "password": "claveana1"}
    )
    assert res.status_code == 200
    assert "token" in res.get_json()


def test_login_wrong_password(client):
    client.post("/api/register", json={"username": "ana", "password": "claveana1"})
    res = client.post("/api/login", json={"username": "ana", "password": "mala"})
    assert res.status_code == 401


def test_protected_route_needs_token(client):
    res = client.get("/api/tickets")
    assert res.status_code == 401


def test_second_user_is_member(client):
    client.post("/api/register", json={"username": "admin1", "password": "clave1234"})
    res = client.post("/api/register", json={"username": "bob", "password": "clave1234"})
    assert res.get_json()["role"] == "member"
