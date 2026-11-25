
"use strict";

/* =========================================================
   CURRENCY COLLECTION — FULL APPLICATION
   Coins + Banknotes + Account Savings + Charts
   Existing LocalStorage keys are preserved.
========================================================= */

const STORAGE_KEY = "currencyCollectionTracker.notes.v1";
const ACCOUNT_KEY = "currencyCollectionTracker.account.v1";
const TARGET_KEY = "currencyCollectionTracker.target.v1";

const DENOMS = [
  // BANKNOTES
  { value: 10, category: "note", label: "₹10 Note", color: "#ffca28" },
  { value: 20, category: "note", label: "₹20 Note", color: "#ef4444" },
  { value: 50, category: "note", label: "₹50 Note", color: "#2478f2" },
  { value: 100, category: "note", label: "₹100 Note", color: "#9551e9" },
  { value: 200, category: "note", label: "₹200 Note", color: "#ff8a00" },
  { value: 500, category: "note", label: "₹500 Note", color: "#96999e" },

  // COINS
  { value: 1, category: "coin", label: "₹1 Coin", color: "#8b5a2b" },
  { value: 2, category: "coin", label: "₹2 Coin", color: "#f4f4f0", textColor: "#222222" },
  { value: 5, category: "coin", label: "₹5 Coin", color: "#228b50" },
  { value: 10, category: "coin", label: "₹10 Coin", color: "#d9a07b", textColor: "#222222" },
  { value: 20, category: "coin", label: "₹20 Coin", color: "#e88aae", textColor: "#222222" }
];

let notes = loadJSON(STORAGE_KEY, []);
let accountTransactions = loadJSON(ACCOUNT_KEY, []);
let savingsTarget = loadJSON(TARGET_KEY, {
  amount: 100000,
  date: ""
});

let charts = {};

/* ------------------------- HELPERS ------------------------- */

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accountTransactions));
  localStorage.setItem(TARGET_KEY, JSON.stringify(savingsTarget));
}

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = getElement(id);
  if (el) el.textContent = value;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const d = new Date(`${value}T00:00:00`);

  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
}

function todayString() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

function createId() {
  return window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showMessage(id, message, type = "success") {
  const el = getElement(id);
  if (!el) return;

  el.textContent = message;
  el.className = `form-message ${type}`;
  el.style.display = "block";

  clearTimeout(el.messageTimer);

  el.messageTimer = setTimeout(() => {
    el.style.display = "none";
  }, 3500);
}

function getNoteAmount(note) {
  return Number(note.denomination) || 0;
}

// Older saved records without a category are treated as banknotes.
function getCategory(note) {
  return note.category === "coin" || note.type === "coin"
    ? "coin"
    : "note";
}

function isCoin(note) {
  return getCategory(note) === "coin";
}

function getNoteTotal(list = notes) {
  return list.reduce((sum, n) => sum + getNoteAmount(n), 0);
}

function getTransactionAmount(type) {
  return accountTransactions
    .filter(t => t.type === type)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

function getBankBalance() {
  return getTransactionAmount("deposit")
    - getTransactionAmount("withdrawal")
    + getTransactionAmount("transfer_in");
}

function getCashBalance() {
  return getNoteTotal() - getTransactionAmount("transfer_out");
}

function getCombinedSavings() {
  return getCashBalance() + getBankBalance();
}

function getDenomination(value, category) {
  return DENOMS.find(d =>
    d.value === Number(value) &&
    d.category === category
  );
}

function setAccountPageActive() {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === "accountPage");
  });

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === "accountPage"
    );
  });
}

/* ---------------------- INITIALIZATION ---------------------- */

document.addEventListener("DOMContentLoaded", init);

function init() {
  setDefaultDates();
  setupNavigation();
  setupDenominationPicker();
  setupCashForm();
  setupTargetSettings();
  setupAccountForms();
  setupSeriesControls();

  renderAll();
}

function setDefaultDates() {
  [
    "collectionDate",
    "depositDate",
    "withdrawalDate",
    "transferDate"
  ].forEach(id => {
    const field = getElement(id);
    if (field && !field.value) {
      field.value = todayString();
    }
  });
}

/* ------------------------- NAVIGATION ------------------------- */

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const pageId = button.dataset.page;

      document.querySelectorAll("[data-page]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === pageId);
      });

      if (pageId === "seriesPage") renderSeries();
      if (pageId === "accountPage") renderAccount();

      setTimeout(() => {
        Object.values(charts).forEach(chart => chart?.resize());
      }, 100);
    });
  });

  document.querySelectorAll("[data-page-link]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector(
        `[data-page="${button.dataset.pageLink}"]`
      )?.click();
    });
  });
}

/* -------------------- COIN / NOTE PICKER -------------------- */

function setupDenominationPicker() {
  const picker = getElement("denominationPicker");
  const denominationInput = getElement("denomination");

  if (!picker || !denominationInput) return;

  let categoryInput = getElement("denominationType");

  if (!categoryInput) {
    categoryInput = document.createElement("input");
    categoryInput.type = "hidden";
    categoryInput.id = "denominationType";

    denominationInput.insertAdjacentElement(
      "afterend",
      categoryInput
    );
  }

  const buttonHTML = item => `
    <button
      type="button"
      class="denomination-option ${item.category}-option"
      data-value="${item.value}"
      data-category="${item.category}"
      style="
        --denom-color:${item.color};
        --denom-text:${item.textColor || "#ffffff"};
      "
    >
      ${item.label}
    </button>
  `;

  picker.innerHTML = `
    <div class="denomination-group">
      <h4>BANKNOTES</h4>

      <div class="denomination-options">
        ${DENOMS
          .filter(d => d.category === "note")
          .map(buttonHTML)
          .join("")}
      </div>
    </div>

    <div class="denomination-group">
      <h4>COINS</h4>

      <div class="denomination-options">
        ${DENOMS
          .filter(d => d.category === "coin")
          .map(buttonHTML)
          .join("")}
      </div>
    </div>
  `;

  function toggleSerialFields(category) {
    ["prefix", "alphabet", "serial"].forEach(id => {
      const input = getElement(id);
      if (!input) return;

      const wrapper = input.closest(".form-field");

      if (wrapper) {
        wrapper.style.display =
          category === "coin" ? "none" : "";
      }

      input.required = category === "note";
    });
  }

  picker.addEventListener("click", event => {
    const button = event.target.closest(
      "[data-value][data-category]"
    );

    if (!button) return;

    denominationInput.value = button.dataset.value;
    categoryInput.value = button.dataset.category;

    picker.querySelectorAll("[data-value]").forEach(item => {
      item.classList.toggle("selected", item === button);
    });

    toggleSerialFields(button.dataset.category);
  });

  toggleSerialFields("note");
}

/* ---------------------- REGISTER CURRENCY ---------------------- */

function setupCashForm() {
  const form = getElement("noteForm");
  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const denomination = Number(
      getElement("denomination")?.value
    );

    const category =
      getElement("denominationType")?.value || "note";

    const prefix =
      getElement("prefix")?.value.trim().toUpperCase() || "";

    const alphabet =
      getElement("alphabet")?.value.trim().toUpperCase() || "";

    const serial =
      getElement("serial")?.value.trim() || "";

    const date =
      getElement("collectionDate")?.value || todayString();

    if (!getDenomination(denomination, category)) {
      showMessage(
        "formMessage",
        "Please select a coin or banknote denomination.",
        "error"
      );
      return;
    }

    if (
      category === "note" &&
      (!prefix || !alphabet || !serial)
    ) {
      showMessage(
        "formMessage",
        "Enter prefix, alphabet and serial number for a banknote.",
        "error"
      );
      return;
    }

    if (category === "note") {
      const duplicate = notes.some(n =>
        !isCoin(n) &&
        String(n.prefix).toUpperCase() === prefix &&
        String(n.alphabet).toUpperCase() === alphabet &&
        String(n.serial) === serial
      );

      if (duplicate) {
        showMessage(
          "formMessage",
          "This banknote serial number already exists.",
          "error"
        );
        return;
      }
    }

    notes.push({
      id: createId(),
      denomination,
      category,
      prefix: category === "note" ? prefix : "",
      alphabet: category === "note" ? alphabet : "",
      serial: category === "note" ? serial : "",
      date,
      createdAt: new Date().toISOString()
    });

    saveData();

    form.reset();

    if (getElement("collectionDate")) {
      getElement("collectionDate").value = todayString();
    }

    getElement("denomination").value = "";
    getElement("denominationType").value = "";

    document.querySelectorAll(
      "#denominationPicker [data-value]"
    ).forEach(button => {
      button.classList.remove("selected");
    });

    ["prefix", "alphabet", "serial"].forEach(id => {
      const input = getElement(id);

      if (input) {
        input.required = true;

        if (input.closest(".form-field")) {
          input.closest(".form-field").style.display = "";
        }
      }
    });

    showMessage(
      "formMessage",
      category === "coin"
        ? "Coin added successfully!"
        : "Banknote added successfully!"
    );

    renderAll();
  });
}

/* ------------------------ SAVINGS TARGET ------------------------ */

function setupTargetSettings() {
  const edit = getElement("editTargetButton");
  const panel = getElement("targetSettingsPanel");
  const form = getElement("targetForm");
  const cancel = getElement("cancelTargetButton");

  edit?.addEventListener("click", () => {
    if (!panel) return;

    panel.classList.toggle("open");

    if (getElement("targetInput")) {
      getElement("targetInput").value =
        savingsTarget.amount || "";
    }

    if (getElement("targetDate")) {
      getElement("targetDate").value =
        savingsTarget.date || "";
    }
  });

  cancel?.addEventListener("click", () => {
    panel?.classList.remove("open");
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();

    const amount = Number(
      getElement("targetInput")?.value
    );

    const date =
      getElement("targetDate")?.value || "";

    if (!amount || amount <= 0) {
      showMessage(
        "targetMessage",
        "Enter a valid savings target.",
        "error"
      );
      return;
    }

    savingsTarget = { amount, date };

    saveData();
    panel?.classList.remove("open");

    showMessage("targetMessage", "Savings target updated!");

    renderAll();
  });
}

/* ---------------------- ACCOUNT SAVINGS ---------------------- */

function setupAccountForms() {
  function bindMoneyForm(config) {
    const form = getElement(config.formId);
    if (!form) return;

    form.addEventListener("submit", event => {
      event.preventDefault();

      const amount = Number(
        getElement(config.amountId)?.value
      );

      const date =
        getElement(config.dateId)?.value || todayString();

      const description =
        getElement(config.descriptionId)?.value.trim() || "";

      if (!Number.isFinite(amount) || amount <= 0) {
        showMessage(
          config.messageId,
          "Enter an amount greater than zero.",
          "error"
        );
        return;
      }

      if (
        config.type === "withdrawal" &&
        amount > getBankBalance()
      ) {
        showMessage(
          config.messageId,
          "Insufficient account balance.",
          "error"
        );
        return;
      }

      accountTransactions.push({
        id: createId(),
        type: config.type,
        amount,
        date,
        description,
        createdAt: new Date().toISOString()
      });

      saveData();
      form.reset();

      if (getElement(config.dateId)) {
        getElement(config.dateId).value = todayString();
      }

      showMessage(
        config.messageId,
        config.type === "deposit"
          ? "Deposit saved successfully."
          : "Withdrawal recorded successfully."
      );

      renderAll();
      setAccountPageActive();
    });
  }

  bindMoneyForm({
    formId: "depositForm",
    amountId: "depositAmount",
    dateId: "depositDate",
    descriptionId: "depositDescription",
    type: "deposit",
    messageId: "depositMessage"
  });

  bindMoneyForm({
    formId: "withdrawalForm",
    amountId: "withdrawalAmount",
    dateId: "withdrawalDate",
    descriptionId: "withdrawalDescription",
    type: "withdrawal",
    messageId: "withdrawalMessage"
  });

  const transferForm = getElement("transferForm");

  transferForm?.addEventListener("submit", event => {
    event.preventDefault();

    const amount = Number(
      getElement("transferAmount")?.value
    );

    const date =
      getElement("transferDate")?.value || todayString();

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage(
        "transferMessage",
        "Enter an amount greater than zero.",
        "error"
      );
      return;
    }

    if (amount > getCashBalance()) {
      showMessage(
        "transferMessage",
        "Insufficient available cash for this transfer.",
        "error"
      );
      return;
    }

    const transferId = createId();
    const createdAt = new Date().toISOString();

    accountTransactions.push(
      {
        id: `${transferId}-out`,
        transferId,
        type: "transfer_out",
        amount,
        date,
        description: "Cash transferred to bank",
        createdAt
      },
      {
        id: `${transferId}-in`,
        transferId,
        type: "transfer_in",
        amount,
        date,
        description: "Received from cash collection",
        createdAt
      }
    );

    saveData();
    transferForm.reset();

    if (getElement("transferDate")) {
      getElement("transferDate").value = todayString();
    }

    showMessage(
      "transferMessage",
      "Cash transferred to account successfully!"
    );

    renderAll();
    setAccountPageActive();
  });
}

/* ------------------------- RENDER ALL ------------------------- */

function renderAll() {
  renderDashboard();
  renderTarget();
  renderDenominationSummary();
  renderRecentNotes();
  renderAccount();
  renderCharts();
  renderSeries();
}

function renderDashboard() {
  const today = todayString();

  const todayCurrency = notes
    .filter(n => n.date === today)
    .reduce((sum, n) => sum + getNoteAmount(n), 0);

  const todayAccount = accountTransactions
    .filter(t => t.date === today)
    .reduce((sum, t) => {
      if (["deposit", "transfer_in"].includes(t.type)) {
        return sum + Number(t.amount || 0);
      }

      if (["withdrawal", "transfer_out"].includes(t.type)) {
        return sum - Number(t.amount || 0);
      }

      return sum;
    }, 0);

  const coins = notes.filter(isCoin);
  const banknotes = notes.filter(n => !isCoin(n));

  // Existing HTML dashboard fields
  setText("totalNotes", notes.length);
  setText("totalAmount", money(getCashBalance()));
  setText("todayAmount", money(todayCurrency + todayAccount));
  setText(
    "collectionDays",
    new Set(notes.map(n => n.date).filter(Boolean)).size
  );

  // Optional counters if added to HTML later
  setText("totalCoins", coins.length);
  setText("totalBanknotes", banknotes.length);
  setText("coinValue", money(getNoteTotal(coins)));
  setText("banknoteValue", money(getNoteTotal(banknotes)));
  setText("accountBalance", money(getBankBalance()));
  setText("totalWealth", money(getCombinedSavings()));
}

/* ----------------------- TARGET PROGRESS ----------------------- */

function renderTarget() {
  const target = Number(savingsTarget.amount) || 0;
  const total = getCombinedSavings();

  const remaining = Math.max(0, target - total);

  const percentage = target > 0
    ? Math.min(100, total / target * 100)
    : 0;

  setText("targetPercentage", `${percentage.toFixed(1)}%`);
  setText("remainingTarget", money(remaining));
  setText("targetAmountLabel", money(target));

  const fill = getElement("targetProgressFill");

  if (fill) {
    fill.style.width = `${percentage}%`;
  }

  const status = getElement("targetStatus");

  if (status) {
    status.textContent = !target
      ? "Set your savings target"
      : percentage >= 100
        ? "Target achieved!"
        : `${money(remaining)} remaining to reach your goal`;
  }

  updateChart("targetChart", {
    type: "doughnut",
    data: {
      labels: ["Saved", "Remaining"],
      datasets: [{
        data: [total, remaining],
        backgroundColor: ["#28d7c5", "#27334a"],
        borderWidth: 0
      }]
    },
    options: doughnutOptions()
  });
}

/* -------------------- DENOMINATION CARDS -------------------- */

function renderDenominationSummary() {
  const container = getElement("denominationSummary");
  if (!container) return;

  container.innerHTML = DENOMS.map(item => {
    const matching = notes.filter(n =>
      Number(n.denomination) === item.value &&
      getCategory(n) === item.category
    );

    const count = matching.length;
    const amount = count * item.value;

    return `
      <div
        class="denomination-card"
        style="
          --denom-color:${item.color};
          --denom-text:${item.textColor || "#ffffff"};
        "
      >
        <div class="denomination-card-top">
          <span class="denomination-value">${item.label}</span>
          <span class="denomination-count">${count} pieces</span>
        </div>

        <div class="denomination-card-amount">
          ${money(amount)}
        </div>

        <div class="denomination-card-footer">
          <span>Collected</span>
          <span>${count} × ₹${item.value}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* ------------------------ RECENT RECORDS ------------------------ */

function renderRecentNotes() {
  const tbody = getElement("recentRows");
  if (!tbody) return;

  const recent = [...notes]
    .sort((a, b) =>
      String(b.createdAt || b.date)
        .localeCompare(String(a.createdAt || a.date))
    )
    .slice(0, 8);

  if (!recent.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No currency collected yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recent.map(n => {
    const coin = isCoin(n);

    return `
      <tr>
        <td>
          <span class="table-denomination">
            ${money(getNoteAmount(n))}
          </span>
        </td>

        <td>${coin ? "Coin" : escapeHTML(n.prefix)}</td>
        <td>${coin ? "—" : escapeHTML(n.alphabet)}</td>
        <td>${coin ? "—" : escapeHTML(n.serial)}</td>
        <td>${formatDate(n.date)}</td>
        <td>${money(getNoteAmount(n))}</td>
      </tr>
    `;
  }).join("");
}

/* ------------------------- ACCOUNT PAGE ------------------------- */

function renderAccount() {
  const bank = getBankBalance();

  setText("accountPageBalance", money(bank));

  setText(
    "totalDeposits",
    money(
      getTransactionAmount("deposit") +
      getTransactionAmount("transfer_in")
    )
  );

  setText(
    "totalWithdrawals",
    money(getTransactionAmount("withdrawal"))
  );

  const todayActivity = accountTransactions
    .filter(t => t.date === todayString())
    .reduce((sum, t) => {
      if (["deposit", "transfer_in"].includes(t.type)) {
        return sum + Number(t.amount || 0);
      }

      if (["withdrawal", "transfer_out"].includes(t.type)) {
        return sum - Number(t.amount || 0);
      }

      return sum;
    }, 0);

  setText("accountToday", money(todayActivity));
  setText("availableCash", money(getCashBalance()));
  setText("transferBankBalance", money(bank));

  renderAccountHistory();
}

function renderAccountHistory() {
  const tbody = getElement("accountRows");
  if (!tbody) return;

  const history = [...accountTransactions].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  if (!history.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          No account transactions yet.
        </td>
      </tr>
    `;
    return;
  }

  const labels = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    transfer_in: "Cash Transfer In",
    transfer_out: "Cash Transfer Out"
  };

  let running = getBankBalance();
  const balances = new Map();

  history.forEach(t => {
    balances.set(t.id, running);

    if (["deposit", "transfer_in"].includes(t.type)) {
      running -= Number(t.amount) || 0;
    }

    if (t.type === "withdrawal") {
      running += Number(t.amount) || 0;
    }
  });

  tbody.innerHTML = history.map(t => {
    const credit = ["deposit", "transfer_in"].includes(t.type);

    return `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHTML(labels[t.type] || t.type)}</td>
        <td>${escapeHTML(t.description || "—")}</td>
        <td class="positive-amount">
          ${credit ? money(t.amount) : "—"}
        </td>
        <td class="negative-amount">
          ${credit ? "—" : money(t.amount)}
        </td>
        <td>${money(balances.get(t.id) || 0)}</td>
        <td>
          <button
            type="button"
            class="delete-button"
            data-delete-transaction="${escapeHTML(t.id)}"
          >
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-delete-transaction]")
    .forEach(button => {
      button.addEventListener("click", () => {
        deleteAccountTransaction(button.dataset.deleteTransaction);
      });
    });
}

function deleteAccountTransaction(id) {
  const item = accountTransactions.find(t => t.id === id);
  if (!item) return;

  if (["transfer_in", "transfer_out"].includes(item.type)) {
    const transferId = item.transferId ||
      id.replace(/-(in|out)$/, "");

    accountTransactions = accountTransactions.filter(t =>
      t.transferId !== transferId &&
      t.id !== `${transferId}-in` &&
      t.id !== `${transferId}-out`
    );
  } else {
    accountTransactions = accountTransactions.filter(t => t.id !== id);
  }

  saveData();
  renderAll();
}

/* ----------------------------- CHARTS ----------------------------- */

function doughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#aab8d0",
          padding: 18,
          usePointStyle: true
        }
      }
    }
  };
}

function lineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index"
    },
    plugins: {
      legend: {
        labels: {
          color: "#aab8d0",
          usePointStyle: true
        }
      }
    },
    scales: {
      x: {
        ticks: { color: "#8998b2" },
        grid: { color: "rgba(255,255,255,0.04)" }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#8998b2",
          callback: value =>
            `₹${Number(value).toLocaleString("en-IN")}`
        },
        grid: { color: "rgba(255,255,255,0.06)" }
      }
    }
  };
}

function updateChart(id, config) {
  const canvas = getElement(id);

  if (!canvas || typeof Chart === "undefined") return;

  if (charts[id]) {
    charts[id].destroy();
  }

  charts[id] = new Chart(canvas, config);
}

function getRecentDates() {
  return [
    ...new Set([
      ...notes.map(n => n.date),
      ...accountTransactions.map(t => t.date)
    ].filter(Boolean))
  ].sort().slice(-30);
}

function renderCharts() {
  renderDenominationChart();
  renderDailyChart();
  renderAccountChart();
  renderCashAccountChart();
}

function renderDenominationChart() {
  const counts = DENOMS.map(d =>
    notes.filter(n =>
      Number(n.denomination) === d.value &&
      getCategory(n) === d.category
    ).length
  );

  updateChart("denominationChart", {
    type: "doughnut",
    data: {
      labels: DENOMS.map(d => d.label),
      datasets: [{
        data: counts,
        backgroundColor: DENOMS.map(d => d.color),
        borderColor: "rgba(255,255,255,.5)",
        borderWidth: 1,
        hoverOffset: 10
      }]
    },
    options: doughnutOptions()
  });

  const legend = getElement("pieLegend");

  if (legend) {
    legend.innerHTML = DENOMS.map((d, i) => `
      <div class="legend-item">
        <span
          class="legend-dot"
          style="background:${d.color}"
        ></span>
        <span>${d.label}</span>
        <strong>${counts[i]}</strong>
      </div>
    `).join("");
  }
}

function renderDailyChart() {
  const dates = getRecentDates();

  const datasets = DENOMS.map(d => ({
    label: d.label,

    data: dates.map(date =>
      notes
        .filter(n =>
          n.date === date &&
          Number(n.denomination) === d.value &&
          getCategory(n) === d.category
        )
        .reduce((sum, n) => sum + getNoteAmount(n), 0)
    ),

    borderColor: d.color,
    backgroundColor: d.color,
    tension: 0.35,
    fill: false
  }));

  updateChart("dailyChart", {
    type: "line",
    data: {
      labels: dates.map(formatDate),
      datasets
    },
    options: lineOptions()
  });
}

function calculateDailyBalances() {
  const dates = getRecentDates();

  let cash = 0;
  let bank = 0;

  return dates.map(date => {
    notes
      .filter(n => n.date === date)
      .forEach(n => {
        cash += getNoteAmount(n);
      });

    accountTransactions
      .filter(t => t.date === date)
      .forEach(t => {
        const amount = Number(t.amount) || 0;

        if (t.type === "deposit" || t.type === "transfer_in") {
          bank += amount;
        }

        if (t.type === "withdrawal") {
          bank -= amount;
        }

        if (t.type === "transfer_out") {
          cash -= amount;
        }
      });

    return { date, cash, bank };
  });
}

function renderAccountChart() {
  const rows = calculateDailyBalances();
  const range = getElement("accountChartRange")?.value || "all";

  const filtered = range === "all"
    ? rows
    : rows.slice(-Number(range));

  updateChart("accountDailyChart", {
    type: "line",
    data: {
      labels: filtered.map(r => formatDate(r.date)),
      datasets: [{
        label: "Bank Balance",
        data: filtered.map(r => r.bank),
        borderColor: "#a879ff",
        backgroundColor: "rgba(168,121,255,.12)",
        fill: true,
        tension: 0.35
      }]
    },
    options: lineOptions()
  });
}

function renderCashAccountChart() {
  const rows = calculateDailyBalances();

  updateChart("cashTotalChart", {
    type: "line",
    data: {
      labels: rows.map(r => formatDate(r.date)),
      datasets: [
        {
          label: "Cash Collection Balance",
          data: rows.map(r => r.cash),
          borderColor: "#28d7c5",
          backgroundColor: "rgba(40,215,197,.10)",
          fill: true,
          tension: 0.35
        },
        {
          label: "Bank Balance",
          data: rows.map(r => r.bank),
          borderColor: "#a879ff",
          fill: false,
          tension: 0.35
        },
        {
          label: "Combined Savings",
          data: rows.map(r => r.cash + r.bank),
          borderColor: "#e7b85c",
          fill: false,
          tension: 0.35
        }
      ]
    },
    options: lineOptions()
  });
}

getElement("accountChartRange")?.addEventListener(
  "change",
  renderAccountChart
);

/* ------------------------ SERIES REGISTER ------------------------ */

function setupSeriesControls() {
  getElement("seriesSearch")?.addEventListener(
    "input",
    renderSeries
  );

  getElement("filterOptions")?.addEventListener(
    "change",
    renderSeries
  );

  getElement("seriesSort")?.addEventListener(
    "change",
    renderSeries
  );
}

function getFilteredNotes() {
  // Coins do not have banknote serial numbers.
  let result = notes.filter(n => !isCoin(n));

  const search =
    getElement("seriesSearch")?.value.trim().toLowerCase() || "";

  if (search) {
    result = result.filter(n =>
      [
        n.prefix,
        n.alphabet,
        n.serial,
        n.denomination,
        n.date
      ].join(" ").toLowerCase().includes(search)
    );
  }

  const filter =
    getElement("filterOptions")?.value || "all";

  if (filter === "duplicates") {
    const counts = {};

    notes.filter(n => !isCoin(n)).forEach(n => {
      const key = `${n.prefix}-${n.alphabet}-${n.serial}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    result = result.filter(n =>
      counts[`${n.prefix}-${n.alphabet}-${n.serial}`] > 1
    );
  } else if (filter !== "all") {
    result = result.filter(n =>
      String(n.denomination) === filter
    );
  }

  const sort =
    getElement("seriesSort")?.value || "newest";

  result.sort((a, b) => {
    if (sort === "oldest") {
      return String(a.date).localeCompare(String(b.date));
    }

    if (sort === "amount-high") {
      return getNoteAmount(b) - getNoteAmount(a);
    }

    if (sort === "amount-low") {
      return getNoteAmount(a) - getNoteAmount(b);
    }

    if (sort === "serial") {
      return String(a.serial).localeCompare(
        String(b.serial),
        undefined,
        { numeric: true }
      );
    }

    return String(b.date).localeCompare(String(a.date));
  });

  return result;
}

function getConsecutiveGroups(list) {
  const sorted = [...list].sort((a, b) =>
    `${a.prefix}-${a.alphabet}`.localeCompare(
      `${b.prefix}-${b.alphabet}`
    ) || Number(a.serial) - Number(b.serial)
  );

  const groups = [];
  let current = [];

  sorted.forEach(n => {
    const previous = current[current.length - 1];

    const same = previous &&
      previous.prefix === n.prefix &&
      previous.alphabet === n.alphabet;

    if (
      !current.length ||
      (same && Number(n.serial) === Number(previous.serial) + 1)
    ) {
      current.push(n);
    } else {
      if (current.length > 1) groups.push(current);
      current = [n];
    }
  });

  if (current.length > 1) groups.push(current);

  return groups;
}

function renderSeries() {
  const tbody = getElement("seriesRows");
  if (!tbody) return;

  const filtered = getFilteredNotes();
  const groups = getConsecutiveGroups(filtered);
  const allNotes = notes.filter(n => !isCoin(n));

  const keys = allNotes.map(n =>
    `${n.prefix}-${n.alphabet}-${n.serial}`
  );

  const duplicateCount =
    keys.length - new Set(keys).size;

  setText("seriesCount", allNotes.length);

  setText(
    "prefixCount",
    new Set(allNotes.map(n => n.prefix)).size
  );

  setText("groupCount", groups.length);
  setText("resultCount", filtered.length);

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No matching banknotes found.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtered.map((n, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${money(getNoteAmount(n))}</td>
        <td>${escapeHTML(n.prefix)}</td>
        <td>${escapeHTML(n.alphabet)}</td>
        <td>${escapeHTML(n.serial)}</td>
        <td>
          <strong>
            ${escapeHTML(n.prefix)}-${escapeHTML(n.alphabet)}-${escapeHTML(n.serial)}
          </strong>
        </td>
        <td>${formatDate(n.date)}</td>
        <td>
          <button
            type="button"
            class="delete-button"
            data-delete-note="${escapeHTML(n.id)}"
          >
            Delete
          </button>
        </td>
      </tr>
    `).join("");
  }

  tbody.querySelectorAll("[data-delete-note]").forEach(button => {
    button.addEventListener("click", () => {
      deleteNote(button.dataset.deleteNote);
    });
  });

  const summary = getElement("seriesSummary");

  if (summary) {
    summary.textContent =
      `${filtered.length} banknotes shown • ` +
      `${money(filtered.reduce((s, n) => s + getNoteAmount(n), 0))} filtered value • ` +
      `${groups.length} consecutive groups • ` +
      `${duplicateCount} duplicate serial entries`;
  }
}

function deleteNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  if (!confirm(
    `Delete ${money(getNoteAmount(note))} ${isCoin(note) ? "coin" : "banknote"}?`
  )) return;

  notes = notes.filter(n => n.id !== id);

  saveData();
  renderAll();
}

console.log(
  "Currency Collection loaded:",
  notes.length,
  "currency pieces"
);
