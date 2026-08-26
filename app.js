/* ============ 精选软件站 · 逻辑 ============ */
(() => {
  "use strict";

  const grid = document.getElementById("grid");
  const loading = document.getElementById("loading");
  const empty = document.getElementById("empty");
  const searchInput = document.getElementById("searchInput");
  const searchClear = document.getElementById("searchClear");
  const filterBar = document.getElementById("filterBar");
  const navCount = document.getElementById("navCount");
  const themeBtn = document.getElementById("themeBtn");

  let DATA = null;       // software.json 数据
  let activeCat = "all"; // 当前分类
  let keyword = "";      // 搜索词

  /* ---- 主题 ---- */
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

  /* ---- 加载数据 ---- */
  fetch("software.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then((data) => { DATA = data; render(); })
    .catch((err) => {
      loading.innerHTML = `<p style="color:#e34d59">加载失败：${err.message}<br>请刷新重试</p>`;
    });

  /* ---- 渲染 ---- */
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
      card.className = "card";
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
        btn.addEventListener("click", () => {
          if (window.umami) umami.track("download", { name: s.name });
        });
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

    // 淡入动画
    requestAnimationFrame(() => {
      grid.querySelectorAll(".card").forEach((c) => c.classList.add("show"));
    });
  }

  /* ---- 搜索 ---- */
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

  /* ---- 背景光效跟随鼠标 ---- */
  const orbs = document.querySelectorAll(".orb");
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / innerWidth - 0.5) * 2;
    const y = (e.clientY / innerHeight - 0.5) * 2;
    orbs.forEach((o, i) => {
      o.style.translate = `${x * (10 + i * 8)}px ${y * (10 + i * 8)}px`;
    });
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
})();
