(() => {
  const API_BASE = "/journals";
  const { escapeHtml, formatDate, apiRequest } = window.OneSpace;

  const listEl = document.getElementById("journalList");
  const emptyEl = document.getElementById("journalEmpty");
  const statusEl = document.getElementById("journalStatus");

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

  // JournalListItem only has: id, title, entry_date, updated_at — no content,
  // so the list view can't show a snippet. Edit fetches the full record.
  function renderEntries(entries) {
    listEl.innerHTML = "";

    if (!entries || entries.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    for (const entry of entries) {
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
          <button class="icon-btn" data-action="edit">Edit</button>
          <button class="icon-btn icon-btn--danger" data-action="delete">Delete</button>
        </div>
      `;
      listEl.appendChild(card);
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
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = e.target.closest(".journal-card");
    const id = card.dataset.id;

    if (btn.dataset.action === "edit") {
      btn.disabled = true;
      try {
        const entry = await apiRequest(`${API_BASE}/${id}`);
        openModal({ id: entry.id, title: entry.title, content: entry.content || "" });
      } catch (err) {
        showStatus(`Couldn't load entry: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    }

    if (btn.dataset.action === "delete") {
      pendingDeleteId = id;
      deleteOverlay.hidden = false;
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