# TicketFlow

Gestor de tickets de soporte (tipo mini Jira) hecho con Flask + SQLite.
Permite crear cuentas, abrir tickets, comentarlos y adjuntar archivos.

Este proyecto existe en dos versiones:

- **Rama `vulnerable`**: tiene 4 fallos de seguridad puestos a propósito.
- **Rama `fixed`**: los mismos 4 fallos, corregidos.

Un pipeline de GitHub Actions revisa cada cambio con 4 escáneres gratuitos
(Semgrep, OWASP Dependency-Check, detect-secrets y OWASP ZAP) y solo si todos
pasan, despliega la aplicación en Render.

## Los 4 fallos (rama vulnerable)

1. **Path traversal** al descargar un adjunto (`Semgrep`).
2. **Dependencias desactualizadas** con CVEs conocidos (`Dependency-Check`).
3. **Secreto hardcodeado** usado para firmar los JWT (`detect-secrets`).
4. **XSS almacenado** en los comentarios de un ticket (`OWASP ZAP`).

El código de esta versión (fixed) ya tiene los 4 corregidos. Los archivos que
cambian en la versión vulnerable están en `vulnerable_version/`.

## Cómo correrlo localmente

```bash
python -m venv venv
source venv/bin/activate          # en Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
python app.py
```

La aplicación queda en `http://localhost:5000`. El primer usuario que se
registra queda como administrador, el resto como miembro.

## Correr las pruebas

```bash
pytest -q
```

## Variables de entorno

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `JWT_SECRET_KEY` | Firma los tokens de sesión | No (si falta, se genera una aleatoria al arrancar) |
| `DATABASE_PATH` | Ruta del archivo SQLite | No |
| `UPLOAD_FOLDER` | Carpeta donde se guardan los adjuntos | No |
| `PORT` | Puerto en el que escucha gunicorn | No (Render lo define solo) |

## Despliegue

Pensado para Render, usando `render.yaml` y un Deploy Hook disparado solo
desde el pipeline (ver el artículo para el detalle completo).
