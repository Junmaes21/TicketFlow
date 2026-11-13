# Estas dos funciones reemplazan a las correspondientes en app.py para
# armar la rama "vulnerable". No es un archivo que se ejecute solo, es la
# pieza que se pega encima del app.py de la rama fixed.
#
# No se toca nada de auth.py, db.py ni config.py salvo el config.py de esta
# misma carpeta (la clave hardcodeada).

import os

from flask import request, jsonify, g, send_file

from db import query


# FALLO 1: path traversal.
# En vez de guardar el archivo con un nombre generado por el servidor y
# buscarlo por id en la base de datos, este endpoint arma la ruta en disco
# directamente con el nombre que manda el cliente. Si alguien pide
# "../../../../app.py" o la ruta de otro adjunto, el servidor lo entrega
# igual, porque nunca valida que el resultado siga estando dentro de
# uploads/.
@app.get("/api/tickets/<int:ticket_id>/attachments/<path:filename>")
@login_required
def download_attachment(ticket_id, filename):
    ticket = query("SELECT * FROM tickets WHERE id = ?", (ticket_id,), one=True)
    if ticket is None:
        return jsonify(error="ticket no encontrado"), 404

    file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    return send_file(file_path, as_attachment=True)


# FALLO 4: XSS almacenado.
# El comentario se guarda y se devuelve tal cual lo escribió la persona, sin
# escapar nada. Si el comentario trae <script>...</script>, ese texto llega
# intacto a quien lo lea.
@app.get("/api/tickets/<int:ticket_id>")
@login_required
def get_ticket(ticket_id):
    ticket = query("SELECT * FROM tickets WHERE id = ?", (ticket_id,), one=True)
    if ticket is None:
        return jsonify(error="ticket no encontrado"), 404

    comments = query(
        """SELECT comments.id, comments.body, comments.created_at,
                  users.username AS author
           FROM comments JOIN users ON users.id = comments.author_id
           WHERE ticket_id = ? ORDER BY comments.id ASC""",
        (ticket_id,),
    )

    return jsonify(
        ticket=dict(ticket),
        comments=[
            {
                "id": c["id"],
                "author": c["author"],
                "body": c["body"],  # <-- sin escape
                "created_at": c["created_at"],
            }
            for c in comments
        ],
    )
