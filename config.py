import os
import secrets

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Configuración de la aplicación (rama fixed).

    La clave para firmar los JWT viene de una variable de entorno.
    Si no existe (por ejemplo en un entorno local nuevo) se genera una
    aleatoria al arrancar, en vez de caer en un valor fijo que cualquiera
    que lea el repositorio podría conocer.
    """

    SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or secrets.token_hex(32)

    DATABASE = os.environ.get(
        "DATABASE_PATH", os.path.join(BASE_DIR, "ticketflow.db")
    )

    UPLOAD_FOLDER = os.environ.get(
        "UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads")
    )

    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB por adjunto

    JWT_ALGORITHM = "HS256"
    JWT_EXP_MINUTES = 60
