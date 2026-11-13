import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Configuración de la aplicación (rama vulnerable).

    FALLO 3: la clave para firmar los JWT está escrita directamente en el
    código. Cualquiera que lea el repositorio la conoce, y como Flask usa
    esta misma clave para firmar las sesiones, quien la tenga podría
    falsificar la sesión de cualquier usuario sin conocer su contraseña.
    """

    SECRET_KEY = "ticketflow-dev-secret-2024"

    DATABASE = os.environ.get(
        "DATABASE_PATH", os.path.join(BASE_DIR, "ticketflow.db")
    )

    UPLOAD_FOLDER = os.environ.get(
        "UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads")
    )

    MAX_CONTENT_LENGTH = 5 * 1024 * 1024

    JWT_ALGORITHM = "HS256"
    JWT_EXP_MINUTES = 60
