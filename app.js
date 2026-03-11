/* ═══════════════════════════════════════
   DOFUS PROGRESS TRACKER — app.js
   ═══════════════════════════════════════ */

const STORAGE_KEY = 'dofus_tracker_entries';
const MAX_LEVEL = 200;

/* ──────── DATA LAYER ──────── */

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function addEntry(entry) {
  const entries = loadEntries();
  entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveEntries(entries);
  return entries;
}

function deleteEntry(index) {
  const entries = loadEntries();
  entries.splice(index, 1);
  saveEntries(entries);
  return entries;
}

/* ──────── EXPORT / IMPORT ──────── */

function exportJSON() {
  const data = JSON.stringify({ entries: loadEntries() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dofus-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Données exportées ✔');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.entries && Array.isArray(data.entries)) {
        saveEntries(data.entries);
        refreshUI();
        showToast(`${data.entries.length} entrées importées ✔`);
      } else {
        showToast('Format invalide ✘');
      }
    } catch {
      showToast('Erreur de lecture ✘');
    }
  };
  reader.readAsText(file);
}

/* ──────── TOAST ──────── */

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hidden');
  }, 2500);
}

/* ──────── DASHBOARD STATS ──────── */

function renderDashboard(entries) {
  const container = document.getElementById('stat-cards');

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <div class="empty-icon">🗡️</div>
        <p>Aucune donnée — ajoute ta première entrée !</p>
      </div>`;
    return;
  }

  const latest = entries[entries.length - 1];
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;

  const levelDelta = prev ? latest.level - prev.level : 0;
  const succesDelta = prev ? latest.succes - prev.succes : 0;
  // Rank: lower is better → negative diff = improvement
  const levelRankDelta = prev ? prev.levelRank - latest.levelRank : 0;
  const succesRankDelta = prev ? prev.succesRank - latest.succesRank : 0;

  const pct = Math.round((latest.level / MAX_LEVEL) * 100);

  container.innerHTML = `
    ${buildCard('⚔️', formatLevel(latest.level), 'Niveau', levelDelta, true, pct)}
    ${buildCard('🏅', formatRank(latest.levelRank), 'Rang Niveau', levelRankDelta, false)}
    ${buildCard('🏆', formatNum(latest.succes), 'Succès', succesDelta, true)}
    ${buildCard('🎖️', formatRank(latest.succesRank), 'Rang Succès', succesRankDelta, false)}
  `;
}

function buildCard(icon, value, label, delta, higherIsBetter, levelPct) {
  const deltaDir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'none';
  const deltaClass = `delta-${deltaDir}`;
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
  const deltaAbs = Math.abs(delta);
  const deltaText = delta !== 0 ? `${arrow} ${formatNum(deltaAbs)}` : '—';

  const bar = levelPct !== undefined ? `
    <div class="level-bar">
      <div class="level-bar-fill" style="width:${Math.min(levelPct, 100)}%"></div>
    </div>` : '';

  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-delta ${deltaClass}">${deltaText}</div>
      ${bar}
    </div>`;
}

/* ──────── CHARTS ──────── */

let levelChart = null;
let succesChart = null;

const CHART_GOLD = '#f0c040';
const CHART_GOLD_BG = 'rgba(240, 192, 64, 0.12)';
const CHART_SILVER = '#a8b4c8';
const CHART_AMBER = '#e8a020';
const CHART_AMBER_BG = 'rgba(232, 160, 32, 0.12)';

function buildChartConfig(labels, mainData, rankData, mainColor, mainBg, mainLabel, rankLabel) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: mainLabel,
          data: mainData,
          borderColor: mainColor,
          backgroundColor: mainBg,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: rankLabel,
          data: rankData,
          borderColor: CHART_SILVER,
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 1.5,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#9a917f', font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(13,13,26,0.92)',
          titleColor: '#f0c040',
          bodyColor: '#e8e0d0',
          borderColor: 'rgba(212,166,38,0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
        }
      },
      scales: {
        x: {
          ticks: { color: '#6b7a94', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          position: 'left',
          ticks: { color: mainColor, font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: mainLabel, color: mainColor, font: { size: 11 } }
        },
        y1: {
          position: 'right',
          reverse: true,
          ticks: { color: CHART_SILVER, font: { size: 10 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: rankLabel + ' (↓ = mieux)', color: CHART_SILVER, font: { size: 11 } }
        }
      }
    }
  };
}

function renderCharts(entries) {
  const container = document.getElementById('charts-section');

  if (entries.length < 2) {
    container.style.display = entries.length === 0 ? 'none' : 'block';
    if (entries.length === 1) {
      // Show charts even with 1 entry (single dot)
    } else {
      return;
    }
  } else {
    container.style.display = 'block';
  }

  const labels = entries.map(e => formatDate(e.date));
  const levels = entries.map(e => e.level);
  const levelRanks = entries.map(e => e.levelRank);
  const succes = entries.map(e => e.succes);
  const succesRanks = entries.map(e => e.succesRank);

  if (levelChart) {
    updateChart(levelChart, labels, levels, levelRanks);
  } else {
    const ctx = document.getElementById('chart-level').getContext('2d');
    levelChart = new Chart(ctx, buildChartConfig(
      labels, levels, levelRanks,
      CHART_GOLD, CHART_GOLD_BG, 'Niveau', 'Rang'
    ));
  }

  if (succesChart) {
    updateChart(succesChart, labels, succes, succesRanks);
  } else {
    const ctx = document.getElementById('chart-succes').getContext('2d');
    succesChart = new Chart(ctx, buildChartConfig(
      labels, succes, succesRanks,
      CHART_AMBER, CHART_AMBER_BG, 'Succès', 'Rang'
    ));
  }
}

function updateChart(chart, labels, mainData, rankData) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = mainData;
  chart.data.datasets[1].data = rankData;
  chart.update();
}

/* ──────── HISTORY TABLE ──────── */

function renderHistory(entries) {
  const tbody = document.getElementById('history-body');

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:1.5rem">Aucune entrée</td></tr>`;
    return;
  }

  tbody.innerHTML = entries
    .slice()
    .reverse()
    .map((e, i) => {
      const realIndex = entries.length - 1 - i;
      return `
        <tr style="animation: row-in 0.3s ease ${i * 0.03}s backwards">
          <td>${formatDate(e.date)}</td>
          <td>${formatLevel(e.level)}</td>
          <td>${formatRank(e.levelRank)}</td>
          <td>${formatNum(e.succes)}</td>
          <td>${formatRank(e.succesRank)}</td>
          <td><button class="btn-delete" data-index="${realIndex}" title="Supprimer">✕</button></td>
        </tr>`;
    })
    .join('');
}

/* ──────── FORMATTING HELPERS ──────── */

function formatLevel(lvl) {
  if (lvl > 200) {
    return `200<span style="font-size:0.65em; color:var(--silver); margin-left:2px;">Ω${lvl - 200}</span>`;
  }
  return lvl;
}

function formatNum(n) {
  return Number(n).toLocaleString('fr-FR');
}

function formatRank(n) {
  return '#' + Number(n).toLocaleString('fr-FR');
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ──────── MASTER REFRESH ──────── */

function refreshUI() {
  const entries = loadEntries();
  renderDashboard(entries);
  renderCharts(entries);
  renderHistory(entries);
}

/* ──────── EVENT WIRING ──────── */

document.addEventListener('DOMContentLoaded', () => {
  // Set default date
  document.getElementById('input-date').value = todayISO();

  // Form submit
  document.getElementById('entry-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const entry = {
      date: document.getElementById('input-date').value,
      level: parseInt(document.getElementById('input-level').value, 10),
      levelRank: parseInt(document.getElementById('input-level-rank').value, 10),
      succes: parseInt(document.getElementById('input-succes').value, 10),
      succesRank: parseInt(document.getElementById('input-succes-rank').value, 10),
    };
    addEntry(entry);
    e.target.reset();
    document.getElementById('input-date').value = todayISO();
    refreshUI();
    showToast('Entrée ajoutée ⚔');
  });

  // Delete entry
  document.getElementById('history-body').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    deleteEntry(idx);
    refreshUI();
    showToast('Entrée supprimée');
  });

  // Toggle history
  document.getElementById('toggle-history').addEventListener('click', () => {
    const content = document.getElementById('history-content');
    const arrow = document.querySelector('.toggle-arrow');
    content.classList.toggle('hidden');
    arrow.classList.toggle('open');
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', exportJSON);

  // Import
  document.getElementById('file-import').addEventListener('change', (e) => {
    if (e.target.files.length) {
      importJSON(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Initial render
  refreshUI();
});
