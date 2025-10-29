/* ===================
   To-Do Quest SPA
   localStorage persistence
   =================== */

// ---------- Storage ----------
const STORAGE_KEY = "todoQuestState";

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load state", e);
    return null;
  }
}

// ---------- Model (with persistence) ----------
let state = loadState() || {
  tasks: [],       // tasks with {id,text,date,completed,color,projectId|null}
  projects: [],    // projects with {id,name,color,tasks:[]}
  currentProjectId: null
};

function persist() {
  saveState(state);
}

// small unique id helper
function uid(prefix="id") {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

// ---------- Page templates ----------
const pages = {
  inbox: `
    <h2 class="page-title">📥 Inbox</h2>
    <div class="task-input">
      <input type="text" id="taskTitle" placeholder="Enter a new task..." />
      <input type="date" id="taskDate" />
      <button id="addTaskBtn">Add Task</button>
      <button id="completeAllBtn" title="Mark all inbox tasks completed">Mark All Completed</button>
    </div>
    <ul id="taskList"></ul>
  `,
  today: `
    <h2 class="page-title">☀️ Today</h2>
    <p id="todayDate" class="small"></p>
    <ul id="todayTaskList"></ul>
  `,
  projects: `
    <h2 class="page-title">📂 Projects</h2>
    <div class="projects-layout">
      <div class="project-panel">
        <div class="project-input">
          <input type="text" id="projectName" placeholder="New project name..." />
          <input type="color" id="projectColor" value="#2575fc" />
          <button id="addProjectBtn">Add Project</button>
        </div>
        <ul id="projectList" class="project-list"></ul>
      </div>
      <div class="project-tasks" id="projectTasksContainer">
        <p class="placeholder">Select a project to view tasks</p>
      </div>
    </div>
  `
};

// ---------- Page loader ----------
const content = document.getElementById("app-content");

function setActiveNav(page) {
  document.querySelectorAll(".nav-links a").forEach(a => {
    a.classList.toggle("active", a.getAttribute("data-page") === page);
  });
}

function loadPage(page) {
  content.classList.remove("show");
  setTimeout(() => {
    content.innerHTML = pages[page] || `<h2>404 - Page not found</h2>`;
    content.classList.add("show");
    setActiveNav(page);

    if (page === "inbox") initInbox();
    if (page === "today") initToday();
    if (page === "projects") initProjects();
  }, 120);
}

// Navbar wiring
document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const page = link.getAttribute("data-page");
    loadPage(page);
  });
});

// initial load
loadPage("inbox");

// ---------- Utilities ----------
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  } catch { return dateStr; }
}

// ---------- Inbox ----------
function initInbox() {
  const taskInput = document.getElementById("taskTitle");
  const taskDate = document.getElementById("taskDate");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const completeAllBtn = document.getElementById("completeAllBtn");
  const taskList = document.getElementById("taskList");

  function inboxTasks() {
    return state.tasks.filter(t => !t.projectId);
  }

  function renderTasks() {
    taskList.innerHTML = "";
    inboxTasks().forEach(task => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.completed ? " completed" : "");
      const left = document.createElement("div");
      left.className = "task-left";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!task.completed;
      cb.addEventListener("change", () => {
        task.completed = cb.checked;
        persist(); renderTasks();
      });

      const textWrap = document.createElement("div");
      textWrap.className = "text";
      textWrap.contentEditable = true;
      textWrap.spellcheck = false;
      textWrap.textContent = task.text + (task.date ? ` (${formatDate(task.date)})` : "");
      // on blur update text (strip the date part if user didn't keep it)
      textWrap.addEventListener("blur", () => {
        // if user changed, keep the part before " ("
        const raw = textWrap.textContent || "";
        const newText = raw.split(" (")[0].trim() || task.text;
        task.text = newText;
        persist(); renderTasks();
      });

      left.appendChild(cb);
      left.appendChild(textWrap);

      const right = document.createElement("div");
      right.className = "row";
      const meta = document.createElement("div");
      meta.className = "task-meta";
      meta.textContent = task.date ? formatDate(task.date) : "";

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.textContent = "🗑";
      del.addEventListener("click", () => {
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        persist(); renderTasks();
      });

      right.appendChild(meta);
      right.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);

      taskList.appendChild(li);
    });
  }

  function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    const date = taskDate.value || "";
    const newTask = { id: uid("task"), text, date, completed: false, color: "#2575fc", projectId: null };
    state.tasks.push(newTask);
    persist();
    taskInput.value = ""; taskDate.value = "";
    renderTasks();
  }

  addTaskBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", e => { if (e.key === "Enter") addTask(); });

  completeAllBtn.addEventListener("click", () => {
    inboxTasks().forEach(t => t.completed = true);
    persist(); renderTasks();
  });

  renderTasks();
}

// ---------- Today ----------
function initToday() {
  const todayDateEl = document.getElementById("todayDate");
  const todayTaskList = document.getElementById("todayTaskList");
  const today = new Date().toISOString().split("T")[0];
  todayDateEl.textContent = `Today: ${new Date().toLocaleDateString()}`;

  function render() {
    todayTaskList.innerHTML = "";
    const tasksForToday = state.tasks.filter(t => t.date === today || (!t.date && false) /* keep explicit date-match only */)
      .concat(state.projects.flatMap(p => p.tasks ? p.tasks.filter(t => t.date === today) : []))
      .filter(Boolean);

    if (!tasksForToday.length) {
      todayTaskList.innerHTML = "<p class='placeholder'>No tasks for today 🎉</p>";
      return;
    }

    tasksForToday.forEach(task => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.completed ? " completed" : "");
      const left = document.createElement("div");
      left.className = "task-left";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!task.completed;
      cb.addEventListener("change", () => {
        task.completed = cb.checked;
        persist(); render();
      });

      const span = document.createElement("div");
      span.className = "text";
      span.textContent = task.text;

      left.appendChild(cb);
      left.appendChild(span);

      li.appendChild(left);
      todayTaskList.appendChild(li);
    });
  }

  render();
}

// ---------- Projects ----------
function initProjects() {
  const projectNameInput = document.getElementById("projectName");
  const projectColorInput = document.getElementById("projectColor");
  const addProjectBtn = document.getElementById("addProjectBtn");
  const projectList = document.getElementById("projectList");
  const projectTasksContainer = document.getElementById("projectTasksContainer");

  function renderProjects() {
    projectList.innerHTML = "";
    state.projects.forEach(proj => {
      const li = document.createElement("li");
      li.className = "project-item";
      const left = document.createElement("div");
      left.className = "row";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = proj.name;
      name.style.marginRight = "8px";

      const count = document.createElement("div");
      count.className = "count";
      count.textContent = `${(proj.tasks||[]).length} tasks`;

      left.appendChild(name);
      left.appendChild(count);

      const right = document.createElement("div");
      right.className = "row";
      const del = document.createElement("button");
      del.className = "delete-btn";
      del.textContent = "🗑";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        state.projects = state.projects.filter(p => p.id !== proj.id);
        if (state.currentProjectId === proj.id) state.currentProjectId = null;
        persist(); renderProjects(); renderProjectTasks();
      });

      right.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);

      li.style.borderLeft = `6px solid ${proj.color || "#2575fc"}`;
      li.addEventListener("click", () => {
        state.currentProjectId = proj.id;
        persist();
        renderProjects();
        renderProjectTasks();
      });

      if (state.currentProjectId === proj.id) {
        li.style.background = "#eef7ff";
      }

      projectList.appendChild(li);
    });

    if (!state.projects.length) {
      projectList.innerHTML = `<p class="placeholder">No projects yet. Add one!</p>`;
    }
  }

  function renderProjectTasks() {
    projectTasksContainer.innerHTML = "";
    const proj = state.projects.find(p => p.id === state.currentProjectId);
    if (!proj) {
      projectTasksContainer.innerHTML = `<p class="placeholder">Select a project to view tasks</p>`;
      return;
    }

    const header = document.createElement("h3");
    header.textContent = `📂 ${proj.name}`;
    projectTasksContainer.appendChild(header);

    // input area
    const taskInputDiv = document.createElement("div");
    taskInputDiv.className = "task-input";
    taskInputDiv.innerHTML = `
      <input type="text" id="projTaskTitle" placeholder="New task..." />
      <input type="date" id="projTaskDate" />
      <button id="addProjTaskBtn">Add Task</button>
      <button id="completeProjBtn">Mark All Completed</button>
    `;
    projectTasksContainer.appendChild(taskInputDiv);

    const ul = document.createElement("ul");
    (proj.tasks||[]).forEach(task => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.completed ? " completed" : "");
      li.style.borderLeft = `6px solid ${proj.color}`;

      const left = document.createElement("div");
      left.className = "task-left";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!task.completed;
      cb.addEventListener("change", () => {
        task.completed = cb.checked;
        persist(); renderProjectTasks();
      });

      const textDiv = document.createElement("div");
      textDiv.className = "text";
      textDiv.contentEditable = true;
      textDiv.textContent = task.text + (task.date ? ` (${formatDate(task.date)})` : "");
      textDiv.addEventListener("blur", () => {
        task.text = (textDiv.textContent || "").split(" (")[0].trim() || task.text;
        persist(); renderProjectTasks();
      });

      left.appendChild(cb);
      left.appendChild(textDiv);

      const right = document.createElement("div");
      right.className = "row";
      const del = document.createElement("button");
      del.className = "delete-btn";
      del.textContent = "🗑";
      del.addEventListener("click", () => {
        proj.tasks = proj.tasks.filter(t => t.id !== task.id);
        persist(); renderProjectTasks(); renderProjects();
      });

      right.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });

    projectTasksContainer.appendChild(ul);

    // wire buttons after injecting
    document.getElementById("addProjTaskBtn").addEventListener("click", () => {
      const title = document.getElementById("projTaskTitle").value.trim();
      const date = document.getElementById("projTaskDate").value || "";
      if (!title) return;
      proj.tasks = proj.tasks || [];
      proj.tasks.push({ id: uid("pt"), text: title, date, completed: false });
      persist(); renderProjectTasks(); renderProjects();
      document.getElementById("projTaskTitle").value = "";
      document.getElementById("projTaskDate").value = "";
    });

    document.getElementById("completeProjBtn").addEventListener("click", () => {
      (proj.tasks||[]).forEach(t => t.completed = true);
      persist(); renderProjectTasks();
    });
  }

  function addProject() {
    const name = projectNameInput.value.trim();
    const color = projectColorInput.value || "#2575fc";
    if (!name) return;
    const newProj = { id: uid("proj"), name, color, tasks: [] };
    state.projects.push(newProj);
    state.currentProjectId = newProj.id;
    persist();
    projectNameInput.value = "";
    renderProjects();
    renderProjectTasks();
  }

  addProjectBtn.addEventListener("click", addProject);
  projectNameInput.addEventListener("keypress", e => { if (e.key === "Enter") addProject(); });

  // initial render
  renderProjects();
  renderProjectTasks();
}

// Expose loadPage to window for possible external calls
window.loadPage = loadPage;
