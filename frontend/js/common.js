window.OneSpace = (function () {
  const API_BASE_URL = window.ONESPACE_CONFIG.API_BASE_URL;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function formatDate(value, opts = { month: "short", day: "numeric", year: "numeric" }) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, opts);
  }

  async function apiRequest(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch (_) {}
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function initMobileNav() {
    const navToggle = document.getElementById("navToggle");
    const sidebar = document.getElementById("sidebar");
    if (navToggle && sidebar) {
      navToggle.addEventListener("click", () => sidebar.classList.toggle("is-open"));
    }
  }

  // No server templating anymore, so the active sidebar item is set here:
  // each page's <body data-page="..."> is matched against sidebar links'
  // data-nav="..." attribute.
  function initActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
    const link = document.querySelector(`.sidebar__item[data-nav="${page}"]`);
    if (link) link.classList.add("sidebar__item--active");
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMobileNav();
    initActiveNav();
  });

  return { escapeHtml, formatDate, apiRequest };
})();