/**
 * AWS AI Weather Anomaly Detection - Frontend Engine
 * Enhanced UI/UX, Local Persistence, Multi-View Charts, and AI Insights
 */

let anomalyChart = null;
let currentAnalysisData = null;
let currentFilter = "all";
let currentChartView = "anomaly";

const STORAGE_KEY_LAST = "aws_anomaly_last_result";
const STORAGE_KEY_RECENTS = "aws_anomaly_recent_cities";
const STORAGE_KEY_PREFIX = "aws_anomaly_city_";
const STORAGE_KEY_THEME = "aws_anomaly_theme";

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    checkApiHealth();
    initRecentCities();
    initSearchInput();
    restoreLastAnalysis();
});

/* ==========================================================================
   THEME MANAGEMENT (LIGHT & DARK MODE)
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY_THEME, next);
    updateThemeIcon(next);

    // Re-render chart if active so its axes colors adapt to theme
    if (currentAnalysisData) {
        renderChart();
    }
}

function updateThemeIcon(theme) {
    const icon = document.getElementById("themeIcon");
    if (icon) {
        icon.textContent = theme === "dark" ? "☀️" : "🌙";
    }
}

/* ==========================================================================
   BACKEND API HEALTH CHECK
   ========================================================================== */
async function checkApiHealth() {
    const badge = document.getElementById("apiStatusBadge");
    const text = document.getElementById("apiStatusText");
    if (!badge || !text) return;

    try {
        const resp = await fetch("http://127.0.0.1:8000/health", { cache: "no-store" });
        if (resp.ok) {
            badge.className = "status-indicator online";
            text.textContent = "API Connected";
            badge.title = "FastAPI Backend is running";
        } else {
            throw new Error("Degraded");
        }
    } catch (_) {
        badge.className = "status-indicator offline";
        text.textContent = "API Offline";
        badge.title = "Could not reach backend on http://127.0.0.1:8000";
    }
}

/* ==========================================================================
   SEARCH & INPUT MANAGEMENT
   ========================================================================== */
function initSearchInput() {
    const input = document.getElementById("cityInput");
    const clearBtn = document.getElementById("clearInputBtn");
    if (!input || !clearBtn) return;

    input.addEventListener("input", () => {
        if (input.value.trim().length > 0) {
            clearBtn.classList.remove("hidden");
        } else {
            clearBtn.classList.add("hidden");
        }
    });
}

function handleSearchKey(event) {
    if (event.key === "Enter") {
        analyzeCity();
    } else if (event.key === "Escape") {
        clearInput();
    }
}

function clearInput() {
    const input = document.getElementById("cityInput");
    const clearBtn = document.getElementById("clearInputBtn");
    if (input) input.value = "";
    if (clearBtn) clearBtn.classList.add("hidden");
    if (input) input.focus();
}

function quickSelectCity(cityName) {
    const input = document.getElementById("cityInput");
    if (input) input.value = cityName;
    const clearBtn = document.getElementById("clearInputBtn");
    if (clearBtn) clearBtn.classList.remove("hidden");

    // If cached, display immediately; otherwise fetch live
    const cached = getCachedCity(cityName);
    if (cached) {
        renderAnalysis(cached.data, cached.savedAt, true);
        showToast(`Loaded saved analysis for ${cityName}`, "info");
    } else {
        analyzeCity(cityName);
    }
}

/* ==========================================================================
   MAIN ANALYSIS WORKFLOW
   ========================================================================== */
async function analyzeCity(cityToAnalyze = null) {
    const input = document.getElementById("cityInput");
    const city = (cityToAnalyze || (input ? input.value : "")).trim();

    if (!city) {
        showToast("Please enter a city name to analyze.", "warning");
        if (input) input.focus();
        return;
    }

    if (input) input.value = city;
    const clearBtn = document.getElementById("clearInputBtn");
    if (clearBtn) clearBtn.classList.remove("hidden");

    setLoading(true);

    try {
        const response = await fetch(
            `http://127.0.0.1:8000/analyze/${encodeURIComponent(city)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to retrieve weather analysis.");
        }

        const now = new Date().toISOString();

        // Save into localStorage
        const cachePayload = { data, savedAt: now };
        try {
            localStorage.setItem(STORAGE_KEY_LAST, JSON.stringify(cachePayload));
            localStorage.setItem(STORAGE_KEY_PREFIX + city.toLowerCase(), JSON.stringify(cachePayload));
            addRecentCity(city);
        } catch (storageError) {
            console.warn("localStorage quota or error:", storageError);
        }

        renderAnalysis(data, now, false);
        showToast(`Successfully analyzed weather data for ${city}!`, "success");

    } catch (error) {
        console.error("Analysis error:", error);

        // Fallback: Check local cache first
        const cached = getCachedCity(city);
        if (cached) {
            renderAnalysis(cached.data, cached.savedAt, true);
            showToast(`API call failed. Showing saved analysis for ${city}.`, "warning");
            return;
        }

        // Fallback: Check backend SQLite history
        try {
            const historyResp = await fetch(`http://127.0.0.1:8000/history/${encodeURIComponent(city)}`);
            if (historyResp.ok) {
                const historyData = await historyResp.json();
                renderAnalysis(historyData, new Date().toISOString(), true);
                showToast(`Retrieved historical analysis from database for ${city}.`, "info");
                return;
            }
        } catch (_) {}

        showToast(error.message || "Failed to analyze weather. Ensure backend is running.", "error");

    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    const loadingCard = document.getElementById("loading");
    const btn = document.getElementById("analyzeBtn");
    const btnText = document.getElementById("btnText");
    const btnSpinner = document.getElementById("btnSpinner");

    if (isLoading) {
        if (loadingCard) loadingCard.classList.remove("hidden");
        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = "Analyzing...";
        if (btnSpinner) btnSpinner.classList.remove("hidden");
    } else {
        if (loadingCard) loadingCard.classList.add("hidden");
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = "Analyze Weather";
        if (btnSpinner) btnSpinner.classList.add("hidden");
    }
}

/* ==========================================================================
   RENDER ANALYSIS DASHBOARD
   ========================================================================== */
function renderAnalysis(data, timestamp, isSaved = false) {
    currentAnalysisData = data;

    // Toggle welcome vs results
    const welcome = document.getElementById("welcomeState");
    const results = document.getElementById("resultsContainer");
    if (welcome) welcome.classList.add("hidden");
    if (results) results.classList.remove("hidden");

    // Update Status Banner
    const indicator = document.getElementById("saveStatusIndicator");
    const timeElem = document.getElementById("lastUpdatedTime");
    if (indicator && timeElem) {
        indicator.textContent = isSaved ? "● Saved in Browser (Permanent)" : "● Live Data Active";
        indicator.style.color = isSaved ? "var(--success)" : "var(--primary)";
        indicator.style.background = isSaved ? "var(--success-light)" : "var(--primary-light)";
        indicator.style.borderColor = isSaved ? "var(--success-border)" : "var(--primary-border)";

        const timeStr = timestamp
            ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : "Just now";
        timeElem.textContent = `Analysis: ${data.city} (at ${timeStr})`;
    }

    // Render Components
    renderLocation(data);
    renderAiInsights(data);
    renderDashboardMetrics(data);
    renderTable(data);
    renderChart();
    highlightActiveRecentTag(data.city);
}

// Location header
function renderLocation(data) {
    const cityElem = document.getElementById("locationCityName");
    const countryElem = document.getElementById("locationCountryBadge");
    const coordsElem = document.getElementById("locationCoords");

    if (cityElem) cityElem.textContent = data.city || "--";
    if (countryElem) countryElem.textContent = data.country || "Global Observation";

    const lat = typeof data.latitude === "number" ? data.latitude.toFixed(4) : data.latitude;
    const lon = typeof data.longitude === "number" ? data.longitude.toFixed(4) : data.longitude;
    if (coordsElem) {
        coordsElem.textContent = (lat && lon && lat !== 0) ? `Latitude: ${lat} | Longitude: ${lon}` : "Geospatial coordinate mapping confirmed";
    }
}

// Executive AI Insights Card
function renderAiInsights(data) {
    const card = document.getElementById("aiInsightCard");
    const icon = document.getElementById("insightIcon");
    const title = document.getElementById("insightTitle");
    const message = document.getElementById("insightMessage");
    if (!card || !title || !message) return;

    const summaries = data.station_summary || [];
    const stations = data.stations || [];

    const anomalousStations = summaries.filter(s => s.average_anomaly_score >= 70);
    const suspiciousStations = summaries.filter(s => s.average_anomaly_score >= 45 && s.average_anomaly_score < 70);

    if (anomalousStations.length > 0) {
        card.className = "ai-insight-card insight-critical";
        icon.textContent = "🔴";
        title.textContent = `Critical Discrepancy Detected (${anomalousStations.length} Source${anomalousStations.length > 1 ? 's' : ''})`;

        const names = anomalousStations.map(s => `"${s.station}" (Score: ${s.average_anomaly_score})`).join(", ");
        message.textContent = `High statistical divergence detected in ${names}. Observations deviate significantly from consensus peer models. Check for sensor calibration error or extreme localized microclimate conditions.`;

    } else if (suspiciousStations.length > 0) {
        card.className = "ai-insight-card insight-warning";
        icon.textContent = "🟠";
        title.textContent = `Moderate Sensor Drift / Variance (${suspiciousStations.length} Source${suspiciousStations.length > 1 ? 's' : ''})`;

        const names = suspiciousStations.map(s => `"${s.station}" (Score: ${s.average_anomaly_score})`).join(", ");
        message.textContent = `Station ${names} displays moderate variance from peer averages. Data should be monitored for potential drift.`;

    } else {
        card.className = "ai-insight-card insight-normal";
        icon.textContent = "🟢";
        title.textContent = "Consensus Verified: All Stations Agree";
        message.textContent = `All ${summaries.length || stations.length} meteorological models show robust alignment with normal peer variations. No significant anomalies or erroneous readings detected.`;
    }
}

// Dashboard metrics cards
function renderDashboardMetrics(data) {
    const summaries = data.station_summary || [];
    const total = summaries.length;

    let normal = 0;
    let suspicious = 0;
    let anomalous = 0;

    summaries.forEach(item => {
        if (item.average_anomaly_score >= 70) {
            anomalous++;
        } else if (item.average_anomaly_score >= 45) {
            suspicious++;
        } else {
            normal++;
        }
    });

    document.getElementById("totalStations").textContent = total;
    document.getElementById("normalStations").textContent = normal;
    document.getElementById("suspiciousStations").textContent = suspicious;
    document.getElementById("anomalousStations").textContent = anomalous;

    // Percentages and progress bars
    const normalPct = total > 0 ? Math.round((normal / total) * 100) : 0;
    const suspiciousPct = total > 0 ? Math.round((suspicious / total) * 100) : 0;
    const anomalousPct = total > 0 ? Math.round((anomalous / total) * 100) : 0;

    document.getElementById("normalPercent").textContent = `${normalPct}%`;
    document.getElementById("suspiciousPercent").textContent = `${suspiciousPct}%`;
    document.getElementById("anomalousPercent").textContent = `${anomalousPct}%`;

    document.getElementById("normalBar").style.width = `${normalPct}%`;
    document.getElementById("suspiciousBar").style.width = `${suspiciousPct}%`;
    document.getElementById("anomalousBar").style.width = `${anomalousPct}%`;

    // Update filter tab counts
    document.getElementById("filterCountAll").textContent = total;
    document.getElementById("filterCountNormal").textContent = normal;
    document.getElementById("filterCountSuspicious").textContent = suspicious;
    document.getElementById("filterCountAnomalous").textContent = anomalous;
}

// Table Filter
function setTableFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.remove("active"));

    if (filter === "all") document.querySelector(".filter-tab:nth-child(1)").classList.add("active");
    else if (filter === "normal") document.querySelector(".tab-normal").classList.add("active");
    else if (filter === "suspicious") document.querySelector(".tab-suspicious").classList.add("active");
    else if (filter === "anomalous") document.querySelector(".tab-anomalous").classList.add("active");

    if (currentAnalysisData) {
        renderTable(currentAnalysisData);
    }
}

// Render detailed table
function renderTable(data) {
    const tbody = document.getElementById("weatherTable");
    if (!tbody) return;
    tbody.innerHTML = "";

    const stations = data.stations || [];
    if (stations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">No station records available.</td></tr>`;
        return;
    }

    const filtered = stations.filter(station => {
        const status = (station.status || "normal").toLowerCase();
        if (currentFilter === "all") return true;
        return status === currentFilter;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">No records match the "${currentFilter}" filter.</td></tr>`;
        return;
    }

    filtered.forEach(s => {
        const row = document.createElement("tr");
        const statusClass = (s.status || "normal").toLowerCase();
        const score = parseFloat(s.anomaly_score) || 0;

        let meterColor = "var(--success)";
        if (score >= 70) meterColor = "var(--danger)";
        else if (score >= 45) meterColor = "var(--warning)";

        row.innerHTML = `
            <td><strong>${s.station}</strong></td>
            <td>${s.temperature !== undefined ? s.temperature + ' °C' : '--'}</td>
            <td>${s.humidity !== undefined ? s.humidity + ' %' : '--'}</td>
            <td>${s.wind_speed !== undefined ? s.wind_speed + ' km/h' : '--'}</td>
            <td>${s.pressure !== undefined ? s.pressure + ' hPa' : '--'}</td>
            <td>${s.rainfall !== undefined ? s.rainfall + ' mm' : '--'}</td>
            <td>
                <div class="anomaly-meter-cell">
                    <div class="meter-track">
                        <div class="meter-bar" style="width: ${Math.min(score, 100)}%; background-color: ${meterColor};"></div>
                    </div>
                    <span class="meter-value" style="color: ${meterColor};">${score.toFixed(1)}</span>
                </div>
            </td>
            <td>
                <span class="status-pill ${statusClass}">${s.status || 'Normal'}</span>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Chart view tab switcher
function switchChartView(view) {
    currentChartView = view;

    document.querySelectorAll(".chart-tab").forEach(tab => tab.classList.remove("active"));
    if (view === "anomaly") document.getElementById("chartTabAnomaly").classList.add("active");
    else if (view === "temperature") document.getElementById("chartTabTemp").classList.add("active");
    else if (view === "pressure") document.getElementById("chartTabPressure").classList.add("active");

    renderChart();
}

// Chart renderer
function renderChart() {
    if (!currentAnalysisData) return;

    const ctx = document.getElementById("anomalyChart");
    if (!ctx) return;

    if (anomalyChart) {
        anomalyChart.destroy();
    }

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

    if (currentChartView === "anomaly") {
        const summaries = currentAnalysisData.station_summary || [];
        const labels = summaries.map(item => item.station);
        const scores = summaries.map(item => item.average_anomaly_score);

        const bgColors = scores.map(score => {
            if (score >= 70) return "rgba(239, 68, 68, 0.8)";
            if (score >= 45) return "rgba(245, 158, 11, 0.8)";
            return "rgba(16, 185, 129, 0.8)";
        });

        const borderColors = scores.map(score => {
            if (score >= 70) return "#ef4444";
            if (score >= 45) return "#f59e0b";
            return "#10b981";
        });

        anomalyChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Average Anomaly Score",
                    data: scores,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                let classification = "Normal";
                                if (val >= 70) classification = "Critical Anomaly";
                                else if (val >= 45) classification = "Suspicious Drift";
                                return `Score: ${val} (${classification})`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: textColor },
                        grid: { color: gridColor },
                        title: {
                            display: true,
                            text: "Anomaly Score (0 = Consensus Normal, 100 = Outlier)",
                            color: textColor
                        }
                    }
                }
            }
        });

    } else if (currentChartView === "temperature") {
        const stations = currentAnalysisData.stations || [];
        const labels = stations.map(s => s.station);
        const temps = stations.map(s => s.temperature);

        anomalyChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Observed Temperature (°C)",
                    data: temps,
                    backgroundColor: "rgba(59, 130, 246, 0.75)",
                    borderColor: "#3b82f6",
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor } }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { display: false } },
                    y: {
                        ticks: { color: textColor },
                        grid: { color: gridColor },
                        title: { display: true, text: "Temperature (°C)", color: textColor }
                    }
                }
            }
        });

    } else if (currentChartView === "pressure") {
        const stations = currentAnalysisData.stations || [];
        const labels = stations.map(s => s.station);
        const pressures = stations.map(s => s.pressure);
        const winds = stations.map(s => s.wind_speed);

        anomalyChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Surface Pressure (hPa)",
                        data: pressures,
                        backgroundColor: "rgba(168, 85, 247, 0.7)",
                        borderColor: "#a855f7",
                        borderWidth: 1.5,
                        borderRadius: 6,
                        yAxisID: "y"
                    },
                    {
                        label: "Wind Speed (km/h)",
                        data: winds,
                        backgroundColor: "rgba(14, 165, 233, 0.7)",
                        borderColor: "#0ea5e9",
                        borderWidth: 1.5,
                        borderRadius: 6,
                        yAxisID: "y1"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor } }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { display: false } },
                    y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        ticks: { color: textColor },
                        grid: { color: gridColor },
                        title: { display: true, text: "Pressure (hPa)", color: textColor }
                    },
                    y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        ticks: { color: textColor },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: "Wind Speed (km/h)", color: textColor }
                    }
                }
            }
        });
    }
}

/* ==========================================================================
   RESTORE & ACTIONS (REFRESH, CLEAR, EXPORT)
   ========================================================================== */
function restoreLastAnalysis() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_LAST);
        if (!saved) return;

        const parsed = JSON.parse(saved);
        if (!parsed || !parsed.data) return;

        const { data, savedAt } = parsed;
        const input = document.getElementById("cityInput");
        if (input && data.city) {
            input.value = data.city;
            const clearBtn = document.getElementById("clearInputBtn");
            if (clearBtn) clearBtn.classList.remove("hidden");
        }

        renderAnalysis(data, savedAt, true);
    } catch (e) {
        console.warn("Could not restore saved analysis:", e);
    }
}

function refreshCurrentCity() {
    if (currentAnalysisData && currentAnalysisData.city) {
        analyzeCity(currentAnalysisData.city);
    } else {
        analyzeCity();
    }
}

function clearCurrentResults() {
    if (!confirm("Are you sure you want to clear current results from view?")) {
        return;
    }

    currentAnalysisData = null;
    localStorage.removeItem(STORAGE_KEY_LAST);

    const welcome = document.getElementById("welcomeState");
    const results = document.getElementById("resultsContainer");
    if (welcome) welcome.classList.remove("hidden");
    if (results) results.classList.add("hidden");

    if (anomalyChart) {
        anomalyChart.destroy();
        anomalyChart = null;
    }

    document.querySelectorAll(".recent-tag").forEach(el => el.classList.remove("active"));
    showToast("Results cleared from view.", "info");
}

function exportData(format) {
    if (!currentAnalysisData) {
        showToast("No analysis available to export.", "warning");
        return;
    }

    const city = currentAnalysisData.city || "weather_anomaly";
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "json") {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAnalysisData, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${city}_anomaly_report_${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast(`JSON report downloaded for ${city}`, "success");

    } else if (format === "csv") {
        const stations = currentAnalysisData.stations || [];
        if (stations.length === 0) {
            showToast("No station data to export.", "warning");
            return;
        }

        const headers = ["Station", "Temperature (°C)", "Humidity (%)", "Wind Speed (km/h)", "Pressure (hPa)", "Rainfall (mm)", "Anomaly Score", "Status"];
        const rows = stations.map(s => [
            `"${s.station}"`,
            s.temperature !== undefined ? s.temperature : "",
            s.humidity !== undefined ? s.humidity : "",
            s.wind_speed !== undefined ? s.wind_speed : "",
            s.pressure !== undefined ? s.pressure : "",
            s.rainfall !== undefined ? s.rainfall : "",
            s.anomaly_score !== undefined ? s.anomaly_score : "",
            `"${s.status}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", encodedUri);
        downloadAnchor.setAttribute("download", `${city}_anomaly_data_${dateStr}.csv`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast(`CSV data downloaded for ${city}`, "success");
    }
}

/* ==========================================================================
   RECENT SEARCHES & CACHE HELPERS
   ========================================================================== */
function getCachedCity(city) {
    try {
        const cached = localStorage.getItem(STORAGE_KEY_PREFIX + city.toLowerCase());
        if (cached) return JSON.parse(cached);
    } catch (_) {}
    return null;
}

function getRecentCitiesList() {
    try {
        const list = localStorage.getItem(STORAGE_KEY_RECENTS);
        return list ? JSON.parse(list) : [];
    } catch (_) {
        return [];
    }
}

function addRecentCity(city) {
    if (!city) return;
    try {
        let list = getRecentCitiesList();
        list = list.filter(c => c.toLowerCase() !== city.toLowerCase());
        list.unshift(city);
        if (list.length > 8) list = list.slice(0, 8);
        localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(list));
        renderRecentCities(list);
    } catch (_) {}
}

async function initRecentCities() {
    let list = getRecentCitiesList();

    try {
        const res = await fetch("http://127.0.0.1:8000/recent-cities");
        if (res.ok) {
            const data = await res.json();
            if (data.cities && Array.isArray(data.cities)) {
                const merged = [...list];
                data.cities.forEach(c => {
                    if (!merged.some(m => m.toLowerCase() === c.toLowerCase())) {
                        merged.push(c);
                    }
                });
                list = merged.slice(0, 8);
                localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(list));
            }
        }
    } catch (_) {}

    renderRecentCities(list);
}

function renderRecentCities(cities) {
    const container = document.getElementById("recentSearchesContainer");
    const listElem = document.getElementById("recentSearchesList");
    if (!container || !listElem) return;

    if (!cities || cities.length === 0) {
        container.classList.add("hidden");
        return;
    }

    container.classList.remove("hidden");
    listElem.innerHTML = "";

    cities.forEach(city => {
        const tag = document.createElement("span");
        tag.className = "recent-tag";
        tag.textContent = city;
        tag.onclick = () => selectRecentCity(city);
        listElem.appendChild(tag);
    });

    if (currentAnalysisData && currentAnalysisData.city) {
        highlightActiveRecentTag(currentAnalysisData.city);
    }
}

function highlightActiveRecentTag(cityName) {
    if (!cityName) return;
    document.querySelectorAll(".recent-tag").forEach(tag => {
        if (tag.textContent.trim().toLowerCase() === cityName.toLowerCase()) {
            tag.classList.add("active");
        } else {
            tag.classList.remove("active");
        }
    });
}

function selectRecentCity(city) {
    const cached = getCachedCity(city);
    if (cached) {
        const input = document.getElementById("cityInput");
        if (input) input.value = city;
        renderAnalysis(cached.data, cached.savedAt, true);
        showToast(`Loaded saved data for ${city}`, "info");
    } else {
        analyzeCity(city);
    }
}

/* ==========================================================================
   TOAST NOTIFICATION SYSTEM
   ========================================================================== */
function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    else if (type === "warning") icon = "⚠️";
    else if (type === "error") icon = "❌";

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards";
        setTimeout(() => toast.remove(), 300);
    }, duration);
}