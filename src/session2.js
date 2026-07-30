import Chart from 'chart.js/auto';

// ── 원본 데이터 (50명 용돈, 만원) ─────────────────────────
const RAW_DATA = [
  15, 20, 20, 25, 25, 25, 30, 30, 30, 30,
  35, 35, 35, 35, 35, 40, 40, 40, 40, 40,
  45, 45, 45, 45, 50, 50, 50, 55, 55, 60,
  60, 65, 70, 75, 80, 85, 90, 100, 110, 120,
  150, 180, 200, 220, 250, 300, 350, 400, 450, 500,
].sort((a, b) => a - b);

const STORAGE_KEY = 'mycpi_s2_method';

export const session2State = {
  filteredData:   [...RAW_DATA],
  mean:           0,
  median:         0,
  mode:           0,
  skewness:       0,
  q1:             0,
  q3:             0,
  iqr:            0,
  activeCount:    RAW_DATA.length,
  totalCount:     RAW_DATA.length,
  outlierMethod:  localStorage.getItem(STORAGE_KEY) || 'none',
  // 전방식 캐시 (활동지 1-2 연동용)
  statsAll: { none: null, iqr: null, sd: null },
};

let chartInstance = null;
let onStateChangeCb = null;

// ── 초기화 ────────────────────────────────────────────────────
export function initSession2(onStateChange) {
  onStateChangeCb = onStateChange;

  // 라디오 버튼 복원 및 바인딩
  const radios = document.querySelectorAll('input[name="outlier-method"]');
  radios.forEach(r => {
    if (r.value === session2State.outlierMethod) r.checked = true;
    r.addEventListener('change', e => {
      session2State.outlierMethod = e.target.value;
      localStorage.setItem(STORAGE_KEY, e.target.value);
      processData(e.target.value);
    });
  });

  // 모든 방식의 통계 미리 계산 → 활동지 1-2 자동 채움
  preCalcAll();
  processData(session2State.outlierMethod);
}

// ── 전 방식 사전 계산 ────────────────────────────────────────
function preCalcAll() {
  const methods = ['none', 'iqr', 'sd'];
  methods.forEach(m => {
    session2State.statsAll[m] = calcStats(filterData(m));
  });
  updateWorksheet1_2();
}

function filterData(method) {
  let data = [...RAW_DATA];
  if (method === 'iqr') {
    const s = calcBasic(data);
    data = data.filter(v => v >= s.lowerIQR && v <= s.upperIQR);
  } else if (method === 'sd') {
    const s = calcBasic(data);
    data = data.filter(v => v >= s.lowerSD && v <= s.upperSD);
  }
  return data;
}

// ── 데이터 처리 ───────────────────────────────────────────────
function processData(method) {
  const data = filterData(method);
  session2State.filteredData = data;
  session2State.activeCount  = data.length;

  const s = calcStats(data);
  Object.assign(session2State, s);

  // UI 업데이트
  elText('stat-mean',     `${s.mean.toFixed(1)} 만원`);
  elText('stat-median',   `${s.median.toFixed(1)} 만원`);
  elText('stat-mode',     `${s.mode.toFixed(0)} 만원`);
  elText('stat-skewness', s.skewness.toFixed(3));
  elText('stat-q1',       `${s.q1.toFixed(1)} 만원`);
  elText('stat-q3',       `${s.q3.toFixed(1)} 만원`);
  elText('stat-iqr',      `${s.iqr.toFixed(1)} 만원`);
  elText('stat-iqr15',    `${(s.iqr * 1.5).toFixed(1)} 만원`);
  elText('stat-count',    `${data.length} / ${RAW_DATA.length}명`);

  renderChart(data, s);
  if (onStateChangeCb) onStateChangeCb(session2State);
}

// ── 활동지 1-2 자동 채움 ─────────────────────────────────────
function updateWorksheet1_2() {
  const sNone = session2State.statsAll.none;
  const sIqr  = session2State.statsAll.iqr;
  const sSd   = session2State.statsAll.sd;
  if (!sNone) return;

  const setCell = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

  // 평균
  setCell('r-mean-raw', `${sNone.mean.toFixed(1)} 만원`);
  setCell('r-mean-iqr', `${sIqr.mean.toFixed(1)} 만원`);
  setCell('r-mean-sd',  `${sSd.mean.toFixed(1)} 만원`);
  // 중앙값
  setCell('r-med-raw', `${sNone.median.toFixed(1)} 만원`);
  setCell('r-med-iqr', `${sIqr.median.toFixed(1)} 만원`);
  setCell('r-med-sd',  `${sSd.median.toFixed(1)} 만원`);
  // 왜곡도
  setCell('r-skew-raw', sNone.skewness.toFixed(3));
  setCell('r-skew-iqr', sIqr.skewness.toFixed(3));
  setCell('r-skew-sd',  sSd.skewness.toFixed(3));
  // IQR 관련 (원본 기준 고정)
  setCell('r-q1',    `${sNone.q1.toFixed(1)} 만원`);
  setCell('r-q3',    `${sNone.q3.toFixed(1)} 만원`);
  setCell('r-iqr',   `${sNone.iqr.toFixed(1)} 만원`);
  setCell('r-lower', `${sNone.lowerIQR.toFixed(1)} 만원`);
  setCell('r-upper', `${sNone.upperIQR.toFixed(1)} 만원`);
  // 유효 수
  setCell('r-n-raw', `${RAW_DATA.length}명`);
  setCell('r-n-iqr', `${filterData('iqr').length}명`);
  setCell('r-n-sd',  `${filterData('sd').length}명`);
}

// ── 통계 계산 ────────────────────────────────────────────────
function calcStats(arr) {
  return { ...calcBasic(arr), ...calcSkewMode(arr) };
}

function calcBasic(arr) {
  if (!arr.length) return { mean: 0, median: 0, sd: 0, q1: 0, q3: 0, iqr: 0, lowerIQR: 0, upperIQR: 0, lowerSD: 0, upperSD: 0 };

  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;

  // Median
  const mid = Math.floor(arr.length / 2);
  const median = arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];

  // SD
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  const sd = Math.sqrt(variance);

  // Quartiles
  const q1 = percentile(arr, 25);
  const q3 = percentile(arr, 75);
  const iqr = q3 - q1;

  return {
    mean, median, sd, q1, q3, iqr,
    lowerIQR: q1 - 1.5 * iqr,
    upperIQR: q3 + 1.5 * iqr,
    lowerSD:  mean - 2 * sd,
    upperSD:  mean + 2 * sd,
  };
}

function calcSkewMode(arr) {
  if (!arr.length) return { skewness: 0, mode: 0 };
  const { mean, sd } = calcBasic(arr);

  // Skewness (Fisher's moment)
  const n = arr.length;
  const cubedDiffSum = arr.reduce((s, v) => s + (v - mean) ** 3, 0);
  const skewness = sd > 0 ? cubedDiffSum / (n * sd ** 3) : 0;

  // Mode
  const freq = {};
  let maxF = 0, mode = arr[0];
  arr.forEach(v => {
    freq[v] = (freq[v] || 0) + 1;
    if (freq[v] > maxF) { maxF = freq[v]; mode = v; }
  });

  return { skewness, mode };
}

function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── 차트 렌더링 ──────────────────────────────────────────────
function renderChart(data, stats) {
  const ctx = document.getElementById('p1-chart-dist')?.getContext('2d');
  if (!ctx) return;

  const BIN = 30;
  const maxVal = Math.max(...RAW_DATA);
  const bins = Array.from({ length: Math.ceil((maxVal + 1) / BIN) }, (_, i) => ({
    label: `${i * BIN}~${(i + 1) * BIN}만`,
    count: 0,
    min: i * BIN,
  }));

  data.forEach(v => {
    const idx = Math.floor(v / BIN);
    if (bins[idx]) bins[idx].count++;
  });

  // Vertical line plugin for mean / median / mode
  const linesPlugin = {
    id: 'vLines',
    afterDraw(chart) {
      const { ctx: c, chartArea: { top, bottom }, scales: { x } } = chart;
      const drawLine = (val, color) => {
        const binIdx = val / BIN;
        const xPos   = x.getPixelForValue(binIdx - 0.5);
        c.save();
        c.strokeStyle = color;
        c.lineWidth   = 2.5;
        c.setLineDash([5, 4]);
        c.beginPath();
        c.moveTo(xPos, top);
        c.lineTo(xPos, bottom);
        c.stroke();
        c.restore();
      };
      drawLine(stats.mean,   'rgba(239,68,68,.9)');
      drawLine(stats.median, 'rgba(59,130,246,.9)');
      drawLine(stats.mode,   'rgba(16,185,129,.9)');
    },
  };

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bins.map(b => b.label),
      datasets: [{
        label: '빈도수 (명)',
        data: bins.map(b => b.count),
        backgroundColor: 'rgba(79,70,229,0.72)',
        borderColor:     'rgb(79,70,229)',
        borderWidth: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: '용돈 구간 (만원)', font: { size: 11, weight: 'bold' } } },
        y: { beginAtZero: true, ticks: { stepSize: 2 }, title: { display: true, text: '인원수 (명)', font: { size: 11, weight: 'bold' } } },
      },
      plugins: { legend: { display: false } },
    },
    plugins: [linesPlugin],
  });
}

function elText(id, text) { const e = document.getElementById(id); if (e) e.textContent = text; }
