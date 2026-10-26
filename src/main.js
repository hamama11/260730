import './style.css';
import { initSession1, session1State } from './session1.js';
import { initSession2, session2State } from './session2.js';
import { initSession3, session3State, syncRateFromSession1 } from './session3.js';
import { initSession4, session4State, updateReportData } from './session4.js';

document.addEventListener('DOMContentLoaded', () => {

  // ── 탭 전환 ─────────────────────────────────────────────
  const tabBtns    = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach(sec => {
        sec.id === target
          ? sec.classList.add('active')
          : sec.classList.remove('active');
      });

      // 3차 보고서 탭 진입 시 최신 데이터 동기화
      if (target === 'perf3') {
        updateReportData(session1State, session2State, session3State);
      }
    });
  });

  // ── Q 답변 바인딩 (1차·2차 수행평가) ───────────────────
  // session1/2/3 외부의 서술형 텍스트에어리어는 main에서 일괄 관리
  // 수업 페이지(index.html)에서 작성한 내용과 상호 연동(fallback)
  const qItems = [
    { ta: 'q1-1-answer', chars: 'q1-1-chars', classKey: 'c-q1-answer' },
    { ta: 'q1-2-answer', chars: 'q1-2-chars', classKey: 'c-q2-answer' },
    { ta: 'q2-1-answer', chars: 'q2-1-chars', classKey: 'c-q3-answer' },
    { ta: 'q2-2-answer', chars: 'q2-2-chars', classKey: 'c-q4-answer' },
  ];

  qItems.forEach(({ ta: taId, chars: charsId, classKey }) => {
    const ta    = document.getElementById(taId);
    const chars = document.getElementById(charsId);
    const lsKey = `mycpi_${taId}`;

    if (!ta) return;

    // 저장된 답변 복원 (수행평가 자체 저장값 우선, 없을 시 수업 페이지 작성값 자동 연동)
    const stored = localStorage.getItem(lsKey) || (classKey ? localStorage.getItem(classKey) : '') || '';
    ta.value = stored;
    if (chars) chars.textContent = stored.length;

    // 입력 시 localStorage 저장
    ta.addEventListener('input', () => {
      const v = ta.value;
      localStorage.setItem(lsKey, v);
      if (chars) chars.textContent = v.length;
    });
  });

  // 학생 성명 자동 동기화
  const studentNameInput = document.getElementById('global-student-name');
  if (studentNameInput) {
    const savedName = localStorage.getItem('mycpi_student_name') || '';
    studentNameInput.value = savedName;
    studentNameInput.addEventListener('input', () => {
      localStorage.setItem('mycpi_student_name', studentNameInput.value);
      const repName = document.getElementById('student-name');
      if (repName) repName.value = studentNameInput.value;
    });
  }

  // ── 상태 변경 콜백 ──────────────────────────────────────
  const handleS1Change = (s1) => {
    // My-CPI → Session3 자동 연동
    syncRateFromSession1(s1.myCpi);
    updateReportData(s1, session2State, session3State);
  };

  const handleS2Change = (s2) => {
    updateReportData(session1State, s2, session3State);
  };

  const handleS3Change = (s3) => {
    updateReportData(session1State, session2State, s3);
  };

  // ── 모듈 초기화 ─────────────────────────────────────────
  initSession1(handleS1Change);
  initSession2(handleS2Change);
  initSession3(handleS3Change);
  initSession4(() => {});

  // 초기 보고서 동기화
  updateReportData(session1State, session2State, session3State);
});
