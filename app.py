import os
import uuid

from flask import Flask, request, jsonify, g, render_template, send_from_directory, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

from config import Config
from db import get_db, close_db, init_db, query, execute
from auth import generate_token, login_required, admin_required


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    app.teardown_appcontext(close_db)

    with app.app_context():
        init_db(app)

    register_routes(app)
    return app


def ticket_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "status": row["status"],
        "owner_id": row["owner_id"],
        "created_at": row["created_at"],
    }


def register_routes(app):

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.post("/api/register")
    def register():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        if len(username) < 3 or len(password) < 6:
            return jsonify(error="usuario minimo 3 caracteres, password minimo 6"), 400

        existing = query("SELECT id FROM users WHERE username = ?", (username,), one=True)
        if existing:
            return jsonify(error="el usuario ya existe"), 409

        total_users = query("SELECT COUNT(*) as c FROM users", one=True)["c"]
        role = "admin" if total_users == 0 else "member"

        password_hash = generate_password_hash(password)
        user_id = execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role),
        )
        return jsonify(id=user_id, username=username, role=role), 201

    @app.post("/api/login")
    def login():
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        user = query(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            (username,), one=True,
        )
        if user is None or not check_password_hash(user["password_hash"], password):
            return jsonify(error="credenciales invalidas"), 401

        token = generate_token(user["id"], user["username"], user["role"])
        return jsonify(token=token, username=user["username"], role=user["role"])

    @app.get("/api/tickets")
    @login_required
    def list_tickets():
        if g.current_user["role"] == "admin":
            rows = query("SELECT * FROM tickets ORDER BY id DESC")
        else:
            rows = query(
                "SELECT * FROM tickets WHERE owner_id = ? ORDER BY id DESC",
                (g.current_user["id"],),
            )
        return jsonify([ticket_to_dict(r) for r in rows])

    @app.post("/api/tickets")
    @login_required
    def create_ticket():
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()

        if not title or not description:
            return jsonify(error="titulo y descripcion son obligatorios"), 400

        ticket_id = execute(
            "INSERT INTO tickets (title, description, owner_id) VALUES (?, ?, ?)",
            (title, description, g.current_user["id"]),
        )
        row = query("SELECT * FROM tickets WHERE id = ?", (ticket_id,), one=True)
        return jsonify(ticket_to_dict(row)), 201

    def _get_owned_ticket(ticket_id):
        row = query("SELECT * FROM tickets WHERE id = ?", (ticket_id,), one=True)
        if row is None:
            return None
        if g.current_user["role"] != "admin" and row["owner_id"] != g.current_user["id"]:
            return False
        return row

    @app.get("/api/tickets/<int:ticket_id>")
    @login_required
    def get_ticket(ticket_id):
        ticket = _get_owned_ticket(ticket_id)
        if ticket is None:
            return jsonify(error="ticket no encontrado"), 404
        if ticket is False:
            return jsonify(error="no tienes acceso a este ticket"), 403

        comments = query(
            """SELECT comments.id, comments.body, comments.created_at,
                      users.username AS author
               FROM comments JOIN users ON users.id = comments.author_id
               WHERE ticket_id = ? ORDER BY comments.id ASC""",
            (ticket_id,),
        )
        attachments = query(
            "SELECT id, original_name FROM attachments WHERE ticket_id = ?",
            (ticket_id,),
        )

        return jsonify(
            ticket=ticket_to_dict(ticket),
            comments=[
                {
                    "id": c["id"],
                    "author": c["author"],
                    "body": c["body"],
                    "created_at": c["created_at"],
                }
                for c in comments
            ],
            attachments=[{"id": a["id"], "name": a["original_name"]} for a in attachments],
        )

    @app.post("/api/tickets/<int:ticket_id>/close")
    @login_required
    def close_ticket(ticket_id):
        ticket = _get_owned_ticket(ticket_id)
        if ticket is None:
            return jsonify(error="ticket no encontrado"), 404
        if ticket is False:
            return jsonify(error="no tienes acceso a este ticket"), 403

        execute("UPDATE tickets SET status = 'cerrado' WHERE id = ?", (ticket_id,))
        return jsonify(ok=True)

    @app.post("/api/tickets/<int:ticket_id>/comments")
    @login_required
    def add_comment(ticket_id):
        ticket = _get_owned_ticket(ticket_id)
        if ticket is None:
            return jsonify(error="ticket no encontrado"), 404
        if ticket is False:
            return jsonify(error="no tienes acceso a este ticket"), 403

        data = request.get_json(silent=True) or {}
        body = (data.get("body") or "").strip()
        if not body:
            return jsonify(error="el comentario no puede estar vacio"), 400

        comment_id = execute(
            "INSERT INTO comments (ticket_id, author_id, body) VALUES (?, ?, ?)",
            (ticket_id, g.current_user["id"], body),
        )
        return jsonify(id=comment_id), 201

    @app.post("/api/tickets/<int:ticket_id>/attachments")
    @login_required
    def upload_attachment(ticket_id):
        ticket = _get_owned_ticket(ticket_id)
        if ticket is None:
            return jsonify(error="ticket no encontrado"), 404
        if ticket is False:
            return jsonify(error="no tienes acceso a este ticket"), 403

        if "file" not in request.files:
            return jsonify(error="falta el archivo"), 400

        file = request.files["file"]
        original_name = secure_filename(file.filename or "")
        if not original_name:
            return jsonify(error="nombre de archivo invalido"), 400

        stored_name = f"{uuid.uuid4().hex}_{original_name}"
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], stored_name))

        attachment_id = execute(
            """INSERT INTO attachments (ticket_id, stored_name, original_name)
               VALUES (?, ?, ?)""",
            (ticket_id, stored_name, original_name),
        )
        return jsonify(id=attachment_id, name=original_name), 201

    @app.get("/api/tickets/<int:ticket_id>/attachments/<path:filename>")
    @login_required
    def download_attachment(ticket_id, filename):
        ticket = _get_owned_ticket(ticket_id)
        if ticket is None:
            return jsonify(error="ticket no encontrado"), 404
        if ticket is False:
            return jsonify(error="no tienes acceso a este ticket"), 403

        file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        return send_file(file_path, as_attachment=True)

    @app.post("/api/security-lab/path-traversal")
    @login_required
    def lab_path_traversal():
        return jsonify(
            blocked=False,
            detail="el endpoint real de descarga acepta una ruta libre",
        )

    @app.post("/api/security-lab/forge-session")
    @login_required
    def lab_forge_session():
        import jwt as pyjwt

        guessed_secret = "ticketflow-dev-secret-2024"  # pragma: allowlist secret  # nosemgrep
        forged = pyjwt.encode(
            {"sub": "1", "username": "demo", "role": "admin"},
            guessed_secret, algorithm="HS256",
        )
        try:
            pyjwt.decode(forged, app.config["SECRET_KEY"], algorithms=["HS256"])
            accepted = True
        except pyjwt.InvalidTokenError:
            accepted = False

        return jsonify(
            blocked=not accepted,
            detail="la clave real esta hardcodeada y coincide con la adivinada",
        )

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)  # nosemgrep

