
// ==========================================
// CURRENCY COLLECTION TRACKER
// MAIN JAVASCRIPT
// ==========================================


// 1. DENOMINATION SETTINGS

const DENOMS = [
    { value: 10, color: "#ffca28" },
    { value: 20, color: "#ef4444" },
    { value: 50, color: "#2478f2" },
    { value: 100, color: "#9551e9" },
    { value: 200, color: "#ff8a00" },
    { value: 500, color: "#96999e" }
];


// 2. GLOBAL VARIABLES

const STORAGE_KEY = "currencyCollectionTracker.notes.v1";

let notes = loadNotes();

let selectedDenom = 10;
let selectedFilter = "all";
let sortOrder = "asc";

let pieChart = null;
let dailyChart = null;


// 3. COMMON FUNCTIONS

function money(amount) {
    return "₹" + Number(amount).toLocaleString("en-IN");
}

function todayISO() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getDenomination(value) {
    return DENOMS.find(d => d.value === Number(value));
}

function getFullSeries(note) {
    return `${note.prefix}${note.alphabet} ${note.serial}`;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}


// 4. LOCAL STORAGE

function loadNotes() {

    try {

        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        return Array.isArray(saved) ? saved : [];

    } catch (error) {

        console.error("Unable to load collection:", error);

        return [];

    }

}

function saveNotes() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(notes)
    );

}


// 5. INITIALIZE WEBSITE

function init() {

    document.getElementById("todayLabel").textContent =
        new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

    document.getElementById("collectionDate").value =
        todayISO();

    buildDenominationPicker();

    buildFilterOptions();

    bindEvents();

    renderAll();

}


// 6. DENOMINATION SELECTION

function buildDenominationPicker() {

    const container =
        document.getElementById("denominationPicker");

    container.innerHTML = DENOMS.map(d => `

        <button
            type="button"
            class="denom-choice ${d.value === selectedDenom ? "selected" : ""}"
            style="--tone:${d.color}"
            data-denom="${d.value}">

            ₹${d.value}

        </button>

    `).join("");


    container.querySelectorAll("[data-denom]").forEach(button => {

        button.addEventListener("click", function () {

            selectedDenom = Number(this.dataset.denom);

            document.getElementById("denomination").value =
                selectedDenom;

            buildDenominationPicker();

        });

    });

}


// 7. SERIES FILTER OPTIONS

function buildFilterOptions() {

    const container =
        document.getElementById("filterOptions");

    container.innerHTML = DENOMS.map(d => `

        <button
            class="filter-option"
            data-filter="${d.value}">

            <span
                class="filter-dot"
                style="--tone:${d.color}">
            </span>

            ₹${d.value}

        </button>

    `).join("");

}


// 8. EVENT LISTENERS

function bindEvents() {


    // CASH AND SERIES NAVIGATION

    document.querySelectorAll(".tab").forEach(button => {

        button.addEventListener("click", function () {

            showPage(this.dataset.page);

        });

    });


    // ADD NOTE FORM

    document.getElementById("noteForm")
        .addEventListener("submit", addNote);


    // VIEW SERIES BUTTON

    document.getElementById("goSeries")
        .addEventListener("click", function () {

            showPage("seriesPage");

        });


    // ASCENDING / DESCENDING

    document.querySelectorAll("[data-sort]")
        .forEach(button => {

            button.addEventListener("click", function () {

                sortOrder = this.dataset.sort;

                document.querySelectorAll("[data-sort]")
                    .forEach(btn => {

                        btn.classList.toggle(
                            "active",
                            btn === this
                        );

                    });

                renderSeries();

            });

        });


    // DENOMINATION FILTER

    document.getElementById("filterOptions")
        .addEventListener("click", function (event) {

            const button =
                event.target.closest("[data-filter]");

            if (button) {

                setFilter(button.dataset.filter);

            }

        });


    document.querySelector('[data-filter="all"]')
        .addEventListener("click", function () {

            setFilter("all");

        });


    // SERIES SEARCH

    document.getElementById("seriesSearch")
        .addEventListener("input", renderSeries);

}


// 9. NAVIGATION FUNCTION

function showPage(pageID) {

    document.querySelectorAll(".page")
        .forEach(page => {

            page.classList.toggle(
                "active-page",
                page.id === pageID
            );

        });


    document.querySelectorAll(".tab")
        .forEach(tab => {

            tab.classList.toggle(
                "active",
                tab.dataset.page === pageID
            );

        });


    if (pageID === "seriesPage") {

        renderSeries();

    }

}


// 10. ADD NEW CURRENCY NOTE

function addNote(event) {

    event.preventDefault();


    const prefix =
        document.getElementById("prefix").value.trim();

    const alphabet =
        document.getElementById("alphabet").value
            .trim().toUpperCase();

    const serial =
        document.getElementById("serial").value.trim();

    const date =
        document.getElementById("collectionDate").value;

    const message =
        document.getElementById("formMessage");


    // VALIDATION

    if (
        !/^\d+$/.test(prefix) ||
        !/^[A-Z]{1,3}$/.test(alphabet) ||
        !/^\d+$/.test(serial) ||
        !date
    ) {

        message.textContent =
            "Please enter valid prefix, alphabet, serial number and date.";

        message.className = "form-message error";

        return;

    }


    // DUPLICATE CHECK

    const duplicate = notes.some(note =>

        note.denomination === selectedDenom &&
        note.prefix === prefix &&
        note.alphabet === alphabet &&
        note.serial === serial

    );


    if (duplicate) {

        message.textContent =
            "This serial number is already registered.";

        message.className = "form-message error";

        return;

    }


    // CREATE NOTE OBJECT

    const newNote = {

        id: (
            crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now() + Math.random())
        ),

        denomination: selectedDenom,

        prefix: prefix,

        alphabet: alphabet,

        serial: serial,

        date: date,

        createdAt: Date.now()

    };


    // SAVE NOTE

    notes.push(newNote);

    saveNotes();


    // RESET FORM

    document.getElementById("noteForm").reset();

    document.getElementById("collectionDate").value =
        todayISO();


    message.textContent =
        `Successfully saved ₹${selectedDenom} note: ${getFullSeries(newNote)}`;

    message.className = "form-message";


    // REFRESH DASHBOARD

    renderAll();

}


// 11. FILTER SERIES

function setFilter(value) {

    selectedFilter = value;

    document.querySelectorAll("[data-filter]")
        .forEach(button => {

            button.classList.toggle(
                "selected",
                button.dataset.filter === value
            );

        });

    renderSeries();

}


// 12. RENDER EVERYTHING

function renderAll() {

    renderCash();

    renderSeries();

}


// 13. CASH DASHBOARD

function renderCash() {

    const totalAmount = notes.reduce(
        (sum, note) => sum + note.denomination,
        0
    );


    const todayAmount = notes
        .filter(note => note.date === todayISO())
        .reduce(
            (sum, note) => sum + note.denomination,
            0
        );


    const totalDays = new Set(
        notes.map(note => note.date)
    ).size;


    document.getElementById("totalNotes").textContent =
        notes.length;


    document.getElementById("totalAmount").textContent =
        money(totalAmount);


    document.getElementById("todayAmount").textContent =
        money(todayAmount);


    document.getElementById("totalDays").textContent =
        totalDays;


    renderDenominationSummary();

    renderRecentNotes();

    renderCharts();

}


// 14. DENOMINATION SUMMARY

function renderDenominationSummary() {

    const container =
        document.getElementById("denominationSummary");


    container.innerHTML = DENOMS.map(d => {

        const group = notes.filter(
            note => note.denomination === d.value
        );

        const amount = group.length * d.value;


        return `

            <article
                class="denom-card"
                style="--tone:${d.color}">

                <div class="denom-card-head">

                    ₹${d.value}

                </div>

                <div class="denom-card-body">

                    <span>${group.length} Notes</span>

                    <strong>${money(amount)}</strong>

                </div>

            </article>

        `;

    }).join("");

}


// 15. RECENTLY ADDED NOTES

function renderRecentNotes() {

    const container =
        document.getElementById("recentRows");


    const recent = [...notes]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6);


    if (recent.length === 0) {

        container.innerHTML = `

            <tr>
                <td colspan="4" class="empty-state">
                    No notes added yet.
                </td>
            </tr>

        `;

        return;

    }


    container.innerHTML = recent.map(note => {

        const color = getDenomination(
            note.denomination
        ).color;


        return `

            <tr>

                <td>

                    <span
                        class="denom-pill"
                        style="--tone:${color}">

                        ₹${note.denomination}

                    </span>

                </td>

                <td>
                    <strong>${escapeHTML(getFullSeries(note))}</strong>
                </td>

                <td>${formatDate(note.date)}</td>

                <td>${money(note.denomination)}</td>

            </tr>

        `;

    }).join("");

}


// 16. CHARTS

function renderCharts() {

    if (typeof Chart === "undefined") {

        console.error("Chart.js is not loaded.");

        return;

    }


    renderPieChart();

    renderDailyChart();

}


// 17. PIE CHART

function renderPieChart() {

    const totals = DENOMS.map(d =>

        notes
            .filter(note => note.denomination === d.value)
            .reduce((sum, note) => sum + note.denomination, 0)

    );


    const context =
        document.getElementById("denominationChart");


    if (pieChart) {

        pieChart.destroy();

    }


    pieChart = new Chart(context, {

        type: "doughnut",

        data: {

            labels: DENOMS.map(d => `₹${d.value}`),

            datasets: [{

                data: totals,

                backgroundColor: DENOMS.map(d => d.color),

                borderColor: "#ffffff",

                borderWidth: 3,

                hoverOffset: 5

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            cutout: "63%",

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    callbacks: {

                        label: function (context) {

                            return (
                                context.label +
                                ": " +
                                money(context.raw)
                            );

                        }

                    }

                }

            }

        }

    });


    // PIE CHART LEGEND

    document.getElementById("pieLegend").innerHTML =

        DENOMS.map((d, index) => `

            <span class="legend-item">

                <i
                    class="legend-dot"
                    style="background:${d.color}">
                </i>

                ₹${d.value}: ${money(totals[index])}

            </span>

        `).join("");

}


// 18. DAILY SAVINGS LINE CHART

function renderDailyChart() {

    const allDates = [...new Set(
        notes.map(note => note.date)
    )].sort();


    // SHOW TODAY EVEN WHEN COLLECTION IS EMPTY

    const labels = allDates.length
        ? allDates
        : [todayISO()];


    if (dailyChart) {

        dailyChart.destroy();

    }


    const datasets = DENOMS.map(d => {

        return {

            label: `₹${d.value}`,

            data: labels.map(date => {

                return notes
                    .filter(note =>
                        note.date === date &&
                        note.denomination === d.value
                    )
                    .reduce(
                        (sum, note) => sum + note.denomination,
                        0
                    );

            }),

            borderColor: d.color,

            backgroundColor: d.color,

            borderWidth: 2.5,

            pointRadius: 4,

            pointHoverRadius: 6,

            tension: 0.32,

            fill: false

        };

    });


    dailyChart = new Chart(

        document.getElementById("dailyChart"),

        {

            type: "line",

            data: {

                labels: labels.map(formatShortDate),

                datasets: datasets

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                interaction: {

                    mode: "index",

                    intersect: false

                },

                plugins: {

                    legend: {

                        position: "bottom",

                        labels: {

                            usePointStyle: true,

                            boxWidth: 8,

                            font: {
                                size: 10
                            }

                        }

                    },

                    tooltip: {

                        callbacks: {

                            label: function (context) {

                                return (
                                    context.dataset.label +
                                    ": " +
                                    money(context.raw)
                                );

                            }

                        }

                    }

                },

                scales: {

                    y: {

                        beginAtZero: true,

                        ticks: {

                            callback: function (value) {

                                return value >= 1000
                                    ? (value / 1000) + "k"
                                    : value;

                            }

                        },

                        grid: {
                            color: "#edf0f5"
                        }

                    },

                    x: {

                        grid: {
                            display: false
                        },

                        ticks: {
                            maxTicksLimit: 7
                        }

                    }

                }

            }

        }

    );

}


// 19. SERIES PAGE

function renderSeries() {

    const search =
        document.getElementById("seriesSearch")
            .value.trim().toLowerCase();


    // DENOMINATION FILTER

    let filtered = notes.filter(note => {

        return selectedFilter === "all" ||
            note.denomination === Number(selectedFilter);

    });


    // SEARCH FILTER

    let rows = filtered.filter(note => {

        const searchText = [

            note.prefix,
            note.alphabet,
            note.serial,
            getFullSeries(note),
            note.denomination

        ].join(" ").toLowerCase();


        return searchText.includes(search);

    });


    // AUTOMATIC SORTING

    rows.sort((a, b) => {

        // DENOMINATION ORDER

        const denominationSort =
            a.denomination - b.denomination;

        if (denominationSort !== 0) {

            return denominationSort;

        }


        // PREFIX ORDER

        const prefixSort =
            a.prefix.localeCompare(
                b.prefix,
                undefined,
                { numeric: true }
            );

        if (prefixSort !== 0) {

            return prefixSort;

        }


        // ALPHABET ORDER

        const alphabetSort =
            a.alphabet.localeCompare(b.alphabet);

        if (alphabetSort !== 0) {

            return alphabetSort;

        }


        // SERIAL NUMBER ORDER

        const serialSort =
            a.serial.localeCompare(
                b.serial,
                undefined,
                { numeric: true }
            );


        return sortOrder === "asc"
            ? serialSort
            : -serialSort;

    });


    // SERIES TITLE

    const title = selectedFilter === "all"
        ? "All Series"
        : `₹${selectedFilter} Series`;


    document.getElementById("seriesTitle").textContent =
        title;


    document.getElementById("seriesSubtitle").textContent =

        `${rows.length} saved notes · ${
            sortOrder === "asc"
                ? "Ascending"
                : "Descending"
        } serial order`;


    // SERIES TABLE

    const container =
        document.getElementById("seriesRows");


    if (rows.length === 0) {

        container.innerHTML = `

            <tr>

                <td colspan="8" class="empty-state">

                    No matching serial numbers found.

                </td>

            </tr>

        `;

    } else {

        container.innerHTML = rows.map((note, index) => {

            const color = getDenomination(
                note.denomination
            ).color;


            return `

                <tr>

                    <td>${index + 1}</td>

                    <td>

                        <span
                            class="denom-pill"
                            style="--tone:${color}">

                            ₹${note.denomination}

                        </span>

                    </td>

                    <td>${escapeHTML(note.prefix)}</td>

                    <td>${escapeHTML(note.alphabet)}</td>

                    <td>${escapeHTML(note.serial)}</td>

                    <td class="full-series">

                        ${escapeHTML(getFullSeries(note))}

                    </td>

                    <td>${formatDate(note.date)}</td>

                    <td>

                        <button
                            class="delete-button"
                            data-delete="${escapeHTML(note.id)}"
                            title="Delete note">

                            ×

                        </button>

                    </td>

                </tr>

            `;

        }).join("");

    }


    // DELETE BUTTONS

    container.querySelectorAll("[data-delete]")
        .forEach(button => {

            button.addEventListener("click", function () {

                deleteNote(this.dataset.delete);

            });

        });


    // SERIES STATISTICS

    document.getElementById("seriesCount").textContent =
        notes.length;


    document.getElementById("prefixCount").textContent =

        new Set(

            notes.map(note =>

                `${note.denomination}-${note.prefix}-${note.alphabet}`

            )

        ).size;


    document.getElementById("groupCount").textContent =
        countConsecutiveGroups(notes);


    document.getElementById("resultCount").textContent =
        rows.length;


    // INSIGHTS

    document.getElementById("insightNotes").textContent =
        notes.length;


    document.getElementById("insightDenoms").textContent =

        new Set(
            notes.map(note => note.denomination)
        ).size;


    // DUPLICATE COUNT

    const counts = new Map();

    notes.forEach(note => {

        const key =
            `${note.denomination}-${getFullSeries(note)}`;

        counts.set(key, (counts.get(key) || 0) + 1);

    });


    const duplicates = [...counts.values()]
        .filter(count => count > 1)
        .reduce((sum, count) => sum + count - 1, 0);


    document.getElementById("duplicateCount").textContent =
        duplicates;


    renderSeriesSummary();

}


// 20. CONSECUTIVE SERIES DETECTION

function countConsecutiveGroups(list) {

    const groups = new Map();


    list.forEach(note => {

        const key =
            `${note.denomination}-${note.prefix}-${note.alphabet}`;

        if (!groups.has(key)) {

            groups.set(key, []);

        }

        groups.get(key).push(Number(note.serial));

    });


    let total = 0;


    groups.forEach(numbers => {

        const unique = [...new Set(numbers)]
            .sort((a, b) => a - b);


        let run = 1;


        for (let i = 1; i < unique.length; i++) {

            if (unique[i] === unique[i - 1] + 1) {

                run++;

            } else {

                if (run > 1) {

                    total++;

                }

                run = 1;

            }

        }


        if (run > 1) {

            total++;

        }

    });


    return total;

}


// 21. SERIES SUMMARY

function renderSeriesSummary() {

    const container =
        document.getElementById("seriesSummary");


    container.innerHTML = DENOMS.map(d => {

        const count = notes.filter(

            note => note.denomination === d.value

        ).length;


        return `

            <div class="summary-row">

                <span class="summary-left">

                    <i
                        class="filter-dot"
                        style="--tone:${d.color}">
                    </i>

                    ₹${d.value}

                </span>

                <strong>${count} Notes</strong>

            </div>

        `;

    }).join("");

}


// 22. DELETE NOTE

function deleteNote(id) {

    const confirmed = confirm(
        "Are you sure you want to delete this currency note?"
    );


    if (!confirmed) {

        return;

    }


    notes = notes.filter(note => note.id !== id);

    saveNotes();

    renderAll();

}


// 23. DATE FORMATTING

function formatDate(date) {

    if (!date) {

        return "—";

    }


    const [year, month, day] = date.split("-");

    const monthName = new Date(
        Number(year),
        Number(month) - 1,
        1
    ).toLocaleString("en-IN", {
        month: "short"
    });


    return `${day} ${monthName} ${year}`;

}


function formatShortDate(date) {

    const [year, month, day] = date.split("-");

    return `${day}/${month}`;

}


// 24. START WEBSITE

init();
