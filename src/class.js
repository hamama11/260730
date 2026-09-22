import './style.css';
import Chart from 'chart.js/auto';

// CPI Categories (same as assessment)
const cpiCategories = [
  { id: 'food',      name: '식료품 및 비주류음료', officialWeight: 14.1, inflation: 5.2 },
  { id: 'housing',   name: '주택·수도·광열',       officialWeight: 17.0, inflation: 4.5 },
  { id: 'education', name: '교육',                 officialWeight: 12.0, inflation: 2.1 },
  { id: 'transport', name: '교통',                 officialWeight: 11.4, inflation: 1.8 },
  { id: 'leisure',   name: '오락·문화',             officialWeight:  6.8, inflation: 3.0 },
  { id: 'health',    name: '보건',                  officialWeight:  8.4, inflation: 1.5 },
  { id: 'others',    name: '기타 상품 및 서비스',   officialWeight: 30.3, inflation: 2.8 }
];

// Pocket Money Dataset (changed from const to let/mutable for random data generation)
let RAW_POCKET_DATA = [
  15, 20, 20, 25, 25, 25, 30, 30, 30, 30,
  35, 35, 35, 35, 35, 40, 40, 40, 40, 40,
  45, 45, 45, 45, 50, 50, 50, 55, 55, 60,
  60, 65, 70, 75, 80, 85, 90, 100, 110, 120,
  150, 180, 200, 220, 250, 300, 350, 400, 450, 500
].sort((a, b) => a - b);

document.addEventListener('DOMContentLoaded', () => {

  // 1. Tab Navigation & Helper Function
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const roadmapCards = document.querySelectorAll('.roadmap-step-card');

  function switchTab(targetTabId) {
    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === targetTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabContents.forEach(content => {
      if (content.id === targetTabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Sync Roadmap Cards active state
    roadmapCards.forEach(card => card.classList.remove('active'));
    if (targetTabId === 'class0' || targetTabId === 'class1') {
      document.getElementById('roadmap-card-cpi')?.classList.add('active');
    } else if (targetTabId === 'class2' || targetTabId === 'class3' || targetTabId === 'class4') {
      document.getElementById('roadmap-card-stat')?.classList.add('active');
    } else if (targetTabId === 'class-pension') {
      document.getElementById('roadmap-card-pens')?.classList.add('active');
    }

    // Force trigger calculations and chart resizing when entering tabs
    if (targetTabId === 'class1') renderC1Chart();
    if (targetTabId === 'class2') renderC2Chart();
    if (targetTabId === 'class3') renderC3Chart();
    if (targetTabId === 'class4') calculateC4Scenarios();
    if (targetTabId === 'class-pension') {
      calculatePension();
      renderPensionChart();
    }

    // Trigger MathJax typeset update when changing tabs
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      window.MathJax.typesetPromise();
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });

  // Roadmap card click handler
  roadmapCards.forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-target-tab');
      if (target) {
        switchTab(target);
        // smooth scroll down past the roadmap
        const targetSection = document.getElementById(target);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Next Question Bridge jump button handlers
  document.querySelectorAll('.bridge-jump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-jump-to');
      if (target) {
        switchTab(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // 1.5. Global Student Name localStorage binding
  const globalNameEl = document.getElementById('global-student-name');
  if (globalNameEl) {
    globalNameEl.value = localStorage.getItem('mycpi_student_name') || '';
    globalNameEl.addEventListener('input', () => {
      localStorage.setItem('mycpi_student_name', globalNameEl.value);
    });
  }

  // 2. Q&A Textareas localStorage binding
  const qItems = ['c-q1-answer', 'c-q2-answer', 'c-q3-answer', 'c-q4-answer'];
  qItems.forEach(id => {
    const el = document.getElementById(id);
    const countEl = document.getElementById(id.replace('answer', 'chars'));
    if (!el) return;
    const stored = localStorage.getItem(id) || '';
    el.value = stored;
    if (countEl) countEl.textContent = stored.length;

    el.addEventListener('input', () => {
      localStorage.setItem(id, el.value);
      if (countEl) countEl.textContent = el.value.length;
    });
  });

  // ==========================================
  // [0차시] 소비자물가지수(CPI) 실시간 산출 시뮬레이터
  // ==========================================
  const c0Inputs = {
    p0Rice: document.getElementById('c0-p0-rice'),
    q0Rice: document.getElementById('c0-q0-rice'),
    ptRice: document.getElementById('c0-pt-rice'),
    ptRiceVal: document.getElementById('c0-pt-rice-val'),

    p0Elec: document.getElementById('c0-p0-elec'),
    q0Elec: document.getElementById('c0-q0-elec'),
    ptElec: document.getElementById('c0-pt-elec'),
    ptElecVal: document.getElementById('c0-pt-elec-val'),

    p0Movie: document.getElementById('c0-p0-movie'),
    q0Movie: document.getElementById('c0-q0-movie'),
    ptMovie: document.getElementById('c0-pt-movie'),
    ptMovieVal: document.getElementById('c0-pt-movie-val')
  };

  function calculateC0() {
    if (!c0Inputs.p0Rice) return; // safety check

    const p0R = parseFloat(c0Inputs.p0Rice.value) || 0;
    const q0R = parseFloat(c0Inputs.q0Rice.value) || 0;
    const ptR = parseFloat(c0Inputs.ptRice.value) || 0;

    const p0E = parseFloat(c0Inputs.p0Elec.value) || 0;
    const q0E = parseFloat(c0Inputs.q0Elec.value) || 0;
    const ptE = parseFloat(c0Inputs.ptElec.value) || 0;

    const p0M = parseFloat(c0Inputs.p0Movie.value) || 0;
    const q0M = parseFloat(c0Inputs.q0Movie.value) || 0;
    const ptM = parseFloat(c0Inputs.ptMovie.value) || 0;

    // Update Pt value text labels
    if (c0Inputs.ptRiceVal) c0Inputs.ptRiceVal.textContent = ptR.toLocaleString();
    if (c0Inputs.ptElecVal) c0Inputs.ptElecVal.textContent = ptE.toLocaleString();
    if (c0Inputs.ptMovieVal) c0Inputs.ptMovieVal.textContent = ptM.toLocaleString();

    // Calculations
    const costRice0  = p0R * q0R;
    const costElec0  = p0E * q0E;
    const costMovie0 = p0M * q0M;
    const sum0 = costRice0 + costElec0 + costMovie0;

    const costRiceT  = ptR * q0R;
    const costElecT  = ptE * q0E;
    const costMovieT = ptM * q0M;
    const sumT = costRiceT + costElecT + costMovieT;

    const cpi = sum0 > 0 ? (sumT / sum0) * 100 : 0;

    // Weights (in per-mil / 1000)
    const wRice  = sum0 > 0 ? Math.round((costRice0 / sum0) * 1000) : 0;
    const wElec  = sum0 > 0 ? Math.round((costElec0 / sum0) * 1000) : 0;
    const wMovie = sum0 > 0 ? (1000 - wRice - wElec) : 0; // ensure total is exactly 1000

    // Update DOM
    const elSum0  = document.getElementById('c0-calc-sum0');
    const elSumt  = document.getElementById('c0-calc-sumt');
    const elCpi   = document.getElementById('c0-calc-cpi');
    const elWRice = document.getElementById('c0-weight-rice-val');
    const elWElec = document.getElementById('c0-weight-elec-val');
    const elWMov  = document.getElementById('c0-weight-movie-val');

    if (elSum0) elSum0.textContent = `${sum0.toLocaleString()} 원`;
    if (elSumt) elSumt.textContent = `${sumT.toLocaleString()} 원`;
    if (elCpi)  elCpi.textContent = cpi.toFixed(2);

    if (elWRice) elWRice.textContent = wRice;
    if (elWElec) elWElec.textContent = wElec;
    if (elWMov)  elWMov.textContent  = wMovie;
  }

  // Bind inputs
  Object.values(c0Inputs).forEach(input => {
    if (input && input.tagName !== 'SPAN') {
      input.addEventListener('input', calculateC0);
    }
  });

  // Run initial calculation
  calculateC0();


  // ==========================================
  // [1차시] 가중 구조 데이터 학습 & My-CPI
  // ==========================================
  const c1Weights = { food: 15, housing: 17, education: 12, transport: 11, leisure: 7, health: 8, others: 30 };
  let c1ChartInstance = null;

  // Render Sliders dynamically
  const c1InputsWrap = document.getElementById('c1-weight-inputs');
  if (c1InputsWrap) {
    c1InputsWrap.innerHTML = cpiCategories.map(cat => `
      <div class="wi-row">
        <label class="wi-label" for="c1-w-${cat.id}">${cat.name}<br>
          <small style="font-weight:400;color:#94a3b8;font-size:.75rem;">국가 ${cat.officialWeight}%</small>
        </label>
        <input type="range" id="c1-w-${cat.id}" class="slider" min="0" max="100" value="${c1Weights[cat.id]}">
        <div class="wi-num-wrap">
          <input type="number" id="c1-w-${cat.id}-num" class="num-input" min="0" max="100" value="${c1Weights[cat.id]}" style="width:58px;">
          <span class="unit">%</span>
        </div>
      </div>
    `).join('');

    cpiCategories.forEach(cat => {
      const slider = document.getElementById(`c1-w-${cat.id}`);
      const num = document.getElementById(`c1-w-${cat.id}-num`);
      
      slider?.addEventListener('input', () => {
        const v = Math.max(0, Math.min(100, parseInt(slider.value) || 0));
        num.value = v;
        c1Weights[cat.id] = v;
        calculateC1();
      });

      num?.addEventListener('input', () => {
        const v = Math.max(0, Math.min(100, parseInt(num.value) || 0));
        slider.value = v;
        c1Weights[cat.id] = v;
        calculateC1();
      });
    });
  }

  // 1차시 랜덤 가중치 설정 버튼 핸들러
  const btnRandWeights = document.getElementById('btn-rand-weights');
  btnRandWeights?.addEventListener('click', () => {
    // Generate 7 random values summing to 100
    const cuts = [];
    for (let i = 0; i < cpiCategories.length - 1; i++) {
      cuts.push(Math.floor(Math.random() * 101));
    }
    cuts.sort((a, b) => a - b);
    
    const randVals = [];
    randVals.push(cuts[0]);
    for (let i = 1; i < cpiCategories.length - 1; i++) {
      randVals.push(cuts[i] - cuts[i-1]);
    }
    randVals.push(100 - cuts[cpiCategories.length - 2]);

    cpiCategories.forEach((cat, index) => {
      const val = randVals[index];
      c1Weights[cat.id] = val;
      const slider = document.getElementById(`c1-w-${cat.id}`);
      const num = document.getElementById(`c1-w-${cat.id}-num`);
      if (slider) slider.value = val;
      if (num) num.value = val;
    });

    calculateC1();
  });

  function calculateC1() {
    const sum = Object.values(c1Weights).reduce((a, b) => a + b, 0);
    const totalEl = document.getElementById('c1-weight-total');
    const progressEl = document.getElementById('c1-weight-progress');
    const warnEl = document.getElementById('c1-weight-warning');

    if (totalEl) totalEl.textContent = `${sum}%`;
    if (progressEl) {
      progressEl.style.width = `${Math.min(sum, 100)}%`;
      progressEl.style.background = (sum === 100) ? '#10b981' : (sum > 100) ? '#ef4444' : '#f59e0b';
    }
    if (warnEl) warnEl.classList.toggle('hidden', sum === 100);

    // Official CPI
    const offSum = cpiCategories.reduce((s, c) => s + c.officialWeight * c.inflation, 0);
    const officialCpi = offSum / 100;

    // My-CPI
    const mySum = cpiCategories.reduce((s, c) => s + c1Weights[c.id] * c.inflation, 0);
    const myCpi = sum > 0 ? mySum / sum : 0;

    // Simple Avg
    const simpleAvg = cpiCategories.reduce((s, c) => s + c.inflation, 0) / cpiCategories.length;

    // Update labels
    document.getElementById('c1-official-val').textContent = `${officialCpi.toFixed(2)}%`;
    document.getElementById('c1-my-val').textContent = `${myCpi.toFixed(2)}%`;
    document.getElementById('c1-simple-val').textContent = `${simpleAvg.toFixed(2)}%`;

    // Sync to tab 4 summary label
    const t4MyCpiLabel = document.getElementById('c4-my-cpi-val');
    if (t4MyCpiLabel) t4MyCpiLabel.textContent = `${myCpi.toFixed(2)}%`;

    // Also sync to tab 3 rate slider if same rate
    const c3RateSlider = document.getElementById('c3-rate');
    const c3RateNum = document.getElementById('c3-rate-num');
    if (c3RateSlider && c3RateNum && sum === 100) {
      c3RateSlider.value = myCpi.toFixed(1);
      c3RateNum.value = myCpi.toFixed(1);
      c3RateSlider.dispatchEvent(new Event('input'));
    }

    if (c1ChartInstance) {
      c1ChartInstance.data.datasets[0].data = cpiCategories.map(c => c1Weights[c.id]);
      c1ChartInstance.update();
    }
  }

  function renderC1Chart() {
    const ctx = document.getElementById('c1-chart-weight')?.getContext('2d');
    if (!ctx) return;
    if (c1ChartInstance) c1ChartInstance.destroy();

    c1ChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cpiCategories.map(c => c.name),
        datasets: [
          {
            label: '나의 가중치 (%)',
            data: cpiCategories.map(c => c1Weights[c.id]),
            backgroundColor: 'rgba(79, 70, 229, 0.82)',
            borderColor: 'rgb(79, 70, 229)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: '국가 가중치 (%)',
            data: cpiCategories.map(c => c.officialWeight),
            backgroundColor: 'rgba(148, 163, 184, 0.45)',
            borderColor: 'rgb(148, 163, 184)',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '가중치 (%)' } }
        }
      }
    });
  }

  // ==========================================
  // [2차시] 데이터 왜곡도 & 대표값 정합성
  // ==========================================
  let c2OutlierMethod = 'none';
  let c2ChartInstance = null;

  const c2Radios = document.querySelectorAll('input[name="class-outlier-method"]');
  c2Radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      c2OutlierMethod = e.target.value;
      calculateC2();
    });
  });

  // 2차시 랜덤 데이터 생성 버튼 핸들러
  const btnRandData = document.getElementById('btn-rand-data');
  btnRandData?.addEventListener('click', () => {
    const newData = [];
    // Generate 40 typical values (ranging from 10 to 90)
    for (let i = 0; i < 40; i++) {
      newData.push(Math.floor(10 + Math.random() * 81));
    }
    // Generate 10 extreme outliers (ranging from 150 to 500)
    for (let i = 0; i < 10; i++) {
      newData.push(Math.floor(150 + Math.random() * 351));
    }
    RAW_POCKET_DATA = newData.sort((a, b) => a - b);
    calculateC2();
  });

  function calculateC2() {
    let data = [...RAW_POCKET_DATA];
    const n = data.length;

    // Percentile helper
    const getP = (arr, p) => {
      const idx = (p / 100) * (arr.length - 1);
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
    };

    const q1 = getP(data, 25);
    const q3 = getP(data, 75);
    const iqr = q3 - q1;

    // Standard Deviation helper
    const getStats = (arr) => {
      const sum = arr.reduce((a, b) => a + b, 0);
      const mean = sum / arr.length;
      const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
      return { mean, sd: Math.sqrt(variance) };
    };

    const originalStats = getStats(data);

    if (c2OutlierMethod === 'iqr') {
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      data = data.filter(v => v >= lower && v <= upper);
    } else if (c2OutlierMethod === 'sd') {
      const lower = originalStats.mean - 2 * originalStats.sd;
      const upper = originalStats.mean + 2 * originalStats.sd;
      data = data.filter(v => v >= lower && v <= upper);
    }

    // Final Statistics
    const finalStats = getStats(data);
    const mid = Math.floor(data.length / 2);
    const median = data.length % 2 === 0 ? (data[mid - 1] + data[mid]) / 2 : data[mid];

    // Mode
    const freq = {};
    let maxF = 0, mode = data[0];
    data.forEach(v => {
      freq[v] = (freq[v] || 0) + 1;
      if (freq[v] > maxF) { maxF = freq[v]; mode = v; }
    });

    // Skewness
    const cubedDiffSum = data.reduce((s, v) => s + Math.pow(v - finalStats.mean, 3), 0);
    const skewness = finalStats.sd > 0 ? (cubedDiffSum / data.length) / Math.pow(finalStats.sd, 3) : 0;

    // Update labels
    document.getElementById('c2-stat-mean').textContent = `${finalStats.mean.toFixed(1)} 만원`;
    document.getElementById('c2-stat-median').textContent = `${median.toFixed(1)} 만원`;
    document.getElementById('c2-stat-mode').textContent = `${mode.toFixed(0)} 만원`;
    document.getElementById('c2-stat-skewness').textContent = skewness.toFixed(3);
    document.getElementById('c2-stat-count').textContent = `${data.length} / ${n}명`;

    // Sync to tab 4 labels
    const t4SkewLabel = document.getElementById('c4-skewness-val');
    if (t4SkewLabel) t4SkewLabel.textContent = skewness.toFixed(3);

    renderC2Chart(data, finalStats.mean, median, mode);
  }

  function renderC2Chart(data, mean, median, mode) {
    const ctx = document.getElementById('c2-chart-dist')?.getContext('2d');
    if (!ctx) return;

    const BIN = 30;
    const maxVal = Math.max(...RAW_POCKET_DATA);
    const bins = Array.from({ length: Math.ceil((maxVal + 1) / BIN) }, (_, i) => ({
      label: `${i * BIN}~${(i + 1) * BIN}만`,
      count: 0
    }));

    data.forEach(v => {
      const idx = Math.floor(v / BIN);
      if (bins[idx]) bins[idx].count++;
    });

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
        drawLine(mean,   'rgba(239,68,68,.9)');
        drawLine(median, 'rgba(59,130,246,.9)');
        drawLine(mode,   'rgba(16,185,129,.9)');
      }
    };

    if (c2ChartInstance) c2ChartInstance.destroy();

    c2ChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bins.map(b => b.label),
        datasets: [{
          label: '인원수',
          data: bins.map(b => b.count),
          backgroundColor: 'rgba(79, 70, 229, 0.72)',
          borderColor: 'rgb(79, 70, 229)',
          borderWidth: 1,
          barPercentage: 1.0,
          categoryPercentage: 1.0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 2 } }
        },
        plugins: { legend: { display: false } }
      },
      plugins: [linesPlugin]
    });
  }

  // ==========================================
  // [3차시] 비선형적 시계열 데이터 추세
  // ==========================================
  let c3Rate = 3.4;
  let c3Years = 20;
  let c3ChartInstance = null;

  const c3RateSlider = document.getElementById('c3-rate');
  const c3RateNum = document.getElementById('c3-rate-num');
  const c3YearsSlider = document.getElementById('c3-years');
  const c3YearsNum = document.getElementById('c3-years-num');

  c3RateSlider?.addEventListener('input', () => {
    const v = parseFloat(c3RateSlider.value) || 0;
    c3RateNum.value = v;
    c3Rate = v;
    calculateC3();
  });
  c3RateNum?.addEventListener('input', () => {
    const v = Math.max(0, Math.min(20, parseFloat(c3RateNum.value) || 0));
    c3RateSlider.value = v;
    c3Rate = v;
    calculateC3();
  });

  c3YearsSlider?.addEventListener('input', () => {
    const v = parseInt(c3YearsSlider.value) || 1;
    c3YearsNum.value = v;
    c3Years = v;
    calculateC3();
  });
  c3YearsNum?.addEventListener('input', () => {
    const v = Math.max(1, Math.min(50, parseInt(c3YearsNum.value) || 1));
    c3YearsSlider.value = v;
    c3Years = v;
    calculateC3();
  });

  // 3차시 랜덤 시뮬레이션 설정 버튼 핸들러
  const btnRandYears = document.getElementById('btn-rand-years');
  btnRandYears?.addEventListener('click', () => {
    const randR = (1.0 + Math.random() * 14.0).toFixed(1);
    const randN = Math.floor(5 + Math.random() * 41);

    if (c3RateSlider) c3RateSlider.value = randR;
    if (c3RateNum) c3RateNum.value = randR;
    c3Rate = parseFloat(randR);

    if (c3YearsSlider) c3YearsSlider.value = randN;
    if (c3YearsNum) c3YearsNum.value = randN;
    c3Years = randN;

    calculateC3();
  });

  function calculateC3() {
    const r = c3Rate / 100;
    const n = c3Years;

    const compound = Math.pow(1 + r, n);
    const accumulated = (compound - 1) * 100;
    const realValue = 100 / compound;

    document.getElementById('c3-accumulated-inflation').textContent = `${accumulated.toFixed(1)}%`;
    document.getElementById('c3-real-purchasing-power').textContent = `${realValue.toFixed(1)} 만원`;

    // Sync to tab 4 labels
    const t4YearsLabel = document.getElementById('c4-years-val');
    if (t4YearsLabel) t4YearsLabel.textContent = `${n}년`;

    renderC3Chart();
    calculateC4Scenarios();
  }

  function renderC3Chart() {
    const ctx = document.getElementById('c3-chart-power')?.getContext('2d');
    if (!ctx) return;

    const r = c3Rate / 100;
    const n = c3Years;
    const labels = [], comp = [], simp = [];

    for (let yr = 0; yr <= n; yr++) {
      labels.push(`${yr}년`);
      comp.push(100 / Math.pow(1 + r, yr));
      simp.push(100 / (1 + r * yr));
    }

    if (c3ChartInstance) c3ChartInstance.destroy();

    c3ChartInstance = new Chart(ctx, {
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
            pointRadius: n > 30 ? 0 : 3
          },
          {
            label: '단리 감쇄 (선형)',
            data: simp,
            borderColor: 'rgb(148,163,184)',
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0,
            pointRadius: n > 30 ? 0 : 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: { min: 0, max: 100 }
        }
      }
    });
  }

  // ==========================================
  // [4차시] 불확실성 데이터 기반 My-CPI
  // ==========================================
  let c4Sd = 1.5;

  const c4SdSlider = document.getElementById('c4-sd');
  const c4SdNum = document.getElementById('c4-sd-num');

  c4SdSlider?.addEventListener('input', () => {
    const v = parseFloat(c4SdSlider.value) || 0.1;
    c4SdNum.value = v;
    c4Sd = v;
    calculateC4Scenarios();
  });

  c4SdNum?.addEventListener('input', () => {
    const v = Math.max(0.1, Math.min(5.0, parseFloat(c4SdNum.value) || 0.1));
    c4SdSlider.value = v;
    c4Sd = v;
    calculateC4Scenarios();
  });

  // 4차시 랜덤 표준편차 설정 버튼 핸들러
  const btnRandSd = document.getElementById('btn-rand-sd');
  btnRandSd?.addEventListener('click', () => {
    const randSD = (0.5 + Math.random() * 3.5).toFixed(1);
    if (c4SdSlider) c4SdSlider.value = randSD;
    if (c4SdNum) c4SdNum.value = randSD;
    c4Sd = parseFloat(randSD);

    calculateC4Scenarios();
  });

  function calculateC4Scenarios() {
    // Read My-CPI dynamically calculated from Tab 1
    const myCpiText = document.getElementById('c1-my-val').textContent || '3.40%';
    const r = parseFloat(myCpiText.replace('%', '')) || 3.4;
    const n = c3Years;
    const sd = c4Sd;

    const calc = (rate) => (100 / Math.pow(1 + Math.max(0, rate) / 100, n)).toFixed(1);

    const optVal  = calc(r - 1.96 * sd);
    const expVal  = calc(r);
    const pesVal  = calc(r + 1.96 * sd);

    const optEl = document.getElementById('c4-scen-opt');
    const expEl = document.getElementById('c4-scen-exp');
    const pesEl = document.getElementById('c4-scen-pes');

    if (optEl) optEl.textContent = `${optVal} 만원`;
    if (expEl) expEl.textContent = `${expVal} 만원`;
    if (pesEl) pesEl.textContent = `${pesVal} 만원`;

    // Sync to summary details card
    const t4YearsValLabel = document.getElementById('c4-years-val');
    if (t4YearsValLabel) t4YearsValLabel.textContent = `${n}년`;

    // Also sync pension calculations if values change
    calculatePension();
  }

  // ==========================================
  // [Ⅲ. 연금 확장 모듈] 미래 생활비 및 필요자금 시뮬레이터
  // ==========================================
  let pensChartInstance = null;
  let pensPv = 200; // default 200만원
  let pensYears = 20; // default 20년

  const pensPvSlider = document.getElementById('pens-pv-expense');
  const pensPvNum = document.getElementById('pens-pv-expense-num');
  const pensYearsSlider = document.getElementById('pens-years');
  const pensYearsNum = document.getElementById('pens-years-num');

  pensPvSlider?.addEventListener('input', () => {
    pensPv = parseFloat(pensPvSlider.value) || 200;
    if (pensPvNum) pensPvNum.value = pensPv;
    calculatePension();
    renderPensionChart();
  });

  pensPvNum?.addEventListener('input', () => {
    pensPv = Math.max(50, Math.min(1000, parseFloat(pensPvNum.value) || 200));
    if (pensPvSlider) pensPvSlider.value = pensPv;
    calculatePension();
    renderPensionChart();
  });

  pensYearsSlider?.addEventListener('input', () => {
    pensYears = parseInt(pensYearsSlider.value) || 20;
    if (pensYearsNum) pensYearsNum.value = pensYears;
    calculatePension();
    renderPensionChart();
  });

  pensYearsNum?.addEventListener('input', () => {
    pensYears = Math.max(1, Math.min(50, parseInt(pensYearsNum.value) || 20));
    if (pensYearsSlider) pensYearsSlider.value = pensYears;
    calculatePension();
    renderPensionChart();
  });

  function getPensionScenarios() {
    const myCpiText = document.getElementById('c1-my-val')?.textContent || '3.40%';
    const r = parseFloat(myCpiText.replace('%', '')) || 3.4;
    const sd = c4Sd || 1.5;

    const rOpt  = Math.max(0, r - 1.96 * sd);
    const rBase = r;
    const rPes  = r + 1.96 * sd;

    return { rOpt, rBase, rPes };
  }

  function calculatePension() {
    const { rOpt, rBase, rPes } = getPensionScenarios();

    // 1. Update Scenario Rates in labels
    const rOptEl = document.getElementById('pens-r-opt');
    const rBaseEl = document.getElementById('pens-r-base');
    const rPesEl = document.getElementById('pens-r-pes');

    if (rOptEl) rOptEl.textContent = `${rOpt.toFixed(2)}% (My-CPI - 1.96σ)`;
    if (rBaseEl) rBaseEl.textContent = `${rBase.toFixed(2)}% (My-CPI 기본)`;
    if (rPesEl) rPesEl.textContent = `${rPes.toFixed(2)}% (My-CPI + 1.96σ)`;

    // 2. Future Expense calculation: FV = PV * (1 + r)^n
    const n = pensYears;
    const pv = pensPv;

    const calcFv = (rate, yr) => pv * Math.pow(1 + rate / 100, yr);

    const fvOpt  = calcFv(rOpt, n);
    const fvBase = calcFv(rBase, n);
    const fvPes  = calcFv(rPes, n);

    // Update Result Cards
    const cardOptRate = document.getElementById('pens-card-opt-rate');
    const cardOptVal  = document.getElementById('pens-card-opt-val');
    const cardOptMul  = document.getElementById('pens-card-opt-mul');

    const cardBaseRate = document.getElementById('pens-card-base-rate');
    const cardBaseVal  = document.getElementById('pens-card-base-val');
    const cardBaseMul  = document.getElementById('pens-card-base-mul');

    const cardPesRate = document.getElementById('pens-card-pes-rate');
    const cardPesVal  = document.getElementById('pens-card-pes-val');
    const cardPesMul  = document.getElementById('pens-card-pes-mul');

    if (cardOptRate) cardOptRate.textContent = `물가상승률: ${rOpt.toFixed(2)}%`;
    if (cardOptVal)  cardOptVal.textContent  = `${Math.round(fvOpt).toLocaleString()} 만원/월`;
    if (cardOptMul)  cardOptMul.textContent  = `현재 대비 ${(fvOpt / pv).toFixed(2)}배`;

    if (cardBaseRate) cardBaseRate.textContent = `물가상승률: ${rBase.toFixed(2)}%`;
    if (cardBaseVal)  cardBaseVal.textContent  = `${Math.round(fvBase).toLocaleString()} 만원/월`;
    if (cardBaseMul)  cardBaseMul.textContent  = `현재 대비 ${(fvBase / pv).toFixed(2)}배`;

    if (cardPesRate) cardPesRate.textContent = `물가상승률: ${rPes.toFixed(2)}%`;
    if (cardPesVal)  cardPesVal.textContent  = `${Math.round(fvPes).toLocaleString()} 만원/월`;
    if (cardPesMul)  cardPesMul.textContent  = `현재 대비 ${(fvPes / pv).toFixed(2)}배`;

    // Update comparison table (0, 10, 20, 30 years)
    const setCell = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${Math.round(val).toLocaleString()} 만원`;
    };

    setCell('tbl-opt-0', pv);
    setCell('tbl-opt-10', calcFv(rOpt, 10));
    setCell('tbl-opt-20', calcFv(rOpt, 20));
    setCell('tbl-opt-30', calcFv(rOpt, 30));

    setCell('tbl-base-0', pv);
    setCell('tbl-base-10', calcFv(rBase, 10));
    setCell('tbl-base-20', calcFv(rBase, 20));
    setCell('tbl-base-30', calcFv(rBase, 30));

    setCell('tbl-pes-0', pv);
    setCell('tbl-pes-10', calcFv(rPes, 10));
    setCell('tbl-pes-20', calcFv(rPes, 20));
    setCell('tbl-pes-30', calcFv(rPes, 30));
  }

  function renderPensionChart() {
    const ctx = document.getElementById('pens-chart-expense')?.getContext('2d');
    if (!ctx) return;

    const { rOpt, rBase, rPes } = getPensionScenarios();
    const pv = pensPv;
    const n = Math.max(10, pensYears);

    const labels = [];
    const dataOpt = [];
    const dataBase = [];
    const dataPes = [];

    for (let yr = 0; yr <= n; yr += (n > 20 ? 5 : 2)) {
      labels.push(`${yr}년`);
      dataOpt.push(Math.round(pv * Math.pow(1 + rOpt / 100, yr)));
      dataBase.push(Math.round(pv * Math.pow(1 + rBase / 100, yr)));
      dataPes.push(Math.round(pv * Math.pow(1 + rPes / 100, yr)));
    }

    if (pensChartInstance) pensChartInstance.destroy();

    pensChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '🔴 높은 물가 시나리오',
            data: dataPes,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderWidth: 2.5,
            tension: 0.2
          },
          {
            label: '🔵 기준 물가 시나리오',
            data: dataBase,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            borderWidth: 2.5,
            tension: 0.2
          },
          {
            label: '🟢 낮은 물가 시나리오',
            data: dataOpt,
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderWidth: 2.5,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11 } }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: {
              callback: (v) => `${v}만`
            }
          }
        }
      }
    });
  }

  // Initial Triggers
  calculateC1();
  calculateC2();
  calculateC3();
  calculateC4Scenarios();
  renderC1Chart();
  calculatePension();

  // First typesetting on initial load
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    window.MathJax.typesetPromise();
  }
});
