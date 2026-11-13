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
const authSwitch = $("#auth-switch");
const authForm = $("#auth-form");
const authError = $("#auth-error");

authSwitch.addEventListener("click", (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? "Crear cuenta" : "Iniciar sesión";
  authSwitch.textContent = isRegisterMode
    ? "¿Ya tienes cuenta? Inicia sesión"
    : "¿No tienes cuenta? Regístrate";
});

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
      isRegisterMode = false;
      authTitle.textContent = "Iniciar sesión";
      authError.textContent = "Cuenta creada, ya puedes iniciar sesión.";
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

  tickets.forEach((t) => {
    const card = document.createElement("div");
    card.className = "ticket-card";

    const title = document.createElement("h4");
    title.textContent = t.title; // textContent: nunca interpreta HTML

    const pill = document.createElement("span");
    pill.className = `status-pill ${t.status}`;
    pill.textContent = t.status;

    card.appendChild(title);
    card.appendChild(pill);
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
    await fetch(`${API}/tickets/${currentTicketId}/comments`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ body: textarea.value }),
    });
    openTicket(currentTicketId);
  });
  container.appendChild(form);
}

$("#close-detail").addEventListener("click", () => {
  $("#ticket-detail").classList.add("hidden");
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
      output.textContent = "Creando un comentario con <script> en un ticket propio...";
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
