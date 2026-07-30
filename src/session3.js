import Chart from 'chart.js/auto';

const STORAGE_KEY = 'mycpi_s3_state';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { rate: 3.4, years: 20 };
  } catch { return { rate: 3.4, years: 20 }; }
}

const saved = loadState();

export const session3State = {
  rate:               saved.rate,
  years:              saved.years,
  accumulatedInflation: 0,
  realPurchasingPower:  100,
};

let chartInstance = null;
let onStateChangeCb = null;

// ── 초기화 ────────────────────────────────────────────────────
export function initSession3(onStateChange) {
  onStateChangeCb = onStateChange;

  const rSlider = document.getElementById('sim-rate');
  const rNum    = document.getElementById('sim-rate-num');
  const nSlider = document.getElementById('sim-years');
  const nNum    = document.getElementById('sim-years-num');

  // 복원
  if (rSlider) rSlider.value = session3State.rate;
  if (rNum)    rNum.value    = session3State.rate;
  if (nSlider) nSlider.value = session3State.years;
  if (nNum)    nNum.value    = session3State.years;

  // Rate
  rSlider?.addEventListener('input', () => {
    const v = clampF(parseFloat(rSlider.value) || 0, 0, 20);
    rNum.value = v;
    session3State.rate = v;
    saveAndCalc();
  });
  rNum?.addEventListener('input', () => {
    const v = clampF(parseFloat(rNum.value) || 0, 0, 20);
    rSlider.value = v;
    session3State.rate = v;
    saveAndCalc();
  });

  // Years
  nSlider?.addEventListener('input', () => {
    const v = clampI(parseInt(nSlider.value) || 1, 1, 50);
    nNum.value = v;
    session3State.years = v;
    saveAndCalc();
  });
  nNum?.addEventListener('input', () => {
    const v = clampI(parseInt(nNum.value) || 1, 1, 50);
    nSlider.value = v;
    session3State.years = v;
    saveAndCalc();
  });

  calcAndRender();
  renderChart();
}

// My-CPI를 session1에서 자동 동기화
export function syncRateFromSession1(newRate) {
  const clamped = clampF(newRate, 0, 20);
  session3State.rate = clamped;

  const rSlider = document.getElementById('sim-rate');
  const rNum    = document.getElementById('sim-rate-num');
  if (rSlider) rSlider.value = clamped;
  if (rNum)    rNum.value    = clamped;

  saveAndCalc();
}

function saveAndCalc() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rate: session3State.rate, years: session3State.years }));
  calcAndRender();
}

// ── 계산 ──────────────────────────────────────────────────────
function calcAndRender() {
  const r = session3State.rate / 100;
  const n = session3State.years;

  const compound = Math.pow(1 + r, n);
  session3State.accumulatedInflation  = round1((compound - 1) * 100);
  session3State.realPurchasingPower   = round1(100 / compound);

  elText('accumulated-inflation',  `${session3State.accumulatedInflation.toFixed(1)}%`);
  elText('real-purchasing-power',  `${session3State.realPurchasingPower.toFixed(1)} 만원`);

  updateWorksheet2_1(r, n);
  renderChart();

  if (onStateChangeCb) onStateChangeCb(session3State);
}

// ── 활동지 2-1 자동 채움 ─────────────────────────────────────
const FIXED_YEARS = [1, 5, 10, 20];

function updateWorksheet2_1(r, n) {
  FIXED_YEARS.forEach(yr => {
    const comp = 100 / Math.pow(1 + r, yr);
    const simp = 100 / (1 + r * yr);
    const diff = round2(comp - simp);
    const acc  = round1((Math.pow(1 + r, yr) - 1) * 100);

    elText(`pp-comp-${yr}`,  `${comp.toFixed(2)} 만원`);
    elText(`pp-simp-${yr}`,  `${simp.toFixed(2)} 만원`);
    elText(`pp-diff-${yr}`,  `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} 만원`);
    elText(`pp-acc-${yr}`,   `+${acc.toFixed(1)}%`);
  });

  // 설정 n 행
  const compN = 100 / Math.pow(1 + r, n);
  const simpN = 100 / (1 + r * n);
  const diffN = round2(compN - simpN);
  const accN  = round1((Math.pow(1 + r, n) - 1) * 100);

  elText('pp-n-custom', `${n}년 (설정값)`);
  elText('pp-comp-n',   `${compN.toFixed(2)} 만원`);
  elText('pp-simp-n',   `${simpN.toFixed(2)} 만원`);
  elText('pp-diff-n',   `${diffN >= 0 ? '+' : ''}${diffN.toFixed(2)} 만원`);
  elText('pp-acc-n',    `+${accN.toFixed(1)}%`);
}

// ── 차트 렌더링 ──────────────────────────────────────────────
function renderChart() {
  const ctx = document.getElementById('p2-chart-power')?.getContext('2d');
  if (!ctx) return;

  const r  = session3State.rate / 100;
  const n  = session3State.years;
  const labels = [], comp = [], simp = [];

  for (let yr = 0; yr <= n; yr++) {
    labels.push(`${yr}년`);
    comp.push(round2(100 / Math.pow(1 + r, yr)));
    simp.push(round2(100 / (1 + r * yr)));
  }

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '복리 감쇄 (비선형)',
          data: comp,
          borderColor: 'rgb(239,68,68)',
          backgroundColor: 'rgba(239,68,68,0.06)',
          borderWidth: 3,
          fill: true,
          tension: 0.12,
          pointRadius: n > 30 ? 0 : 3,
        },
        {
          label: '단리 감쇄 (선형)',
          data: simp,
          borderColor: 'rgb(148,163,184)',
          borderWidth: 2,
          borderDash: [6, 4],
          fill: false,
          tension: 0,
          pointRadius: n > 30 ? 0 : 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0, max: 100,
          title: { display: true, text: '실질 가치 (만원)', font: { size: 11, weight: 'bold' } },
        },
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
      },
    },
  });
}

// ── 헬퍼 ────────────────────────────────────────────────────
function clampF(v, min, max) { return Math.max(min, Math.min(max, v)); }
function clampI(v, min, max) { return Math.max(min, Math.min(max, Math.round(v))); }
function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }
function elText(id, text) { const e = document.getElementById(id); if (e) e.textContent = text; }
