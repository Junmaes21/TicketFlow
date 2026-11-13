// Reemplaza, dentro de renderTicketDetail() en static/js/app.js, el bloque
// que arma cada comentario. En la rama vulnerable se usa innerHTML con el
// texto tal como llega del servidor, así que si el comentario trae
// <script>, el navegador lo ejecuta.

data.comments.forEach((c) => {
  const div = document.createElement("div");
  div.className = "comment";
  div.innerHTML = `<div class="author">${c.author}</div><div>${c.body}</div>`;
  list.appendChild(div);
});
