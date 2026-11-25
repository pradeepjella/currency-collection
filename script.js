"use strict";

/* =========================================================
   CURRENCY VAULT — MAIN APPLICATION
   Existing currency notes are preserved.
========================================================= */

const STORAGE_KEY = "currencyCollectionTracker.notes.v1";
const ACCOUNT_KEY = "currencyCollectionTracker.account.v1";
const TARGET_KEY = "currencyCollectionTracker.target.v1";

const DENOMS = [
  { value: 10, label: "₹10", color: "#ffca28" },
  { value: 20, label: "₹20", color: "#ef4444" },
  { value: 50, label: "₹50", color: "#2478f2" },
  { value: 100, label: "₹100", color: "#9551e9" },
  { value: 200, label: "₹200", color: "#ff8a00" },
  { value: 500, label: "₹500", color: "#96999e" }
];

let notes = loadJSON(STORAGE_KEY, []);
let accountTransactions = loadJSON(ACCOUNT_KEY, []);
let savingsTarget = loadJSON(TARGET_KEY, {
  amount: 100000,
  date: ""
});

let charts = {};

/* =========================================================
   HELPERS
========================================================= */

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
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

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showMessage(id, message, type = "success") {
  const element = getElement(id);
  if (!element) return;

  element.textContent = message;
  element.className = `form-message ${type}`;
  element.style.display = "block";

  clearTimeout(element.messageTimer);

  element.messageTimer = setTimeout(() => {
    element.style.display = "none";
  }, 3500);
}

function createId() {
  return window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getNoteAmount(note) {
  return Number(note.denomination) || 0;
}

function getNoteTotal() {
  return notes.reduce((sum, note) => sum + getNoteAmount(note), 0);
}

function getTransactionAmount(type) {
  return accountTransactions
    .filter(item => item.type === type)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getBankBalance() {
  return getTransactionAmount("deposit") -
    getTransactionAmount("withdrawal") +
    getTransactionAmount("transfer_in");
}

function getCashBalance() {
  return getNoteTotal() - getTransactionAmount("transfer_out");
}

function getCombinedSavings() {
  return getCashBalance() + getBankBalance();
}

function getDenomination(value) {
  return DENOMS.find(item => item.value === Number(value));
}

/* =========================================================
   INITIALIZATION
========================================================= */

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

/* =========================================================
   DEFAULT DATES
========================================================= */

function setDefaultDates() {
  [
    "collectionDate",
    "depositDate",
    "withdrawalDate",
    "transferDate"
  ].forEach(id => {
    const field = getElement(id);
    if (field && !field.value) field.value = todayString();
  });
}

/* =========================================================
   NAVIGATION
========================================================= */

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
      const pageId = button.dataset.pageLink;
      document.querySelector(`[data-page="${pageId}"]`)?.click();
    });
  });
}

/* =========================================================
   DENOMINATION PICKER
========================================================= */

function setupDenominationPicker() {
  const picker = getElement("denominationPicker");
  const hiddenInput = getElement("denomination");

  if (!picker || !hiddenInput) return;

  picker.innerHTML = DENOMS.map(item => `
    <button
      type="button"
      class="denomination-option"
      data-value="${item.value}"
      style="--denom-color:${item.color}"
    >
      ${item.label}
    </button>
  `).join("");

  picker.addEventListener("click", event => {
    const button = event.target.closest("[data-value]");
    if (!button) return;

    hiddenInput.value = button.dataset.value;

    picker.querySelectorAll("[data-value]").forEach(item => {
      item.classList.toggle("selected", item === button);
    });
  });
}

/* =========================================================
   CASH COLLECTION
========================================================= */

function setupCashForm() {
  const form = getElement("noteForm");
  if (!form) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const denomination = Number(getElement("denomination")?.value);
    const prefix = getElement("prefix")?.value.trim().toUpperCase() || "";
    const alphabet = getElement("alphabet")?.value.trim().toUpperCase() || "";
    const serial = getElement("serial")?.value.trim() || "";
    const date = getElement("collectionDate")?.value || todayString();

    if (!getDenomination(denomination)) {
      showMessage("formMessage", "Please select a denomination.", "error");
      return;
    }

    if (!prefix || !alphabet || !serial || !date) {
      showMessage("formMessage", "Please complete all note details.", "error");
      return;
    }

    const duplicate = notes.some(note =>
      String(note.prefix).toUpperCase() === prefix &&
      String(note.alphabet).toUpperCase() === alphabet &&
      String(note.serial) === serial
    );

    if (duplicate) {
      showMessage("formMessage", "This serial number already exists.", "error");
      return;
    }

    notes.push({
      id: createId(),
      denomination,
      prefix,
      alphabet,
      serial,
      date,
      createdAt: new Date().toISOString()
    });

    saveData();
    form.reset();

    if (getElement("collectionDate")) {
      getElement("collectionDate").value = todayString();
    }

    getElement("denomination").value = "";

    document.querySelectorAll("#denominationPicker [data-value]")
      .forEach(button => button.classList.remove("selected"));

    showMessage("formMessage", "Currency note added successfully!");

    renderAll();
  });
}

/* =========================================================
   SAVINGS TARGET
========================================================= */

function setupTargetSettings() {
  const editButton = getElement("editTargetButton");
  const panel = getElement("targetSettingsPanel");
  const form = getElement("targetForm");
  const cancelButton = getElement("cancelTargetButton");

  editButton?.addEventListener("click", () => {
    if (!panel) return;

    panel.classList.toggle("open");

    const input = getElement("targetInput");
    const date = getElement("targetDate");

    if (input) input.value = savingsTarget.amount || "";
    if (date) date.value = savingsTarget.date || "";
  });

  cancelButton?.addEventListener("click", () => {
    panel?.classList.remove("open");
  });

  form?.addEventListener("submit", event => {
    event.preventDefault();

    const amount = Number(getElement("targetInput")?.value);
    const date = getElement("targetDate")?.value || "";

    if (!amount || amount <= 0) {
      showMessage("targetMessage", "Enter a valid savings target.", "error");
      return;
    }

    savingsTarget = { amount, date };

    saveData();
    panel?.classList.remove("open");

    showMessage("targetMessage", "Savings target updated!");

    renderAll();
  });
}

/* =========================================================
   ACCOUNT TRANSACTIONS
========================================================= */

function setupAccountForms() {
  const bindMoneyForm = ({
    formId,
    amountId,
    dateId,
    descriptionId,
    type,
    messageId
  }) => {
    const form = getElement(formId);
    if (!form) return;

    form.addEventListener("submit", event => {
      event.preventDefault();

      const amount = Number(getElement(amountId)?.value);
      const date = getElement(dateId)?.value || todayString();
      const description = getElement(descriptionId)?.value.trim() || "";

      if (!Number.isFinite(amount) || amount <= 0) {
        showMessage(messageId, "Enter an amount greater than zero.", "error");
        return;
      }

      if (type === "withdrawal" && amount > getBankBalance()) {
        showMessage(
          messageId,
          "Insufficient account balance for this withdrawal.",
          "error"
        );
        return;
      }

      accountTransactions.push({
        id: createId(),
        type,
        amount,
        date,
        description,
        createdAt: new Date().toISOString()
      });

      saveData();
      form.reset();

      const dateField = getElement(dateId);
      if (dateField) dateField.value = todayString();

      showMessage(
        messageId,
        type === "deposit"
          ? "Deposit saved successfully."
          : "Withdrawal recorded successfully."
      );

      renderAll();

      // Keep the user on Account Savings after saving.
      document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === "accountPage");
      });

      document.querySelectorAll("[data-page]").forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.page === "accountPage"
        );
      });
    });
  };

  // DEPOSIT FORM
  bindMoneyForm({
    formId: "depositForm",
    amountId: "depositAmount",
    dateId: "depositDate",
    descriptionId: "depositDescription",
    type: "deposit",
    messageId: "depositMessage"
  });

  // WITHDRAWAL FORM
  bindMoneyForm({
    formId: "withdrawalForm",
    amountId: "withdrawalAmount",
    dateId: "withdrawalDate",
    descriptionId: "withdrawalDescription",
    type: "withdrawal",
    messageId: "withdrawalMessage"
  });

  // CASH TO BANK TRANSFER
  const transferForm = getElement("transferForm");

  transferForm?.addEventListener("submit", event => {
    event.preventDefault();

    const amount = Number(getElement("transferAmount")?.value);
    const date = getElement("transferDate")?.value || todayString();

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

    const dateField = getElement("transferDate");
    if (dateField) dateField.value = todayString();

    showMessage(
      "transferMessage",
      "Cash transferred to account successfully."
    );

    renderAll();

    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("active", page.id === "accountPage");
    });

    document.querySelectorAll("[data-page]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === "accountPage"
      );
    });
  });
}

/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {
  renderDashboard();
  renderTarget();
  renderDenominationSummary();
  renderRecentNotes();
  renderAccount();
  renderCharts();
  renderSeries();
}

/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {
  const cash = getCashBalance();
  const bank = getBankBalance();
  const combined = cash + bank;
  const today = todayString();

  const todayNotes = notes
    .filter(note => note.date === today)
    .reduce((sum, note) => sum + getNoteAmount(note), 0);

  const todayAccount = accountTransactions
    .filter(item => item.date === today)
    .reduce((sum, item) => {
      if (item.type === "deposit" || item.type === "transfer_in") {
        return sum + Number(item.amount);
      }

      if (item.type === "withdrawal" || item.type === "transfer_out") {
        return sum - Number(item.amount);
      }

      return sum;
    }, 0);

  setText("totalAmount", money(cash));
  setText("accountBalance", money(bank));
  setText("totalWealth", money(combined));
  setText("todayAmount", money(todayNotes + todayAccount));

  setText("combinedSavings", money(combined));
  setText("targetCashAmount", money(cash));
  setText("targetBankAmount", money(bank));

  const collectionDays = new Set(notes.map(note => note.date)).size;

  setText("collectionDays", collectionDays);
  setText("totalNotes", notes.length);
  setText("totalNotesCount", notes.length);
}

function setText(id, value) {
  const element = getElement(id);
  if (element) element.textContent = value;
}

/* =========================================================
   TARGET PROGRESS
========================================================= */

function renderTarget() {
  const target = Number(savingsTarget.amount) || 0;
  const total = getCombinedSavings();
  const remaining = Math.max(0, target - total);
  const percentage = target > 0
    ? Math.min(100, (total / target) * 100)
    : 0;

  setText("targetPercentage", `${percentage.toFixed(1)}%`);
  setText("remainingTarget", money(remaining));
  setText("targetAmountLabel", money(target));

  const progress = getElement("targetProgressFill");

  if (progress) {
    progress.style.width = `${percentage}%`;
  }

  const status = getElement("targetStatus");

  if (status) {
    status.textContent = target === 0
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
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: doughnutOptions()
  });
}

/* =========================================================
   DENOMINATION SUMMARY
========================================================= */

function renderDenominationSummary() {
  const container = getElement("denominationSummary");
  if (!container) return;

  container.innerHTML = DENOMS.map(item => {
    const matching = notes.filter(note =>
      Number(note.denomination) === item.value
    );

    const count = matching.length;
    const amount = count * item.value;

    return `
      <div class="denomination-card" style="--denom-color:${item.color}">
        <div class="denomination-card-top">
          <span class="denomination-value">${item.label}</span>
          <span class="denomination-count">${count} notes</span>
        </div>
        <div class="denomination-card-amount">${money(amount)}</div>
        <div class="denomination-card-footer">
          <span>Collected</span>
          <span>${count} × ${item.value}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* =========================================================
   RECENT NOTES
========================================================= */

function renderRecentNotes() {
  const tbody = getElement("recentRows");
  if (!tbody) return;

  const recent = [...notes]
    .sort((a, b) =>
      new Date(b.createdAt || b.date) -
      new Date(a.createdAt || a.date)
    )
    .slice(0, 8);

  if (!recent.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No currency notes added yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recent.map(note => `
    <tr>
      <td>
        <span class="table-denomination">
          ${money(getNoteAmount(note))}
        </span>
      </td>
      <td>${escapeHTML(note.prefix)}</td>
      <td>${escapeHTML(note.alphabet)}</td>
      <td>${escapeHTML(note.serial)}</td>
      <td>${formatDate(note.date)}</td>
      <td>${money(getNoteAmount(note))}</td>
    </tr>
  `).join("");
}

/* =========================================================
   ACCOUNT PAGE
========================================================= */

function renderAccount() {
  const bank = getBankBalance();

  const deposits =
    getTransactionAmount("deposit") +
    getTransactionAmount("transfer_in");

  const withdrawals = getTransactionAmount("withdrawal");

  setText("accountPageBalance", money(bank));
  setText("totalDeposits", money(deposits));
  setText("totalWithdrawals", money(withdrawals));

  setText(
    "accountToday",
    money(
      accountTransactions
        .filter(item => item.date === todayString())
        .reduce((sum, item) => {
          if (["deposit", "transfer_in"].includes(item.type)) {
            return sum + Number(item.amount);
          }

          if (["withdrawal", "transfer_out"].includes(item.type)) {
            return sum - Number(item.amount);
          }

          return sum;
        }, 0)
    )
  );

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

  let runningBalance = getBankBalance();
  const balanceAfter = new Map();

  for (const item of history) {
    balanceAfter.set(item.id, runningBalance);

    if (item.type === "deposit" || item.type === "transfer_in") {
      runningBalance -= Number(item.amount) || 0;
    }

    if (item.type === "withdrawal") {
      runningBalance += Number(item.amount) || 0;
    }
  }

  tbody.innerHTML = history.map(item => {
    const positive = ["deposit", "transfer_in"].includes(item.type);

    const credit = positive ? money(item.amount) : "—";
    const debit = !positive ? money(item.amount) : "—";

    return `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td>${escapeHTML(labels[item.type] || item.type)}</td>
        <td>${escapeHTML(item.description || "—")}</td>
        <td class="positive-amount">${credit}</td>
        <td class="negative-amount">${debit}</td>
        <td>${money(balanceAfter.get(item.id) || 0)}</td>
        <td>
          <button
            type="button"
            class="delete-button"
            data-delete-transaction="${escapeHTML(item.id)}"
          >
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-delete-transaction]").forEach(button => {
    button.addEventListener("click", () => {
      deleteAccountTransaction(button.dataset.deleteTransaction);
    });
  });
}

function deleteAccountTransaction(id) {
  const item = accountTransactions.find(entry => entry.id === id);
  if (!item) return;

  if (item.type === "transfer_in" || item.type === "transfer_out") {
    const transferId = item.transferId ||
      id.replace(/-(in|out)$/, "");

    accountTransactions = accountTransactions.filter(entry =>
      entry.transferId !== transferId &&
      entry.id !== `${transferId}-in` &&
      entry.id !== `${transferId}-out`
    );
  } else {
    accountTransactions = accountTransactions.filter(entry =>
      entry.id !== id
    );
  }

  saveData();
  renderAll();
}

/* =========================================================
   CHARTS
========================================================= */

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

function renderCharts() {
  renderDenominationChart();
  renderDailyChart();
  renderAccountChart();
  renderCashAccountChart();
}

function renderDenominationChart() {
  const counts = DENOMS.map(item =>
    notes.filter(note =>
      Number(note.denomination) === item.value
    ).length
  );

  updateChart("denominationChart", {
    type: "doughnut",
    data: {
      labels: DENOMS.map(item => item.label),
      datasets: [{
        data: counts,
        backgroundColor: DENOMS.map(item => item.color),
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: doughnutOptions()
  });

  const legend = getElement("pieLegend");

  if (legend) {
    legend.innerHTML = DENOMS.map((item, index) => `
      <div class="legend-item">
        <span
          class="legend-dot"
          style="background:${item.color}"
        ></span>
        <span>${item.label}</span>
        <strong>${counts[index]}</strong>
      </div>
    `).join("");
  }
}

function getRecentDates() {
  const dates = new Set([
    ...notes.map(note => note.date),
    ...accountTransactions.map(item => item.date)
  ]);

  return [...dates].filter(Boolean).sort().slice(-30);
}

function renderDailyChart() {
  const dates = getRecentDates();

  const datasets = DENOMS.map(item => ({
    label: item.label,
    data: dates.map(date =>
      notes
        .filter(note =>
          note.date === date &&
          Number(note.denomination) === item.value
        )
        .reduce((sum, note) =>
          sum + getNoteAmount(note), 0
        )
    ),
    borderColor: item.color,
    backgroundColor: item.color,
    tension: 0.35,
    fill: false
  }));

  updateChart("dailyChart", {
    type: "line",
    data: {
      labels: dates.map(date => formatDate(date)),
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
      .filter(note => note.date === date)
      .forEach(note => {
        cash += getNoteAmount(note);
      });

    accountTransactions
      .filter(item => item.date === date)
      .forEach(item => {
        const amount = Number(item.amount) || 0;

        if (item.type === "deposit") bank += amount;
        if (item.type === "withdrawal") bank -= amount;
        if (item.type === "transfer_in") bank += amount;
        if (item.type === "transfer_out") cash -= amount;
      });

    return {
      date,
      cash,
      bank: Math.max(0, bank)
    };
  });
}

function renderAccountChart() {
  const balances = calculateDailyBalances();

  updateChart("accountDailyChart", {
    type: "line",
    data: {
      labels: balances.map(item => formatDate(item.date)),
      datasets: [{
        label: "Bank Balance",
        data: balances.map(item => item.bank),
        borderColor: "#a879ff",
        backgroundColor: "rgba(168,121,255,0.12)",
        fill: true,
        tension: 0.35
      }]
    },
    options: lineOptions()
  });
}

function renderCashAccountChart() {
  const balances = calculateDailyBalances();

  updateChart("cashTotalChart", {
    type: "line",
    data: {
      labels: balances.map(item => formatDate(item.date)),
      datasets: [{
        label: "Daily Cash Collection",
        data: balances.map(item => {
          return notes
            .filter(note => note.date === item.date)
            .reduce((sum, note) =>
              sum + getNoteAmount(note), 0
            );
        }),
        borderColor: "#28d7c5",
        backgroundColor: "rgba(40,215,197,0.10)",
        fill: true,
        tension: 0.35
      }]
    },
    options: lineOptions()
  });
}

/* =========================================================
   SERIES REGISTER
========================================================= */

function setupSeriesControls() {
  const search = getElement("seriesSearch");

  search?.addEventListener("input", renderSeries);

  document.querySelectorAll("[data-filter], [data-sort]").forEach(control => {
    control.addEventListener("change", renderSeries);
  });

  getElement("filterOptions")?.addEventListener("change", renderSeries);
  getElement("seriesSort")?.addEventListener("change", renderSeries);
}

function getFilteredNotes() {
  let result = [...notes];

  const search = getElement("seriesSearch")?.value
    .trim()
    .toLowerCase() || "";

  if (search) {
    result = result.filter(note => {
      const fullText = [
        note.prefix,
        note.alphabet,
        note.serial,
        note.denomination,
        note.date
      ].join(" ").toLowerCase();

      return fullText.includes(search);
    });
  }

  const filter = getElement("filterOptions")?.value || "all";

  if (filter !== "all") {
    if (filter === "duplicates") {
      const counts = {};

      notes.forEach(note => {
        const key =
          `${note.prefix}-${note.alphabet}-${note.serial}`;

        counts[key] = (counts[key] || 0) + 1;
      });

      result = result.filter(note =>
        counts[`${note.prefix}-${note.alphabet}-${note.serial}`] > 1
      );
    } else {
      result = result.filter(note =>
        String(note.denomination) === filter
      );
    }
  }

  const sort = getElement("seriesSort")?.value || "newest";

  result.sort((a, b) => {
    if (sort === "oldest") {
      return new Date(a.date) - new Date(b.date);
    }

    if (sort === "amount-high") {
      return getNoteAmount(b) - getNoteAmount(a);
    }

    if (sort === "amount-low") {
      return getNoteAmount(a) - getNoteAmount(b);
    }

    if (sort === "serial") {
      return String(a.serial).localeCompare(String(b.serial));
    }

    return new Date(b.date) - new Date(a.date);
  });

  return result;
}

function getConsecutiveGroups(list) {
  const sorted = [...list].sort((a, b) => {
    const first = `${a.prefix}-${a.alphabet}`;
    const second = `${b.prefix}-${b.alphabet}`;

    return first.localeCompare(second) ||
      Number(a.serial) - Number(b.serial);
  });

  const groups = [];
  let current = [];

  sorted.forEach(note => {
    const previous = current[current.length - 1];

    const sameSeries = previous &&
      previous.prefix === note.prefix &&
      previous.alphabet === note.alphabet;

    const consecutive = sameSeries &&
      Number(note.serial) === Number(previous.serial) + 1;

    if (!current.length || consecutive) {
      current.push(note);
    } else {
      if (current.length > 1) groups.push(current);
      current = [note];
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

  const duplicateKeys = new Set();
  const seen = new Set();

  notes.forEach(note => {
    const key =
      `${note.prefix}-${note.alphabet}-${note.serial}`;

    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
  });

  setText("seriesCount", notes.length);
  setText("prefixCount", new Set(notes.map(note => note.prefix)).size);
  setText("groupCount", groups.length);
  setText("resultCount", filtered.length);
  setText("duplicateCount", duplicateKeys.size);

  setText("seriesTitle", "Currency Series Register");
  setText("seriesSubtitle", `${filtered.length} matching currency notes`);

  const total = filtered.reduce((sum, note) =>
    sum + getNoteAmount(note), 0
  );

  setText("seriesSummary", `Filtered collection value: ${money(total)}`);

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No matching currency notes found.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtered.map((note, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${money(getNoteAmount(note))}</td>
        <td>${escapeHTML(note.prefix)}</td>
        <td>${escapeHTML(note.alphabet)}</td>
        <td>${escapeHTML(note.serial)}</td>
        <td>
          <strong>
            ${escapeHTML(note.prefix)}-${escapeHTML(note.alphabet)}-${escapeHTML(note.serial)}
          </strong>
        </td>
        <td>${formatDate(note.date)}</td>
        <td>
          <button
            type="button"
            class="delete-button"
            data-delete-note="${escapeHTML(note.id)}"
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

  renderSeriesInsights(filtered, groups, duplicateKeys.size);
}

function renderSeriesInsights(filtered, groups, duplicateCount) {
  const insightNotes = getElement("insightNotes");
  const insightDenoms = getElement("insightDenoms");

  if (insightNotes) {
    insightNotes.textContent = `${filtered.length} notes • ${money(
      filtered.reduce((sum, note) =>
        sum + getNoteAmount(note), 0
      )
    )}`;
  }

  if (insightDenoms) {
    insightDenoms.textContent = DENOMS
      .map(item => {
        const count = filtered.filter(note =>
          Number(note.denomination) === item.value
        ).length;

        return `${item.label}: ${count}`;
      })
      .join("  |  ");
  }

  const summary = getElement("seriesSummary");

  if (summary) {
    summary.textContent =
      `${groups.length} consecutive groups found • ${duplicateCount} duplicate serial entries`;
  }
}

/* =========================================================
   DELETE NOTE
========================================================= */

function deleteNote(id) {
  const note = notes.find(item => item.id === id);
  if (!note) return;

  const confirmed = confirm(
    `Delete the ${money(getNoteAmount(note))} note with serial ${note.prefix}-${note.alphabet}-${note.serial}?`
  );

  if (!confirmed) return;

  notes = notes.filter(item => item.id !== id);

  saveData();
  renderAll();
}

/* =========================================================
   STARTUP CHECK
========================================================= */

console.log("CurrencyVault initialized successfully.");
console.log(`Loaded ${notes.length} currency notes.`);