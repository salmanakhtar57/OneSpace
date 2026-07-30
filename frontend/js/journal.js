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
  const entryDateInput = document.getElementById("entryDate");
  const titleInput = document.getElementById("entryTitle");
  const contentInput = document.getElementById("entryContent");
  const formError = document.getElementById("formError");

  const deleteOverlay = document.getElementById("deleteOverlay");
  let pendingDeleteId = null;

  // Calendar elements (left panel)
  const calGridEl = document.getElementById("calendarGrid");
  const calMonthLabelEl = document.getElementById("calMonthLabel");
  const calPrevBtn = document.getElementById("calPrevBtn");
  const calNextBtn = document.getElementById("calNextBtn");
  const calTodayBtn = document.getElementById("calTodayBtn");

  // All entries as last loaded from the API (unfiltered), plus a
  // date-keyed lookup used by the calendar to know which days have entries.
  let allEntries = [];
  let entriesByDate = new Map();

  // Calendar view state: which month is showing, and which day (if any)
  // the user has selected — selecting a day opens/creates that day's entry.
  let viewDate = startOfMonth(new Date());
  let selectedKey = null;

  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  // ---------- date helpers ----------
  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  // Local yyyy-mm-dd key (not UTC) so entries line up with the day the
  // user actually wrote them on.
  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function groupEntriesByDate(entries) {
    const map = new Map();
    for (const entry of entries) {
      const key = dateKey(new Date(entry.entry_date));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
    }
    return map;
  }

  // ---------- stat cards (week / month counts, always over ALL entries) ----------
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

    if (!entries || entries.length === 0) return;

    const sorted = [...entries].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));

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

  // Re-renders the right-hand list from allEntries (always the full,
  // unfiltered list). Selecting a calendar day no longer filters this list —
  // it only opens/creates the entry for that day (see handleDaySelect).
  function renderList() {
    const { weekCount, monthCount } = computeStats(allEntries);
    statWeekCount.textContent = String(weekCount);
    statMonthCount.textContent = String(monthCount);

    renderEntries(allEntries);
    emptyEl.hidden = allEntries.length > 0;
  }

  // ---------- calendar (left panel) ----------
  function renderCalendar() {
    calMonthLabelEl.textContent = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    calGridEl.innerHTML = "";

    const firstOfMonth = startOfMonth(viewDate);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0).getDate();
    const todayKey = dateKey(new Date());
    const totalCells = 42;
    const cellDates = [];

    for (let i = 0; i < firstWeekday; i++) {
      const dayNum = daysInPrevMonth - firstWeekday + 1 + i;
      cellDates.push({ date: new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, dayNum), otherMonth: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cellDates.push({ date: new Date(viewDate.getFullYear(), viewDate.getMonth(), d), otherMonth: false });
    }
    while (cellDates.length < totalCells) {
      const idx = cellDates.length - (firstWeekday + daysInMonth);
      cellDates.push({ date: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, idx + 1), otherMonth: true });
    }

    for (const { date, otherMonth } of cellDates) {
      const key = dateKey(date);
      const dayEntries = entriesByDate.get(key) || [];

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "calendar-day";
      if (otherMonth) cell.classList.add("calendar-day--other-month");
      if (key === todayKey) cell.classList.add("calendar-day--today");
      if (key === selectedKey) cell.classList.add("calendar-day--selected");
      if (dayEntries.length > 0) cell.classList.add("calendar-day--has-entries");
      cell.dataset.date = key;

      cell.innerHTML = `
        <span class="calendar-day__num">${date.getDate()}</span>
        ${dayEntries.length > 0 ? `<span class="calendar-day__dot"></span>` : ""}
      `;

      cell.addEventListener("click", () => handleDaySelect(key));
      calGridEl.appendChild(cell);
    }
  }

  // Selecting a day: highlight it, and — if there's exactly one entry that
  // day — open it straight into the editor; if there are none, open a
  // blank entry pre-dated to that day so new entries land on the day the
  // user actually picked, not "today".
  async function handleDaySelect(key) {
    selectedKey = selectedKey === key ? null : key;
    renderCalendar();

    if (!selectedKey) return;

    const dayEntries = entriesByDate.get(selectedKey) || [];
    if (dayEntries.length === 1) {
      await openEntryById(dayEntries[0].id);
    } else if (dayEntries.length === 0) {
      openModal({ date: selectedKey });
    }
    // If there's more than one entry that day, leave it to the list on the
    // right — the user picks which one to open.
  }

  async function openEntryById(id) {
    try {
      const entry = await apiRequest(`${API_BASE}/${id}`);
      openModal({
        id: entry.id,
        title: entry.title,
        content: entry.content || "",
        date: dateKey(new Date(entry.entry_date)),
      });
    } catch (err) {
      showStatus(`Couldn't load entry: ${err.message}`);
    }
  }

  calPrevBtn.addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    renderCalendar();
  });
  calNextBtn.addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    renderCalendar();
  });
  calTodayBtn.addEventListener("click", () => {
    viewDate = startOfMonth(new Date());
    renderCalendar();
  });

  // ---------- loading ----------
  async function loadEntries() {
    showStatus("Loading entries…");
    try {
      allEntries = await apiRequest(`${API_BASE}/`);
      entriesByDate = groupEntriesByDate(allEntries);
      showStatus("");
      renderCalendar();
      renderList();
    } catch (err) {
      showStatus(`Couldn't load entries: ${err.message}`);
      emptyEl.hidden = true;
      listEl.innerHTML = "";
    }
  }

  // ---------- entry modal (create / edit) ----------
  function openModal({ id = "", title = "", content = "", date = "" } = {}) {
    entryIdInput.value = id;
    entryDateInput.value = date || dateKey(new Date());
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
      entry_date: entryDateInput.value,
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

    const deleteBtn = e.target.closest('button[data-action="delete"]');
    if (deleteBtn) {
      pendingDeleteId = id;
      deleteOverlay.hidden = false;
      return;
    }

    card.style.cursor = "wait";
    try {
      await openEntryById(id);
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