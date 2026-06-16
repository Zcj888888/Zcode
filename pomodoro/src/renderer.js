const CIRCUMFERENCE = 2 * Math.PI * 90;

const PHASES = {
  work:       { duration: 25 * 60, label: '工作',   type: 'work' },
  shortBreak: { duration:  5 * 60, label: '短休息', type: 'break' },
  longBreak:  { duration: 15 * 60, label: '长休息', type: 'break' },
};

// State
let currentPhase = 'work';
let timeRemaining = PHASES.work.duration;
let isRunning = false;
let intervalId = null;
let pomodorosInCycle = 0;
let audioCtx = null;

// DOM
const timerDisplay   = document.getElementById('timer-display');
const ringProgress   = document.getElementById('ring-progress');
const phaseLabel     = document.getElementById('phase-label');
const pomodoroCount  = document.getElementById('pomodoro-count');
const btnStart       = document.getElementById('btn-start');
const iconPlay       = document.getElementById('icon-play');
const iconPause      = document.getElementById('icon-pause');
const btnReset       = document.getElementById('btn-reset');
const btnSkip        = document.getElementById('btn-skip');
const btnMinimize    = document.getElementById('btn-minimize');
const btnClose       = document.getElementById('btn-close');
const statsTodayCount = document.getElementById('stats-today-count');
const weekChart      = document.getElementById('week-chart');
const tabs           = document.querySelectorAll('.tab');
const pageTimer      = document.getElementById('page-timer');
const pageStats      = document.getElementById('page-stats');

// Ring setup
ringProgress.style.strokeDasharray = CIRCUMFERENCE;
ringProgress.style.strokeDashoffset = 0;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function advancePhase() {
  if (currentPhase === 'work') {
    pomodorosInCycle++;
    currentPhase = pomodorosInCycle >= 4 ? 'longBreak' : 'shortBreak';
  } else {
    if (currentPhase === 'longBreak') pomodorosInCycle = 0;
    currentPhase = 'work';
  }
  timeRemaining = PHASES[currentPhase].duration;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateDisplay() {
  timerDisplay.textContent = formatTime(timeRemaining);
  const phaseDuration = PHASES[currentPhase].duration;
  const progress = 1 - (timeRemaining / phaseDuration);
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const phaseConfig = PHASES[currentPhase];
  phaseLabel.textContent = phaseConfig.label;

  const isBreak = phaseConfig.type === 'break';
  phaseLabel.classList.toggle('break', isBreak);
  ringProgress.classList.toggle('break', isBreak);

  pomodoroCount.textContent = `${pomodorosInCycle} / 4`;
}

function playSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) { /* ignore */ }
}

async function recordPomodoro() {
  const key = todayKey();
  const pomodoros = await window.pomodoro.storeGet('pomodoros') || {};
  pomodoros[key] = (pomodoros[key] || 0) + 1;
  await window.pomodoro.storeSet('pomodoros', pomodoros);
}

async function onPhaseComplete() {
  stopTimer();
  playSound();

  if (currentPhase === 'work') {
    await recordPomodoro();
    window.pomodoro.showNotification('番茄完成！', `已完成 ${pomodorosInCycle + 1} 个番茄，休息一下吧`);
  } else {
    window.pomodoro.showNotification('休息结束', '继续专注吧！');
  }

  window.pomodoro.flashWindow();
  advancePhase();
  updateDisplay();
  updateStats();
}

function tick() {
  if (timeRemaining <= 0) {
    onPhaseComplete();
    return;
  }
  timeRemaining--;
  updateDisplay();
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  iconPlay.style.display = 'none';
  iconPause.style.display = 'block';
  intervalId = setInterval(tick, 1000);
}

function stopTimer() {
  isRunning = false;
  iconPlay.style.display = 'block';
  iconPause.style.display = 'none';
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function resetTimer() {
  stopTimer();
  timeRemaining = PHASES[currentPhase].duration;
  updateDisplay();
}

function skipPhase() {
  stopTimer();
  if (currentPhase === 'work') recordPomodoro();
  advancePhase();
  updateDisplay();
  updateStats();
}

// Stats
async function updateStats() {
  const pomodoros = await window.pomodoro.storeGet('pomodoros') || {};
  const key = todayKey();
  statsTodayCount.textContent = pomodoros[key] || 0;
  drawWeekChart(pomodoros);
}

function drawWeekChart(pomodoros) {
  const canvas = weekChart;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 340 * dpr;
  canvas.height = 180 * dpr;
  ctx.scale(dpr, dpr);

  const W = 340, H = 180;
  const padL = 30, padB = 28, padT = 10, padR = 10;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const weekDates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - dayOfWeek + i);
    weekDates.push(d.toISOString().slice(0, 10));
  }

  const values = weekDates.map(d => pomodoros[d] || 0);
  const maxVal = Math.max(...values, 1);

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  ctx.clearRect(0, 0, W, H);

  const textColor = isDark ? '#98989d' : '#86868b';
  const barColor  = isDark ? '#ff453a' : '#ff3b30';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
  }

  // Bars
  const barWidth = chartW / 7 * 0.5;
  const gap = chartW / 7;
  const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  values.forEach((val, i) => {
    const x = padL + gap * i + (gap - barWidth) / 2;
    const barH = (val / maxVal) * chartH;
    const y = padT + chartH - barH;

    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
    ctx.fill();

    if (val > 0) {
      ctx.fillStyle = textColor;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(val, x + barWidth / 2, y - 4);
    }

    ctx.fillStyle = textColor;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabels[i], x + barWidth / 2, H - 8);
  });
}

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    pageTimer.classList.toggle('active', target === 'timer');
    pageStats.classList.toggle('active', target === 'stats');
    if (target === 'stats') updateStats();
  });
});

// Buttons
btnStart.addEventListener('click', () => {
  if (isRunning) stopTimer();
  else startTimer();
});
btnReset.addEventListener('click', resetTimer);
btnSkip.addEventListener('click', skipPhase);

// Window controls
btnMinimize.addEventListener('click', () => {
  window.pomodoro.minimizeWindow();
});
btnClose.addEventListener('click', () => {
  window.close();
});

// Init
updateDisplay();
updateStats();
