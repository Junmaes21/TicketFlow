# TicketFlow

Gestor de tickets de soporte creado con Flask y SQLite. Permite crear cuentas, abrir tickets, comentarlos, adjuntar archivos y probar las protecciones desde un laboratorio interactivo.

## Enlaces

- **Aplicación pública:** [ticketflow-j1xn.onrender.com](https://ticketflow-j1xn.onrender.com)
- **Repositorio:** [Junmaes21/TicketFlow](https://github.com/Junmaes21/TicketFlow)
- **Artículo en Medium:** [No todo lo que pasa en verde es seguro: escaneo de vulnerabilidades en TicketFlow](https://medium.com/@juniormaes21/no-todo-lo-que-pasa-en-verde-es-seguro-escaneo-de-vulnerabilidades-en-ticketflow-081656335166)

Registra una cuenta para entrar. En una base de datos vacía, la primera cuenta es administradora; las siguientes son miembros. No uses información real: es una aplicación demostrativa.

## Ramas y escaneo

- **`fixed`** contiene la aplicación corregida y es la única rama que puede desplegarse.
- **`vulnerable`** conserva cuatro fallos intencionales para mostrar el comportamiento de los análisis. No se despliega.

GitHub Actions ejecuta pruebas, Ruff, Semgrep, OWASP Dependency-Check y detect-secrets. En `fixed`, además ejecuta OWASP ZAP contra la aplicación candidata local; Render recibe la orden de despliegue solo si todos esos pasos pasan.

Los escáneres tienen límites conocidos: Semgrep puede no detectar el path traversal en la ruta ensayada, y Dependency-Check no siempre identifica versiones vulnerables de paquetes Python cuando no encuentra un CPE. ZAP corre contra la candidata antes del despliegue, pero su análisis anónimo no recorre funciones que requieren iniciar sesión. El pipeline no equivale a una garantía de que la aplicación esté libre de vulnerabilidades.

## Ejecutar localmente

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
ruff check app.py auth.py config.py db.py wsgi.py tests
```

## Variables de entorno

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `JWT_SECRET_KEY` | Firma los tokens de sesión | No (si falta, se genera una aleatoria al arrancar) |
| `DATABASE_PATH` | Ruta del archivo SQLite | No |
| `UPLOAD_FOLDER` | Carpeta donde se guardan los adjuntos | No |
| `PORT` | Puerto en el que escucha gunicorn | No (Render lo define solo) |

## Despliegue

Render usa `render.yaml` y recibe un Deploy Hook después de que el pipeline de `fixed` pasa. El plan gratuito usa almacenamiento efímero, por lo que los tickets y adjuntos pueden perderse cuando el servicio se reinicia o despliega de nuevo.
