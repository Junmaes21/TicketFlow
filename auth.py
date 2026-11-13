from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from db import query


def generate_token(user_id, username, role):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),  # PyJWT exige que "sub" sea un string
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=current_app.config["JWT_EXP_MINUTES"]),
    }
    return jwt.encode(
        payload,
        current_app.config["SECRET_KEY"],
        algorithm=current_app.config["JWT_ALGORITHM"],
    )


def decode_token(token):
    # algorithms= fijo: evita el ataque de "algorithm confusion" (alg=none
    # o cambiar RS256 por HS256) que afecta a versiones viejas de PyJWT.
    return jwt.decode(
        token,
        current_app.config["SECRET_KEY"],
        algorithms=[current_app.config["JWT_ALGORITHM"]],
    )


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify(error="falta token de autenticacion"), 401

        token = auth_header.removeprefix("Bearer ").strip()
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify(error="token expirado"), 401
        except jwt.InvalidTokenError:
            return jsonify(error="token invalido"), 401

        user = query(
            "SELECT id, username, role FROM users WHERE id = ?",
            (int(payload["sub"]),),
            one=True,
        )
        if user is None:
            return jsonify(error="usuario no encontrado"), 401

        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if g.current_user["role"] != "admin":
            return jsonify(error="se requiere rol de administrador"), 403
        return f(*args, **kwargs)

    return wrapper
