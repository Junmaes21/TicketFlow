# Cómo armar la rama "vulnerable"

Esta carpeta no es una app aparte, es el conjunto de piezas que hay que
pegar sobre el código de la rama `fixed` para volver a introducir los 4
fallos. La idea es la misma que la del artículo de referencia: dos ramas
casi iguales, con las diferencias justas para que cada escáner encuentre
algo.

Pasos, ya dentro del repo en git, parado en una rama nueva llamada
`vulnerable` creada desde `main` (nunca desde `fixed`, para que el commit
con el secreto no quede también en el historial de `fixed`):

1. Reemplaza `config.py` por el `config.py` de esta carpeta (clave
   hardcodeada, fallo 3).
2. Reemplaza `requirements.txt` por el de esta carpeta (versiones viejas
   con CVEs, fallo 2).
3. Abre `app.py` y pega encima las dos funciones de
   `app_routes_snippet.py` (fallo 1, path traversal, y fallo 4, XSS
   almacenado). Vas a tener que quitar el decorador de ruta duplicado si
   Flask se queja, basta con borrar la versión vieja de esas dos funciones
   antes de pegar la nueva.
4. Dentro de `static/js/app.js`, en la función `renderTicketDetail`,
   reemplaza el bloque que arma cada comentario por el de
   `static/js/app_comment_render_snippet.js`.
5. Haz commit y push a `vulnerable`.

Con eso el pipeline debería fallar en los 4 jobs de escaneo (Semgrep,
Dependency-Check, detect-secrets y ZAP) y el job de despliegue ni siquiera
se ejecuta, porque depende de que los cuatro pasen.
