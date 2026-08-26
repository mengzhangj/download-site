/* ============ 精选软件站 · 逻辑（v2 液态玻璃 + 提交 + 管理） ============ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const grid = $("grid"), loading = $("loading"), empty = $("empty");
  const searchInput = $("searchInput"), searchClear = $("searchClear");
  const filterBar = $("filterBar"), navCount = $("navCount");
  const themeBtn = $("themeBtn");

  let DATA = null;
  let activeCat = "all";
  let keyword = "";

  const ADMIN_KEY = "site-admin-pwd";     // 密码哈希
  const CFG_KEY = "site-form-key";        // Web3Forms access key
  const DEFAULT_PWD = "admin888";         // 默认密码（登录后请修改）

  /* ================= 主题 ================= */
  const savedTheme = localStorage.getItem("site-theme") || "dark";
  applyTheme(savedTheme);
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("site-theme", next);
  });
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    themeBtn.textContent = t === "dark" ? "🌙" : "☀️";
  }

  /* ================= 数据加载与渲染 ================= */
  fetch("software.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then((data) => { DATA = data; render(); })
    .catch((err) => {
      loading.innerHTML = `<p style="color:#e34d59">加载失败：${err.message}<br>请刷新重试</p>`;
    });

  function render() {
    const list = filter();
    loading.hidden = true;
    navCount.textContent = DATA.software.length + " 款软件";
    renderChips();
    renderGrid(list);
    empty.hidden = list.length !== 0;
  }

  function renderChips() {
    const cats = ["all", ...new Set(DATA.software.map((s) => s.category || "其他"))];
    filterBar.innerHTML = "";
    cats.forEach((c) => {
      const b = document.createElement("button");
      b.className = "chip" + (c === activeCat ? " active" : "");
      b.dataset.cat = c;
      b.textContent = c === "all" ? "全部" : c;
      b.addEventListener("click", () => {
        activeCat = c;
        renderChips();
        renderGrid(filter());
        empty.hidden = filter().length !== 0;
      });
      filterBar.appendChild(b);
    });
  }

  function filter() {
    const kw = keyword.trim().toLowerCase();
    return DATA.software.filter((s) => {
      if (activeCat !== "all" && (s.category || "其他") !== activeCat) return false;
      if (!kw) return true;
      const hay = (s.name + " " + (s.desc || "") + " " + (s.tags || []).join(" ")).toLowerCase();
      return hay.includes(kw);
    });
  }

  function renderGrid(list) {
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    list.forEach((s, i) => {
      const card = document.createElement("article");
      card.className = "card glass";
      card.style.transitionDelay = Math.min(i * 45, 400) + "ms";

      const head = document.createElement("div");
      head.className = "card-head";
      head.innerHTML = `
        <div class="card-icon">${s.icon || "📦"}</div>
        <div>
          <div class="card-name">${escapeHtml(s.name)}</div>
          <div class="card-cat">${escapeHtml(s.category || "工具")}</div>
        </div>`;

      const desc = document.createElement("div");
      desc.className = "card-desc";
      desc.textContent = s.desc || "";

      const meta = document.createElement("div");
      meta.className = "card-meta";
      if (s.version) meta.innerHTML += `<span class="meta-tag">v${escapeHtml(s.version)}</span>`;
      if (s.size) meta.innerHTML += `<span class="meta-tag">${escapeHtml(s.size)}</span>`;
      if (s.os) meta.innerHTML += `<span class="meta-tag">${escapeHtml(s.os)}</span>`;

      card.appendChild(head);
      card.appendChild(desc);
      card.appendChild(meta);

      if (s.note) {
        const note = document.createElement("div");
        note.className = "card-note";
        note.textContent = s.note;
        card.appendChild(note);
      }

      if (s.file) {
        const btn = document.createElement("a");
        btn.className = "btn-download";
        btn.href = s.file;
        btn.download = s.file.split("/").pop();
        btn.innerHTML = `⬇️ 下载`;
        card.appendChild(btn);
      } else if (s.external) {
        const btn = document.createElement("a");
        btn.className = "btn-download";
        btn.href = s.external;
        btn.target = "_blank";
        btn.rel = "noopener";
        btn.innerHTML = `🌐 前往官网`;
        card.appendChild(btn);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn-download pending";
        btn.textContent = "⏳ 待上传";
        card.appendChild(btn);
      }

      frag.appendChild(card);
    });
    grid.appendChild(frag);
    requestAnimationFrame(() => {
      grid.querySelectorAll(".card").forEach((c) => c.classList.add("show"));
    });
  }

  /* ================= 搜索 ================= */
  let debounceTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      keyword = searchInput.value;
      searchClear.hidden = !keyword;
      renderGrid(filter());
      empty.hidden = filter().length !== 0;
    }, 120);
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    keyword = "";
    searchClear.hidden = true;
    renderGrid(filter());
    empty.hidden = false;
    searchInput.focus();
  });

  /* ================= 弹窗通用 ================= */
  function openModal(id) { $(id).classList.add("show"); }
  function closeModal(id) { $(id).classList.remove("show"); }
  document.querySelectorAll(".modal-close").forEach((b) => {
    b.addEventListener("click", () => closeModal(b.dataset.close));
  });
  document.querySelectorAll(".overlay").forEach((o) => {
    o.addEventListener("click", (e) => { if (e.target === o) o.classList.remove("show"); });
  });
  $("submitBtn").addEventListener("click", () => openModal("submitOverlay"));
  $("adminLink").addEventListener("click", (e) => {
    e.preventDefault();
    openModal("adminOverlay");
    syncAdminUi();
  });

  /* ================= 提交软件（FormSubmit → 管理员邮箱） ================= */
  const ADMIN_EMAIL = "mengzhangj@qq.com"; // 接收提交的管理员邮箱

  $("submitForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("submitMsg");
    msg.className = "form-msg";
    msg.style.display = "none";

    const form = e.target;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "提交中…";
    try {
      const fd = new FormData(form);
      fd.append("_subject", "📦 软件站新提交：软件推荐");
      fd.append("_template", "table");
      fd.append("_captcha", "false");
      const r = await fetch("https://formsubmit.co/ajax/" + ADMIN_EMAIL, { method: "POST", body: fd });
      const j = await r.json();
      if (j.success === "true" || j.success === true) {
        msg.className = "form-msg ok";
        msg.textContent = "✅ 提交成功！管理员审核通过后即会上架，感谢推荐。";
        msg.style.display = "block";
        form.reset();
      } else {
        throw new Error(j.message || "提交失败");
      }
    } catch (err) {
      msg.className = "form-msg err";
      msg.textContent = "❌ " + (err.message || "提交失败，请重试");
      msg.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "提交审核";
    }
  });

  /* ================= 管理面板 ================= */
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  let adminAuthed = false;

  function syncAdminUi() {
    const authed = adminAuthed;
    $("adminLogin").style.display = authed ? "none" : "";
    $("adminContent").hidden = !authed;
  }

  $("adminLoginBtn").addEventListener("click", async () => {
    const pwd = $("adminPwd").value;
    const msg = $("loginMsg");
    msg.style.display = "none";
    const stored = localStorage.getItem(ADMIN_KEY) || await sha256(DEFAULT_PWD);
    const hash = await sha256(pwd);
    if (hash === stored) {
      adminAuthed = true;
      localStorage.setItem(ADMIN_KEY, stored);
      msg.style.display = "none";
      syncAdminUi();
    } else {
      msg.className = "form-msg err";
      msg.textContent = "❌ 密码错误";
      msg.style.display = "block";
    }
  });

  $("saveCfg").addEventListener("click", () => {
    alert("✅ 提交收件邮箱已固定为：" + ADMIN_EMAIL + "\n用户提交的软件会直接发送到该邮箱");
  });

  $("changePwd").addEventListener("click", async () => {
    const pwd = $("newPwd").value;
    if (pwd.length < 6) { alert("密码至少 6 位"); return; }
    localStorage.setItem(ADMIN_KEY, await sha256(pwd));
    $("newPwd").value = "";
    alert("✅ 密码已修改");
  });

  /* ================= 背景光效跟随 ================= */
  const orbs = document.querySelectorAll(".orb");
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / innerWidth - 0.5) * 2;
    const y = (e.clientY / innerHeight - 0.5) * 2;
    orbs.forEach((o, i) => {
      o.style.translate = `${x * (12 + i * 9)}px ${y * (12 + i * 9)}px`;
    });
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
})();
