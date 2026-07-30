import { cpiCategories } from './session1.js';

const STORAGE_KEY = 'mycpi_s4_state';

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { sd: 1.5, studentName: '', q3Answer: '' };
  } catch { return { sd: 1.5, studentName: '', q3Answer: '' }; }
}

const saved = loadState();

export const session4State = {
  sd:          saved.sd,
  studentName: saved.studentName,
  q3Answer:    saved.q3Answer,
};

let onStateChangeCb = null;
let _s1 = null, _s2 = null, _s3 = null;

// ── 초기화 ────────────────────────────────────────────────────
export function initSession4(onStateChange) {
  onStateChangeCb = onStateChange;

  // σ 슬라이더
  const sdSlider = document.getElementById('uncertainty-sd');
  const sdNum    = document.getElementById('uncertainty-sd-num');
  if (sdSlider) sdSlider.value = session4State.sd;
  if (sdNum)    sdNum.value    = session4State.sd;

  sdSlider?.addEventListener('input', () => {
    const v = clamp(parseFloat(sdSlider.value) || 0.1, 0.1, 5.0);
    sdNum.value = v;
    session4State.sd = v;
    saveState();
    updateScenarios();
  });
  sdNum?.addEventListener('input', () => {
    const v = clamp(parseFloat(sdNum.value) || 0.1, 0.1, 5.0);
    sdSlider.value = v;
    session4State.sd = v;
    saveState();
    updateScenarios();
  });

  // 성명 입력
  const nameInput = document.getElementById('student-name');
  if (nameInput) {
    nameInput.value = session4State.studentName;
    nameInput.addEventListener('input', e => {
      session4State.studentName = e.target.value;
      saveState();
    });
  }

  // Q3 답변
  bindAnswer('q3-answer', 'q3-chars', 'rep-q3', 'q3Answer');

  // 인쇄 버튼
  document.getElementById('btn-export-pdf')?.addEventListener('click', () => window.print());

  // 오늘 날짜
  const dateEl = document.getElementById('report-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── 보고서 데이터 갱신 (main.js에서 호출) ──────────────────
export function updateReportData(s1State, s2State, s3State) {
  _s1 = s1State; _s2 = s2State; _s3 = s3State;

  // ① 가중치 표
  const tbody = document.getElementById('report-weight-tbody');
  if (tbody && _s1) {
    const sumW = Object.values(_s1.weights).reduce((a, b) => a + b, 0);
    tbody.innerHTML = cpiCategories.map(cat => {
      const w    = _s1.weights[cat.id] || 0;
      const a    = cat.officialWeight;
      const diff = (w - a).toFixed(1);
      const contrib = sumW > 0 ? ((w / sumW) * cat.inflation).toFixed(3) : '0.000';
      return `<tr>
        <td>${cat.name}</td>
        <td class="auto-fill" style="text-align:right;">${a.toFixed(1)}%</td>
        <td class="auto-fill" style="text-align:right;">${w.toFixed(1)}%</td>
        <td class="auto-fill" style="text-align:right;${parseFloat(diff) > 0 ? 'color:#b45309' : parseFloat(diff) < 0 ? 'color:#1d4ed8' : ''}">${parseFloat(diff) >= 0 ? '+' : ''}${diff}%p</td>
        <td class="auto-fill" style="text-align:right;">${cat.inflation.toFixed(1)}%</td>
        <td class="auto-fill" style="text-align:right;">${contrib}%</td>
      </tr>`;
    }).join('');

    const sumW2 = Object.values(_s1.weights).reduce((a, b) => a + b, 0);
    elText('rep-total-w',   `${sumW2.toFixed(1)}%`);
    elText('rep-my-cpi',    `${_s1.myCpi.toFixed(2)}%`);
    elText('rep-my-cpi-2',  `${_s1.myCpi.toFixed(2)}%`);
    elText('rep-official-cpi', `${_s1.officialCpi.toFixed(2)}%`);
    elText('rep-simple-cpi',   `${_s1.simpleAverageCpi.toFixed(2)}%`);
  }

  // ② 왜곡도/이상치 요약
  if (_s2) {
    const sNone = _s2.statsAll?.none;
    const sIqr  = _s2.statsAll?.iqr;
    if (sNone) {
      elText('rep-raw-mean',   `${sNone.mean.toFixed(1)} 만원`);
      elText('rep-raw-median', `${sNone.median.toFixed(1)} 만원`);
      elText('rep-raw-skew',   sNone.skewness.toFixed(3));
      elText('rep-iqr-upper',  `${sNone.upperIQR.toFixed(1)} 만원`);
    }
    if (sIqr) {
      elText('rep-iqr-mean',   `${sIqr.mean.toFixed(1)} 만원`);
      elText('rep-iqr-median', `${sIqr.median.toFixed(1)} 만원`);
    }
  }

  // ③ 비선형 시뮬레이션 요약
  if (_s3) {
    elText('rep-sim-rate',  `${_s3.rate.toFixed(1)}%`);
    elText('rep-sim-years', `${_s3.years}년`);
    // 20년 기준
    const r20 = _s3.rate / 100;
    elText('rep-real-20', `${(100 / Math.pow(1 + r20, 20)).toFixed(1)} 만원`);
    elText('rep-sigma',   `${session4State.sd.toFixed(1)}%`);
  }

  // ④ Q 답변 미리보기 (localStorage에서)
  elPreview('rep-q1-1', localStorage.getItem('mycpi_q1-1-answer'));
  elPreview('rep-q1-2', localStorage.getItem('mycpi_q1-2-answer'));
  elPreview('rep-q2-1', localStorage.getItem('mycpi_q2-1-answer'));
  elPreview('rep-q2-2', localStorage.getItem('mycpi_q2-2-answer'));

  updateScenarios();
}

// ── 불확실성 시나리오 계산 ───────────────────────────────────
function updateScenarios() {
  if (!_s1) return;
  const r  = _s1.myCpi;
  const n  = _s3?.years || 20;
  const sd = session4State.sd;

  const calc = (rate) => (100 / Math.pow(1 + Math.max(0, rate) / 100, n)).toFixed(1);

  const optVal  = calc(r - 1.96 * sd);
  const expVal  = calc(r);
  const pesVal  = calc(r + 1.96 * sd);

  elText('scen-opt', `${optVal} 만원`);
  elText('scen-exp', `${expVal} 만원`);
  elText('scen-pes', `${pesVal} 만원`);
  elText('rep-opt',  `${optVal} 만원`);
  elText('rep-pes',  `${pesVal} 만원`);
  elText('rep-sigma', `${sd.toFixed(1)}%`);
}

// ── Q 답변 바인딩 (localStorage 자동 저장) ──────────────────
function bindAnswer(textareaId, charsId, previewId, stateKey) {
  const ta      = document.getElementById(textareaId);
  const charsEl = document.getElementById(charsId);
  const preview = document.getElementById(previewId);
  const lsKey   = `mycpi_${textareaId}`;

  if (!ta) return;

  // 복원
  const stored = localStorage.getItem(lsKey) || session4State[stateKey] || '';
  ta.value = stored;
  if (charsEl) charsEl.textContent = stored.length;
  if (preview) preview.textContent = stored || '입력한 답변이 여기에 표시됩니다.';

  ta.addEventListener('input', () => {
    const v = ta.value;
    session4State[stateKey] = v;
    localStorage.setItem(lsKey, v);
    if (charsEl) charsEl.textContent = v.length;
    if (preview) preview.textContent = v || '입력한 답변이 여기에 표시됩니다.';
    saveState();
    if (onStateChangeCb) onStateChangeCb(session4State);
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    sd:          session4State.sd,
    studentName: session4State.studentName,
    q3Answer:    session4State.q3Answer,
  }));
}

// ── 헬퍼 ────────────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function elText(id, val) { const e = document.getElementById(id); if (e) e.textContent = val ?? '—'; }
function elPreview(id, val) {
  const e = document.getElementById(id);
  if (e) e.textContent = val && val.trim() ? val : '(미작성)';
}
