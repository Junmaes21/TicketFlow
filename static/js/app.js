const API = "/api";
let token = null;
let currentUser = null;
let currentTicketId = null;

const $ = (sel) => document.querySelector(sel);

// ---------- tema ----------
const themeToggle = $("#theme-toggle");
themeToggle.addEventListener("click", () => {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
});

// ---------- auth ----------
let isRegisterMode = false;
const authTitle = $("#auth-title");
const authDescription = $("#auth-description");
const authForm = $("#auth-form");
const authError = $("#auth-error");

function setAuthMode(registerMode) {
  isRegisterMode = registerMode;
  $("#login-tab").classList.toggle("active", !registerMode);
  $("#login-tab").setAttribute("aria-selected", String(!registerMode));
  $("#register-tab").classList.toggle("active", registerMode);
  $("#register-tab").setAttribute("aria-selected", String(registerMode));
  authTitle.textContent = registerMode ? "Crea tu cuenta" : "Bienvenido de nuevo";
  authDescription.textContent = registerMode
    ? "Regístrate para empezar a crear y seguir tus solicitudes."
    : "Ingresa tus datos para continuar con tus solicitudes.";
  $("#auth-submit").textContent = registerMode ? "Crear cuenta" : "Iniciar sesión";
  $("#auth-password").autocomplete = registerMode ? "new-password" : "current-password";
  authError.textContent = "";
  authError.classList.remove("success");
}

$("#login-tab").addEventListener("click", () => setAuthMode(false));
$("#register-tab").addEventListener("click", () => setAuthMode(true));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const username = $("#auth-username").value.trim();
  const password = $("#auth-password").value;

  try {
    if (isRegisterMode) {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setAuthMode(false);
      authError.textContent = "Cuenta creada. Ahora inicia sesión con tus datos.";
      authError.classList.add("success");
      return;
    }

    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    token = data.token;
    currentUser = { username: data.username, role: data.role };
    enterApp();
  } catch (err) {
    authError.textContent = err.message || "error de autenticacion";
  }
});

$("#logout-btn").addEventListener("click", () => {
  token = null;
  currentUser = null;
  $("#app-screen").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
});

function enterApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");
  $("#current-username").textContent = currentUser.username;
  $("#profile-mark").textContent = currentUser.username.charAt(0).toUpperCase();
  $("#current-role").textContent = currentUser.role;
  loadTickets();
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

// ---------- tickets ----------
$("#ticket-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#ticket-title").value.trim();
  const description = $("#ticket-description").value.trim();

  const res = await fetch(`${API}/tickets`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title, description }),
  });
  if (res.ok) {
    $("#ticket-form").reset();
    loadTickets();
  }
});

async function loadTickets() {
  const res = await fetch(`${API}/tickets`, { headers: authHeaders() });
  const tickets = await res.json();
  const board = $("#tickets-board");
  board.innerHTML = "";
  $("#ticket-count").textContent = `${tickets.length} ${tickets.length === 1 ? "solicitud" : "solicitudes"}`;
  if (tickets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "Todavía no tienes tickets";
    const hint = document.createElement("span");
    hint.className = "muted";
    hint.textContent = "Usa el formulario de arriba para crear tu primera solicitud.";
    empty.append(title, hint);
    board.appendChild(empty);
    return;
  }

  tickets.forEach((t) => {
    const card = document.createElement("div");
    card.className = "ticket-card";

    const title = document.createElement("h4");
    title.textContent = t.title; // textContent: nunca interpreta HTML

    const pill = document.createElement("span");
    pill.className = `status-pill ${t.status}`;
    pill.textContent = t.status;

    card.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "ticket-meta";
    const prompt = document.createElement("span");
    prompt.textContent = "Abrir detalles";
    meta.append(prompt, pill);
    card.appendChild(meta);
    card.addEventListener("click", () => openTicket(t.id));
    board.appendChild(card);
  });
}

async function openTicket(id) {
  currentTicketId = id;
  const res = await fetch(`${API}/tickets/${id}`, { headers: authHeaders() });
  const data = await res.json();
  renderTicketDetail(data);
  $("#ticket-detail").classList.remove("hidden");
  $("#app-screen").classList.add("ticket-open");
}

function renderTicketDetail(data) {
  const container = $("#ticket-detail-content");
  container.innerHTML = ""; // se reconstruye con nodos, no con HTML de usuario

  const h2 = document.createElement("h2");
  h2.textContent = data.ticket.title;

  const desc = document.createElement("p");
  desc.textContent = data.ticket.description;

  container.appendChild(h2);
  container.appendChild(desc);

  const commentsTitle = document.createElement("h3");
  commentsTitle.textContent = "Comentarios";
  container.appendChild(commentsTitle);

  const list = document.createElement("div");
  data.comments.forEach((c) => {
    const div = document.createElement("div");
    div.className = "comment";

    const author = document.createElement("div");
    author.className = "author";
    author.textContent = c.author;

    const body = document.createElement("div");
    body.className = "comment-body";
    // clave de la correccion del XSS: textContent escapa cualquier cosa
    // que el usuario haya escrito, nunca se interpreta como HTML/JS
    body.textContent = c.body;

    div.appendChild(author);
    div.appendChild(body);
    list.appendChild(div);
  });
  container.appendChild(list);

  const form = document.createElement("form");
  form.innerHTML = `<textarea placeholder="Escribe un comentario"></textarea>
                     <button type="submit" class="btn-primary">Comentar</button>`;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textarea = form.querySelector("textarea");
    const res = await fetch(`${API}/tickets/${currentTicketId}/comments`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ body: textarea.value }),
    });
    if (res.ok) {
      await openTicket(currentTicketId);
    } else {
      showTicketMessage(await responseError(res, "No se pudo guardar el comentario."));
    }
  });
  container.appendChild(form);

  const attachmentsTitle = document.createElement("h3");
  attachmentsTitle.textContent = "Adjuntos";
  container.appendChild(attachmentsTitle);

  const attachmentList = document.createElement("div");
  attachmentList.className = "attachment-list";
  if (data.attachments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Este ticket todavía no tiene archivos.";
    attachmentList.appendChild(empty);
  }

  data.attachments.forEach((attachment) => {
    const row = document.createElement("div");
    row.className = "attachment-row";
    const name = document.createElement("span");
    name.textContent = attachment.name;
    const download = document.createElement("button");
    download.type = "button";
    download.className = "btn-ghost";
    download.textContent = "Descargar";
    download.addEventListener("click", () => downloadAttachment(attachment));
    row.append(name, download);
    attachmentList.appendChild(row);
  });
  container.appendChild(attachmentList);

  const uploadForm = document.createElement("form");
  uploadForm.className = "attachment-form";
  uploadForm.innerHTML = `<p class="muted">Tamaño máximo: 5 MB por archivo.</p>
                          <input type="file" name="file" required />
                          <button type="submit" class="btn-primary">Subir archivo</button>`;
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = uploadForm.querySelector('input[type="file"]').files[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`${API}/tickets/${currentTicketId}/attachments`, {
      method: "POST",
      headers: authHeaders(),
      body,
    });
    if (res.ok) {
      await openTicket(currentTicketId);
    } else {
      showTicketMessage(await responseError(res, "No se pudo subir el archivo."));
    }
  });
  container.appendChild(uploadForm);

  const message = document.createElement("p");
  message.id = "ticket-action-message";
  message.className = "error";
  message.setAttribute("aria-live", "polite");
  container.appendChild(message);
}

function showTicketMessage(message) {
  const target = $("#ticket-action-message");
  if (target) target.textContent = message;
}

async function responseError(response, fallback) {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

async function downloadAttachment(attachment) {
  try {
    const res = await fetch(
      `${API}/tickets/${currentTicketId}/attachments/${attachment.id}`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error(await responseError(res, "Descarga fallida."));
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    showTicketMessage(err.message || "No se pudo descargar el archivo.");
  }
}

$("#close-detail").addEventListener("click", () => {
  $("#ticket-detail").classList.add("hidden");
  $("#app-screen").classList.remove("ticket-open");
});

// ---------- laboratorio de seguridad ----------
document.querySelectorAll(".btn-lab").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const lab = btn.dataset.lab;
    const output = $("#lab-output");

    if (!token) {
      output.textContent = "Inicia sesion primero para correr el laboratorio.";
      return;
    }

    if (lab === "xss") {
      output.textContent = "Probando un comentario que contiene una etiqueta script...";
      try {
        const ticketRes = await fetch(`${API}/tickets`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: "Demostración XSS almacenado",
            description: "Ticket creado por el laboratorio de seguridad.",
          }),
        });
        if (!ticketRes.ok) throw new Error("No se pudo crear el ticket de prueba.");
        const ticket = await ticketRes.json();
        const payload = "<script>alert('xss')</script>";
        const commentRes = await fetch(`${API}/tickets/${ticket.id}/comments`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ body: payload }),
        });
        if (!commentRes.ok) throw new Error("No se pudo crear el comentario de prueba.");
        const detailRes = await fetch(`${API}/tickets/${ticket.id}`, {
          headers: authHeaders(),
        });
        if (!detailRes.ok) throw new Error("No se pudo comprobar el comentario de prueba.");
        const detail = await detailRes.json();
        const safeComment = detail.comments.find((comment) =>
          comment.body.includes("&lt;script&gt;"),
        );
        if (!safeComment) throw new Error("La API no escapó el contenido de prueba.");
        await loadTickets();
        await openTicket(ticket.id);
        const renderedComment = $(".comment-body");
        if (!renderedComment || renderedComment.textContent !== safeComment.body) {
          throw new Error("La interfaz no mostró el comentario como texto escapado.");
        }
        output.textContent =
          "BLOQUEADO ✅\nLa API escapó las etiquetas y la interfaz las mostró como texto. Revisa el ticket que se abrió.";
      } catch (err) {
        output.textContent = err.message || "No se pudo completar la prueba XSS.";
      }
      return;
    }

    const res = await fetch(`${API}/security-lab/${lab}`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    output.textContent = data.blocked
      ? `BLOQUEADO ✅\n${data.detail}`
      : `NO BLOQUEADO ❌\n${data.detail}`;
  });
});
