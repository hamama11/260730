import Chart from 'chart.js/auto';

// ── CPI 기초 데이터 ──────────────────────────────────────────
export const cpiCategories = [
  { id: 'food',      name: '식료품 및 비주류음료', officialWeight: 14.1, inflation: 5.2 },
  { id: 'housing',   name: '주택·수도·광열',       officialWeight: 17.0, inflation: 4.5 },
  { id: 'education', name: '교육',                 officialWeight: 12.0, inflation: 2.1 },
  { id: 'transport', name: '교통',                 officialWeight: 11.4, inflation: 1.8 },
  { id: 'leisure',   name: '오락·문화',             officialWeight:  6.8, inflation: 3.0 },
  { id: 'health',    name: '보건',                  officialWeight:  8.4, inflation: 1.5 },
  { id: 'others',    name: '기타 상품 및 서비스',   officialWeight: 30.3, inflation: 2.8 },
];

// ── 초기 상태 (localStorage에서 복원) ───────────────────────
const STORAGE_KEY_WEIGHTS = 'mycpi_s1_weights';
const defaultWeights = { food: 15, housing: 17, education: 12, transport: 11, leisure: 7, health: 8, others: 30 };

function loadWeights() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WEIGHTS);
    return saved ? JSON.parse(saved) : { ...defaultWeights };
  } catch { return { ...defaultWeights }; }
}

export const session1State = {
  weights:          loadWeights(),
  officialCpi:      0,
  myCpi:            0,
  simpleAverageCpi: 0,
};

let chartInstance = null;
let onStateChangeCb = null;

// ── 초기화 ────────────────────────────────────────────────────
export function initSession1(onStateChange) {
  onStateChangeCb = onStateChange;
  renderWeightInputs();
  calcAndRender();
  renderChart();
}

// ── 가중치 입력 UI 동적 렌더링 ──────────────────────────────
function renderWeightInputs() {
  const container = document.getElementById('p1-weight-inputs');
  if (!container) return;

  container.innerHTML = cpiCategories.map(cat => `
    <div class="wi-row">
      <label class="wi-label" for="w-${cat.id}">${cat.name}<br>
        <small style="font-weight:400;color:#94a3b8;font-size:.75rem;">국가 ${cat.officialWeight}%</small>
      </label>
      <input type="range" id="w-${cat.id}" class="slider" min="0" max="100" value="${session1State.weights[cat.id]}">
      <div class="wi-num-wrap">
        <input type="number" id="w-${cat.id}-num" class="num-input" min="0" max="100" value="${session1State.weights[cat.id]}" style="width:58px;">
        <span class="unit">%</span>
      </div>
    </div>
  `).join('');

  // 이벤트 바인딩
  cpiCategories.forEach(cat => {
    const slider = document.getElementById(`w-${cat.id}`);
    const num    = document.getElementById(`w-${cat.id}-num`);

    slider?.addEventListener('input', () => {
      const v = clamp(parseInt(slider.value) || 0, 0, 100);
      num.value = v;
      session1State.weights[cat.id] = v;
      saveAndUpdate();
    });

    num?.addEventListener('input', () => {
      const v = clamp(parseInt(num.value) || 0, 0, 100);
      slider.value = v;
      session1State.weights[cat.id] = v;
      saveAndUpdate();
    });
  });
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function saveAndUpdate() {
  localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(session1State.weights));
  calcAndRender();
}

// ── 계산 및 UI 업데이트 ─────────────────────────────────────
function calcAndRender() {
  const sum = Object.values(session1State.weights).reduce((a, b) => a + b, 0);

  // ① 가중치 합계 상태바
  const totalEl    = document.getElementById('weight-total');
  const progressEl = document.getElementById('weight-progress');
  const warnEl     = document.getElementById('weight-warning');

  if (totalEl) totalEl.textContent = `${sum}%`;
  if (progressEl) {
    progressEl.style.width = `${Math.min(sum, 100)}%`;
    const ok = sum === 100;
    progressEl.style.background = ok ? '#10b981' : sum > 100 ? '#ef4444' : '#f59e0b';
  }
  if (warnEl) warnEl.classList.toggle('hidden', sum === 100);

  // ② 공식 CPI (국가 가중치 고정)
  const officialSum = cpiCategories.reduce((s, c) => s + c.officialWeight * c.inflation, 0);
  session1State.officialCpi = round2(officialSum / 100);

  // ③ My-CPI (사용자 가중치)
  const mySum = cpiCategories.reduce((s, c) => s + (session1State.weights[c.id] || 0) * c.inflation, 0);
  session1State.myCpi = sum > 0 ? round2(mySum / sum) : 0;

  // ④ 단순 평균
  const simSum = cpiCategories.reduce((s, c) => s + c.inflation, 0);
  session1State.simpleAverageCpi = round2(simSum / cpiCategories.length);

  // ⑤ 헤더 카드 업데이트
  el('official-cpi-val').textContent = `${session1State.officialCpi.toFixed(2)}%`;
  el('my-cpi-val').textContent        = `${session1State.myCpi.toFixed(2)}%`;
  el('simple-cpi-val').textContent    = `${session1State.simpleAverageCpi.toFixed(2)}%`;

  // ⑥ 활동지 1-1 자동 채움
  updateWorksheet1_1(sum);

  // ⑦ 차트 업데이트
  if (chartInstance) {
    chartInstance.data.datasets[0].data = cpiCategories.map(c => session1State.weights[c.id]);
    chartInstance.update('none');
  }

  if (onStateChangeCb) onStateChangeCb(session1State);
}

// ── 활동지 1-1 자동 채움 ─────────────────────────────────────
function updateWorksheet1_1(sumW) {
  const tbody = document.getElementById('act1-1-tbody');
  if (!tbody) return;

  tbody.innerHTML = cpiCategories.map(cat => {
    const w    = session1State.weights[cat.id] || 0;
    const a    = cat.officialWeight;
    const diff = round2(w - a);
    const contrib = sumW > 0 ? round2((w / sumW) * cat.inflation) : 0;
    const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
    return `
      <tr>
        <td>${cat.name}</td>
        <td class="auto-fill" style="text-align:right;">${a.toFixed(1)}%</td>
        <td class="auto-fill" style="text-align:right;">${w.toFixed(1)}%</td>
        <td class="auto-fill" style="text-align:right;${diff !== 0 ? `color:${diff > 0 ? '#b45309':'#1d4ed8'};` : ''}">${diffStr}%p</td>
        <td class="auto-fill" style="text-align:right;">${cat.inflation.toFixed(1)}%</td>
        <td class="auto-fill" style="text-align:right;">${contrib.toFixed(3)}%</td>
      </tr>
    `;
  }).join('');

  el('act1-1-total-w').textContent = `${sumW.toFixed(1)}%`;
  el('act1-1-mycpi').textContent   = `${session1State.myCpi.toFixed(2)}%`;
}

// ── 차트 렌더링 ──────────────────────────────────────────────
function renderChart() {
  const ctx = document.getElementById('p1-chart-weight')?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cpiCategories.map(c => c.name),
      datasets: [
        {
          label: '나의 가중치 (%)',
          data: cpiCategories.map(c => session1State.weights[c.id]),
          backgroundColor: 'rgba(79,70,229,0.82)',
          borderColor: 'rgb(79,70,229)',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: '국가 가중치 (%)',
          data: cpiCategories.map(c => c.officialWeight),
          backgroundColor: 'rgba(148,163,184,0.45)',
          borderColor: 'rgb(148,163,184)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: '가중치 (%)', font: { size: 11, weight: 'bold' } },
        },
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
      },
    },
  });
}

// ── 헬퍼 ────────────────────────────────────────────────────
function el(id) { return document.getElementById(id) || { textContent: '' }; }
function round2(v) { return Math.round(v * 100) / 100; }
