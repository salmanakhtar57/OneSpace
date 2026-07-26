(() => {
  const API_BASE = "/journals";
  const { escapeHtml, formatDate, apiRequest } = window.OneSpace;

  const listEl = document.getElementById("journalList");
  const emptyEl = document.getElementById("journalEmpty");
  const statusEl = document.getElementById("journalStatus");
  const statWeekCount = document.getElementById("statWeekCount");
  const statMonthCount = document.getElementById("statMonthCount");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalSave = document.getElementById("modalSave");
  const form = document.getElementById("journalForm");
  const entryIdInput = document.getElementById("entryId");
  const titleInput = document.getElementById("entryTitle");
  const contentInput = document.getElementById("entryContent");
  const formError = document.getElementById("formError");

  const deleteOverlay = document.getElementById("deleteOverlay");
  let pendingDeleteId = null;

  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  // ---------- stat cards (week / month counts) ----------
  // Week runs Monday–Sunday. Adjust here if you'd rather use a rolling
  // 7-day window instead of the calendar week.
  function getWeekBounds(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sun ... 6 = Sat
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    start.setDate(d.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  function getMonthBounds(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }

  function computeStats(entries) {
    const now = new Date();
    const week = getWeekBounds(now);
    const month = getMonthBounds(now);
    let weekCount = 0;
    let monthCount = 0;
    for (const entry of entries) {
      const d = new Date(entry.entry_date);
      if (d >= week.start && d < week.end) weekCount++;
      if (d >= month.start && d < month.end) monthCount++;
    }
    return { weekCount, monthCount };
  }

  // ---------- list grouping (by calendar month, newest first) ----------
  function groupByMonth(entries) {
    const groups = new Map();
    for (const entry of entries) {
      const d = new Date(entry.entry_date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!groups.has(key)) {
        groups.set(key, {
          label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
          items: [],
        });
      }
      groups.get(key).items.push(entry);
    }
    // entries arrive pre-sorted newest-first, so each month's first
    // appearance already puts the groups in the right (descending) order.
    return [...groups.values()];
  }

  // JournalListItem only has: id, title, entry_date, updated_at — no content,
  // so the list can't show a snippet. Clicking a card fetches the full
  // record (see the listEl click handler below) before opening it for edit.
  function renderEntries(entries) {
    listEl.innerHTML = "";

    if (!entries || entries.length === 0) {
      emptyEl.hidden = false;
      statWeekCount.textContent = "0";
      statMonthCount.textContent = "0";
      return;
    }
    emptyEl.hidden = true;

    const sorted = [...entries].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));

    const { weekCount, monthCount } = computeStats(sorted);
    statWeekCount.textContent = String(weekCount);
    statMonthCount.textContent = String(monthCount);

    for (const group of groupByMonth(sorted)) {
      const heading = document.createElement("h4");
      heading.className = "journal-section-heading";
      heading.textContent = group.label;
      listEl.appendChild(heading);

      for (const entry of group.items) {
        const card = document.createElement("article");
        card.className = "journal-card";
        card.dataset.id = entry.id;

        const entryDate = formatDate(entry.entry_date);
        const wasEdited = entry.updated_at && entry.entry_date &&
          new Date(entry.updated_at).getTime() - new Date(entry.entry_date).getTime() > 60000;

        card.innerHTML = `
          <div class="journal-card__main">
            ${entryDate ? `<p class="journal-card__date">${escapeHtml(entryDate)}</p>` : ""}
            <h3 class="journal-card__title">${escapeHtml(entry.title)}</h3>
            ${wasEdited ? `<p class="journal-card__snippet">Edited ${escapeHtml(formatDate(entry.updated_at))}</p>` : ""}
          </div>
          <div class="journal-card__actions">
            <button class="icon-btn icon-btn--danger" data-action="delete">Delete</button>
          </div>
        `;
        listEl.appendChild(card);
      }
    }
  }

  async function loadEntries() {
    showStatus("Loading entries…");
    try {
      const entries = await apiRequest(`${API_BASE}/`);
      showStatus("");
      renderEntries(entries);
    } catch (err) {
      showStatus(`Couldn't load entries: ${err.message}`);
      emptyEl.hidden = true;
      listEl.innerHTML = "";
    }
  }

  function openModal({ id = "", title = "", content = "" } = {}) {
    entryIdInput.value = id;
    titleInput.value = title;
    contentInput.value = content;
    formError.hidden = true;
    modalTitle.textContent = id ? "Edit entry" : "New entry";
    modalOverlay.hidden = false;
    titleInput.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    form.reset();
  }

  document.getElementById("newEntryBtn").addEventListener("click", () => openModal());
  document.getElementById("newEntryBtnEmpty").addEventListener("click", () => openModal());
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalCancel").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = entryIdInput.value;
    const payload = {
      title: titleInput.value.trim(),
      content: contentInput.value.trim(),
    };

    modalSave.disabled = true;
    formError.hidden = true;

    try {
      if (id) {
        await apiRequest(`${API_BASE}/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`${API_BASE}/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      loadEntries();
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    } finally {
      modalSave.disabled = false;
    }
  });

  listEl.addEventListener("click", async (e) => {
    const card = e.target.closest(".journal-card");
    if (!card) return;
    const id = card.dataset.id;

    const deleteBtn = e.target.closest(`button[data-action="delete"]`)
    if (deleteBtn) {
      pendingDeleteId = id;
      deleteOverlay.hidden = false;
      return;
    }

    card.style.cursor = "wait";
    try {
      const entry = await apiRequest(`${API_BASE}/${id}`);
      openModal({ id: entry.id, title: entry.title, content: entry.content || ""})
    } catch (err) {
      showStatus(`Couldn't load entry: ${err.message}`);
    } finally {
      card.style.cursor = "";
    }
  });

  document.getElementById("deleteClose").addEventListener("click", () => (deleteOverlay.hidden = true));
  document.getElementById("deleteCancel").addEventListener("click", () => (deleteOverlay.hidden = true));
  deleteOverlay.addEventListener("click", (e) => {
    if (e.target === deleteOverlay) deleteOverlay.hidden = true;
  });

  document.getElementById("deleteConfirm").addEventListener("click", async () => {
    if (!pendingDeleteId) return;
    try {
      await apiRequest(`${API_BASE}/${pendingDeleteId}`, { method: "DELETE" });
      deleteOverlay.hidden = true;
      pendingDeleteId = null;
      loadEntries();
    } catch (err) {
      deleteOverlay.hidden = true;
      showStatus(`Couldn't delete entry: ${err.message}`);
    }
  });

  loadEntries();
})();