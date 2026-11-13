import io

from conftest import register_and_login


def test_create_and_list_ticket(client):
    token = register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/tickets",
        json={"title": "Impresora rota", "description": "No responde"},
        headers=headers,
    )
    assert res.status_code == 201

    res = client.get("/api/tickets", headers=headers)
    assert res.status_code == 200
    assert len(res.get_json()) == 1


def test_member_cannot_see_others_tickets(client):
    admin_token = register_and_login(client, "admin1", "clave1234")
    member_token = register_and_login(client, "bob", "clave1234")

    client.post(
        "/api/tickets",
        json={"title": "Ticket admin", "description": "x"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    res = client.get(
        "/api/tickets", headers={"Authorization": f"Bearer {member_token}"}
    )
    assert res.get_json() == []


def test_comment_is_escaped_on_output(client):
    """Si alguien comenta <script>alert(1)</script>, la API nunca debe
    devolverlo como HTML ejecutable."""
    token = register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    ticket = client.post(
        "/api/tickets",
        json={"title": "t", "description": "d"},
        headers=headers,
    ).get_json()

    client.post(
        f"/api/tickets/{ticket['id']}/comments",
        json={"body": "<script>alert(1)</script>"},
        headers=headers,
    )

    detail = client.get(f"/api/tickets/{ticket['id']}", headers=headers).get_json()
    body = detail["comments"][0]["body"]
    assert "<script>" not in body
    assert "&lt;script&gt;" in body


def test_attachment_download_rejects_unknown_id(client):
    """No se puede descargar un adjunto pasando una ruta o un id que no
    existe: el servidor siempre resuelve el nombre real en disco el mismo,
    nunca a partir de lo que mande el cliente."""
    token = register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    ticket = client.post(
        "/api/tickets",
        json={"title": "t", "description": "d"},
        headers=headers,
    ).get_json()

    res = client.get(
        f"/api/tickets/{ticket['id']}/attachments/999", headers=headers
    )
    assert res.status_code == 404


def test_upload_and_download_attachment(client):
    token = register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    ticket = client.post(
        "/api/tickets",
        json={"title": "t", "description": "d"},
        headers=headers,
    ).get_json()

    data = {"file": (io.BytesIO(b"contenido de prueba"), "log.txt")}
    res = client.post(
        f"/api/tickets/{ticket['id']}/attachments",
        data=data,
        headers=headers,
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    attachment_id = res.get_json()["id"]

    res = client.get(
        f"/api/tickets/{ticket['id']}/attachments/{attachment_id}", headers=headers
    )
    assert res.status_code == 200
    assert res.data == b"contenido de prueba"
