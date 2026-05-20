/* ============================================================
   PULSE — Five Self-Checks
   Vanilla JS, no framework, no build.
   ============================================================ */

const panel = document.getElementById('panel');
const resetBtn = document.getElementById('reset');
const todayEl = document.getElementById('today');

/* ---------- Live header date ---------- */
function setToday() {
  const d = new Date();
  todayEl.textContent = d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase().replace(/\./g, '');
}
setToday();

/* ---------- Audio cues (soft, optional) ---------- */
let audioCtx = null;
function tone(freq = 440, dur = 0.08, type = 'sine', gain = 0.04) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* ignore */ }
}

/* ---------- Routing ---------- */
const TESTS = {
  memory:    { num: '01', name: 'Memory',      sub: 'cognitive recall',     time: '~60s', render: renderMemory },
  reaction:  { num: '02', name: 'Reaction',    sub: 'response time',        time: '~45s', render: renderReaction },
  breath:    { num: '03', name: 'Breath',      sub: '4 — 7 — 8 pacer',      time: '~90s', render: renderBreath },
  bmi:       { num: '04', name: 'Composition', sub: 'BMI with context',     time: '~30s', render: renderBMI },
  stillness: { num: '05', name: 'Stillness',   sub: 'steadiness drill',     time: '~30s', render: renderStillness },
};

let currentTest = null;
let cleanup = () => {};

function loadTest(key) {
  cleanup && cleanup();
  cleanup = () => {};
  currentTest = key;

  // Sync the 3D scene's active hotspot when navigating from the panel
  window.body3d?.setActive(key);

  if (!key) { renderWelcome(); return; }

  const t = TESTS[key];
  panel.innerHTML = `
    <header class="panel-head">
      <p class="eyebrow">${t.num} — ${t.sub.toUpperCase()}</p>
      <h2>${t.name}.</h2>
      <p class="panel-sub" id="panel-sub"></p>
    </header>
    <div class="panel-body" id="panel-body"></div>
    <footer class="panel-foot">
      Pulse № 01  ·  Folio ${t.num}/05  ·  Self-check, not diagnostic
    </footer>
  `;
  t.render(document.getElementById('panel-body'), document.getElementById('panel-sub'));
}

// Expose so body3d.js can call this when a hotspot sphere is clicked
window.loadTest = loadTest;

resetBtn.addEventListener('click', () => { tone(440); loadTest(null); });

/* ============================================================
   WELCOME
   ============================================================ */
function renderWelcome() {
  panel.innerHTML = `
    <div class="welcome">
      <p class="eyebrow">Folio · Issue 01</p>
      <p class="number">05<em>.</em></p>
      <h2>Brief checks for<br>a long body.</h2>
      <p><span class="dropcap">F</span>ive small exercises that ask different questions of you: how well you remember a pattern, how quickly your hand finds a green light, how patiently you can let a breath leave your chest. Choose one. Or work through all of them in sequence — the whole set takes under five minutes.</p>

      <ol class="toc" id="toc">
        ${Object.entries(TESTS).map(([k, t]) => `
          <li data-test="${k}">
            <span class="toc__num">${t.num}</span>
            <span class="toc__name">${t.name}<span style="color:var(--ink-3); font-family:var(--sans); font-size:13px; margin-left:8px;">— ${t.sub}</span></span>
            <span class="toc__time">${t.time}</span>
          </li>
        `).join('')}
      </ol>

      <p style="font-family:var(--mono); font-size:11px; letter-spacing:0.1em; color:var(--ink-3); text-transform:uppercase; margin-top: 16px;">
        ↳ Tap a region on the figure, or pick a line above.
      </p>
    </div>
  `;
  document.querySelectorAll('#toc li').forEach(li => {
    li.addEventListener('click', () => loadTest(li.dataset.test));
  });
}

/* ============================================================
   01 · MEMORY  — Simon-style sequence recall
   ============================================================ */
function renderMemory(body, subEl) {
  subEl.textContent = 'Watch the sequence. Repeat it back. Each round adds one step.';
  body.innerHTML = `
    <div class="stats-row">
      <div class="stat"><span class="stat__label">Round</span><span class="stat__value" id="m-round">—</span></div>
      <div class="stat"><span class="stat__label">Length</span><span class="stat__value" id="m-len">—</span></div>
      <div class="stat"><span class="stat__label">Best</span><span class="stat__value" id="m-best"><em>0</em></span></div>
    </div>
    <div class="memory-grid">
      <button class="memory-tile" data-c="sage"  data-i="0">Sage</button>
      <button class="memory-tile" data-c="clay"  data-i="1">Clay</button>
      <button class="memory-tile" data-c="amber" data-i="2">Amber</button>
      <button class="memory-tile" data-c="stone" data-i="3">Stone</button>
    </div>
    <div id="m-status" class="result-block" style="display:none;"></div>
    <div class="actions">
      <button class="btn" id="m-start">Begin</button>
      <button class="btn btn--ghost" id="m-stop" style="display:none;">Stop</button>
    </div>
  `;

  const tiles = body.querySelectorAll('.memory-tile');
  const roundEl = body.querySelector('#m-round');
  const lenEl = body.querySelector('#m-len');
  const bestEl = body.querySelector('#m-best');
  const statusEl = body.querySelector('#m-status');
  const startBtn = body.querySelector('#m-start');
  const stopBtn = body.querySelector('#m-stop');

  let seq = [], input = [], round = 0, best = +(localStorage.getItem('pulse.memory.best') || 0);
  bestEl.innerHTML = `<em>${best}</em>`;

  let playing = false;

  function lightTile(i, ms = 380) {
    const tile = tiles[i];
    tile.classList.add('lit');
    const freqs = [330, 415, 494, 277];
    tone(freqs[i], 0.18, 'sine', 0.05);
    return new Promise(res => setTimeout(() => { tile.classList.remove('lit'); setTimeout(res, 120); }, ms));
  }

  async function playSeq() {
    setEnabled(false);
    await new Promise(r => setTimeout(r, 500));
    for (const i of seq) {
      await lightTile(i, 420);
    }
    setEnabled(true);
  }

  function setEnabled(on) {
    tiles.forEach(t => { t.disabled = !on; t.style.opacity = on ? 1 : 0.7; });
  }

  function nextRound() {
    round++;
    input = [];
    seq.push(Math.floor(Math.random() * 4));
    roundEl.innerHTML = round;
    lenEl.innerHTML = seq.length;
    statusEl.style.display = 'none';
    playSeq();
  }

  function fail() {
    playing = false;
    setEnabled(false);
    statusEl.style.display = 'block';
    const score = round - 1;
    if (score > best) {
      best = score;
      localStorage.setItem('pulse.memory.best', score);
      bestEl.innerHTML = `<em>${best}</em>`;
    }
    statusEl.innerHTML = `
      <h4>Round ${round}</h4>
      <p>You held <strong>${score}</strong> ${score === 1 ? 'step' : 'steps'} clean before missing. Working memory typically holds five to nine items — the variance is enormous. The point isn't the number; it's that you noticed where attention slipped.</p>
    `;
    startBtn.textContent = 'Try again';
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    tone(180, 0.3, 'sawtooth', 0.04);
  }

  function handleTile(e) {
    if (!playing) return;
    const i = +e.currentTarget.dataset.i;
    lightTile(i, 200);
    input.push(i);
    if (input[input.length - 1] !== seq[input.length - 1]) { fail(); return; }
    if (input.length === seq.length) {
      setEnabled(false);
      tone(880, 0.12, 'sine', 0.04);
      setTimeout(() => nextRound(), 700);
    }
  }
  tiles.forEach(t => t.addEventListener('click', handleTile));

  startBtn.addEventListener('click', () => {
    seq = []; input = []; round = 0;
    playing = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    nextRound();
  });
  stopBtn.addEventListener('click', () => fail());

  cleanup = () => { playing = false; };
}

/* ============================================================
   02 · REACTION  — Wait for green, 5 trials, show median
   ============================================================ */
function renderReaction(body, subEl) {
  subEl.textContent = 'Wait. The panel will turn sage. Click as fast as you can. Five trials.';
  body.innerHTML = `
    <div class="reaction-stage" id="r-stage">
      <div id="r-content" style="text-align:center;">
        <h3>Ready</h3>
        <p>Click anywhere to start</p>
      </div>
    </div>
    <div class="trials" id="r-trials">
      ${[1,2,3,4,5].map(n => `<div class="trial-dot" id="r-dot-${n-1}">${n}</div>`).join('')}
    </div>
    <div id="r-result" style="display:none;"></div>
  `;

  const stage = body.querySelector('#r-stage');
  const content = body.querySelector('#r-content');
  const result = body.querySelector('#r-result');
  const dots = body.querySelectorAll('.trial-dot');

  let state = 'idle';  // idle, wait, ready, done
  let trial = 0;
  let times = [];
  let goAt = 0;
  let timer = null;

  function setStage(cls, html) {
    stage.className = `reaction-stage reaction-stage--${cls}`;
    if (html != null) content.innerHTML = html;
  }

  function startTrial() {
    state = 'wait';
    setStage('wait', `<h3>Wait…</h3><p>Trial ${trial + 1} of 5</p>`);
    const delay = 900 + Math.random() * 2400;
    timer = setTimeout(() => {
      state = 'ready';
      goAt = performance.now();
      setStage('go', `<h3>NOW</h3><p>Click!</p>`);
      tone(660, 0.06);
    }, delay);
  }

  function recordTrial(ms) {
    times.push(ms);
    const dot = dots[trial];
    dot.classList.add('done');
    dot.textContent = `${Math.round(ms)}`;
    dot.style.fontSize = '8px';
    trial++;
    if (trial >= 5) { finish(); return; }
    setStage('result', `<div style="text-align:center;"><div class="ms">${Math.round(ms)}<span style="font-size:24px; color:var(--ink-3);"> ms</span></div><p style="color:var(--ink-3);">Click for next trial</p></div>`);
  }

  function falseStart() {
    clearTimeout(timer);
    setStage('early', `<h3>Too early</h3><p>Wait for the sage colour, then click</p>`);
    tone(150, 0.2, 'sawtooth', 0.05);
    const dot = dots[trial];
    dot.classList.add('fail');
    dot.textContent = '—';
    trial++;
    if (trial >= 5) { finish(); return; }
    state = 'cooldown';
    setTimeout(() => setStage('result', `<div style="text-align:center;"><h3 style="font-size:24px;">Click to continue</h3></div>`), 1200);
  }

  function finish() {
    state = 'done';
    const valid = times.filter(t => t > 0).sort((a, b) => a - b);
    const median = valid.length ? valid[Math.floor(valid.length / 2)] : null;
    const best = valid.length ? valid[0] : null;
    result.style.display = 'block';
    setStage('result', `<div style="text-align:center;"><div class="ms">${median ? Math.round(median) : '—'}<span style="font-size:24px; color:var(--ink-3);"> ms</span></div><p style="color:var(--ink-3);">Median</p></div>`);
    result.innerHTML = `
      <div class="stats-row" style="margin-bottom: 20px;">
        <div class="stat"><span class="stat__label">Median</span><span class="stat__value">${median ? Math.round(median) : '—'}<span style="font-size:18px; color:var(--ink-3);"> ms</span></span></div>
        <div class="stat"><span class="stat__label">Best</span><span class="stat__value"><em>${best ? Math.round(best) : '—'}</em><span style="font-size:18px; color:var(--ink-3);"> ms</span></span></div>
        <div class="stat"><span class="stat__label">Trials</span><span class="stat__value">${valid.length}/5</span></div>
      </div>
      <div class="result-block">
        <h4>What this is and isn't</h4>
        <p>Simple visual reaction times typically fall between 200 and 300 ms — but they vary with caffeine, sleep, screen latency, mouse vs touch, and whether you're warmed up. This number tells you almost nothing in isolation. Repeated over weeks at the same time of day, it can become a rough self-marker.</p>
      </div>
      <div class="actions" style="margin-top: 16px;">
        <button class="btn" id="r-again">Run again</button>
      </div>
    `;
    body.querySelector('#r-again').addEventListener('click', () => renderReaction(body, subEl));
  }

  function onClick() {
    if (state === 'idle' || state === 'cooldown') {
      if (trial >= 5) return;
      startTrial();
    } else if (state === 'wait') {
      falseStart();
    } else if (state === 'ready') {
      const ms = performance.now() - goAt;
      tone(880, 0.1);
      recordTrial(ms);
      state = 'idle';
    }
  }
  stage.addEventListener('click', onClick);

  cleanup = () => { clearTimeout(timer); };
}

/* ============================================================
   03 · BREATH  — 4-7-8 pacer with phase ring
   ============================================================ */
function renderBreath(body, subEl) {
  subEl.textContent = 'Inhale four, hold seven, exhale eight. Four cycles. Sit, soften the jaw, follow the ring.';
  body.innerHTML = `
    <div class="pacer">
      <div class="pacer__stage">
        <svg viewBox="0 0 260 260" style="position:absolute; inset:0;">
          <defs>
            <radialGradient id="petal" cx="50%" cy="50%">
              <stop offset="0%" stop-color="#5A7B6A" stop-opacity="0.18"/>
              <stop offset="60%" stop-color="#5A7B6A" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="#5A7B6A" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <circle id="bp-ring-out" cx="130" cy="130" r="120" fill="url(#petal)" stroke="#B8AE99" stroke-width="0.6" stroke-dasharray="2 4" style="transform-origin:center; transition: transform 4s cubic-bezier(0.4,0,0.2,1);"/>
          <circle id="bp-ring-mid" cx="130" cy="130" r="100" fill="none" stroke="#5A7B6A" stroke-width="1" opacity="0.5" style="transform-origin:center; transition: transform 4s cubic-bezier(0.4,0,0.2,1);"/>
          <circle id="bp-ring-in" cx="130" cy="130" r="70" fill="#3F5A4D" opacity="0.92" style="transform-origin:center; transition: transform 4s cubic-bezier(0.4,0,0.2,1), opacity 1s;"/>
          <circle id="bp-progress" cx="130" cy="130" r="118" fill="none" stroke="#1A1A1A" stroke-width="1.2" stroke-dasharray="741" stroke-dashoffset="741" transform="rotate(-90 130 130)" style="transition: stroke-dashoffset 1s linear;"/>
        </svg>
        <div class="pacer__text" style="color: var(--surface);">
          <div class="pacer__phase" id="bp-phase">Breathe</div>
          <div class="pacer__count" id="bp-count" style="color: var(--surface);">—</div>
        </div>
      </div>
      <div class="pacer__cycle" id="bp-cycle">Press start to begin</div>
      <div class="actions">
        <button class="btn" id="bp-start">Start</button>
        <button class="btn btn--ghost" id="bp-stop" style="display:none;">Stop</button>
      </div>
      <div id="bp-done" class="result-block" style="display:none;"></div>
    </div>
  `;

  const phaseEl = body.querySelector('#bp-phase');
  const countEl = body.querySelector('#bp-count');
  const cycleEl = body.querySelector('#bp-cycle');
  const ringOut = body.querySelector('#bp-ring-out');
  const ringMid = body.querySelector('#bp-ring-mid');
  const ringIn = body.querySelector('#bp-ring-in');
  const progress = body.querySelector('#bp-progress');
  const startBtn = body.querySelector('#bp-start');
  const stopBtn = body.querySelector('#bp-stop');
  const doneEl = body.querySelector('#bp-done');

  // 4-7-8 phases
  const phases = [
    { name: 'Inhale',  secs: 4, scale: 1.0, freq: 330 },
    { name: 'Hold',    secs: 7, scale: 1.0, freq: 0   },
    { name: 'Exhale',  secs: 8, scale: 0.55, freq: 220 },
    { name: 'Rest',    secs: 1, scale: 0.55, freq: 0   },
  ];
  const TOTAL_CYCLES = 4;

  let running = false;
  let interval = null;
  let timeout = null;

  function setScale(s) {
    ringOut.style.transform = `scale(${s})`;
    ringMid.style.transform = `scale(${s})`;
    ringIn.style.transform = `scale(${s})`;
    ringIn.style.opacity = s > 0.7 ? 0.92 : 0.7;
  }

  function runCycle(cycleIdx) {
    if (!running) return;
    if (cycleIdx >= TOTAL_CYCLES) { complete(); return; }
    cycleEl.textContent = `Cycle ${cycleIdx + 1} of ${TOTAL_CYCLES}`;
    runPhase(0, cycleIdx);
  }

  function runPhase(pIdx, cycleIdx) {
    if (!running) return;
    if (pIdx >= phases.length) { runCycle(cycleIdx + 1); return; }
    const p = phases[pIdx];
    phaseEl.textContent = p.name;
    setScale(p.scale);
    if (p.freq) tone(p.freq, 0.15, 'sine', 0.03);

    // Reset and animate the progress ring
    const totalSecs = p.secs;
    const CIRC = 741;
    progress.style.transition = 'none';
    progress.style.strokeDashoffset = CIRC;
    requestAnimationFrame(() => {
      progress.style.transition = `stroke-dashoffset ${totalSecs}s linear`;
      progress.style.strokeDashoffset = '0';
    });

    let remaining = p.secs;
    countEl.textContent = remaining;
    clearInterval(interval);
    interval = setInterval(() => {
      remaining--;
      countEl.textContent = remaining > 0 ? remaining : 0;
    }, 1000);

    timeout = setTimeout(() => {
      clearInterval(interval);
      runPhase(pIdx + 1, cycleIdx);
    }, p.secs * 1000);
  }

  function complete() {
    running = false;
    setScale(0.7);
    phaseEl.textContent = 'Done';
    countEl.textContent = '';
    cycleEl.textContent = 'Sit a moment longer if you like';
    progress.style.strokeDashoffset = 741;
    startBtn.style.display = 'inline-flex';
    startBtn.textContent = 'Run again';
    stopBtn.style.display = 'none';
    doneEl.style.display = 'block';
    doneEl.innerHTML = `
      <h4>Four cycles · 80 seconds</h4>
      <p>The 4-7-8 pattern, popularised by Andrew Weil, biases the breath toward the parasympathetic side — slower exhale than inhale. It's not a cure for anything. It's a small physical cue that says: pause. Useful before sleep, before a difficult conversation, before refreshing a price chart for the seventh time.</p>
    `;
  }

  function stop() {
    running = false;
    clearTimeout(timeout); clearInterval(interval);
    setScale(0.7);
    phaseEl.textContent = 'Breathe';
    countEl.textContent = '—';
    cycleEl.textContent = 'Stopped';
    progress.style.transition = 'none';
    progress.style.strokeDashoffset = 741;
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
  }

  startBtn.addEventListener('click', () => {
    running = true;
    doneEl.style.display = 'none';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    runCycle(0);
  });
  stopBtn.addEventListener('click', stop);

  cleanup = () => { running = false; clearTimeout(timeout); clearInterval(interval); };
}

/* ============================================================
   04 · COMPOSITION  — BMI with proper context
   ============================================================ */
function renderBMI(body, subEl) {
  subEl.textContent = 'Enter your height and weight. BMI is a screening number, not a diagnosis — read the note.';
  body.innerHTML = `
    <div style="display:flex; justify-content:flex-end; margin-bottom: -8px;">
      <div class="unit-toggle" id="bmi-units">
        <button class="on" data-u="metric">Metric</button>
        <button data-u="imperial">Imperial</button>
      </div>
    </div>
    <div class="field-row" id="bmi-metric">
      <div class="field">
        <label for="bmi-h">Height (cm)</label>
        <input id="bmi-h" type="number" inputmode="decimal" placeholder="175" min="80" max="250"/>
      </div>
      <div class="field">
        <label for="bmi-w">Weight (kg)</label>
        <input id="bmi-w" type="number" inputmode="decimal" placeholder="70" min="20" max="300"/>
      </div>
    </div>
    <div class="field-row" id="bmi-imperial" style="display:none;">
      <div class="field" style="grid-column: span 2; display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="field">
          <label for="bmi-ft">Height (ft)</label>
          <input id="bmi-ft" type="number" inputmode="decimal" placeholder="5" min="3" max="8"/>
        </div>
        <div class="field">
          <label for="bmi-in">(in)</label>
          <input id="bmi-in" type="number" inputmode="decimal" placeholder="9" min="0" max="11"/>
        </div>
      </div>
      <div class="field">
        <label for="bmi-lb">Weight (lb)</label>
        <input id="bmi-lb" type="number" inputmode="decimal" placeholder="155" min="50" max="600"/>
      </div>
    </div>

    <div class="stats-row" style="margin-top: 8px;">
      <div class="stat"><span class="stat__label">BMI</span><span class="stat__value" id="bmi-value">—</span></div>
      <div class="stat"><span class="stat__label">Band</span><span class="stat__value" id="bmi-band" style="font-size:24px; padding-top:8px;">—</span></div>
    </div>

    <div>
      <div class="bmi-scale">
        <span title="Under 18.5"></span>
        <span title="18.5 – 24.9"></span>
        <span title="25 – 29.9"></span>
        <span title="30+"></span>
      </div>
      <div class="bmi-marker"><div class="bmi-marker__needle" id="bmi-needle" style="left: 0%;"></div></div>
      <div class="bmi-scale-labels">
        <span>Under</span><span>18.5–25</span><span>25–30</span><span>30+</span>
      </div>
    </div>

    <div class="result-block">
      <h4>What BMI actually measures</h4>
      <p>BMI is mass divided by height squared. It was designed in the 19th century to study <strong>populations</strong>, not individuals. It can't tell muscle from fat, doesn't account for frame size or ethnicity, and gives bad readings for athletes, pregnant people, and most adults over sixty-five. Treat the number as one rough signal among many — waist measurement, energy levels, and how clothes fit will tell you more.</p>
    </div>
  `;

  const $ = (s) => body.querySelector(s);
  const valueEl = $('#bmi-value');
  const bandEl = $('#bmi-band');
  const needle = $('#bmi-needle');
  const metric = $('#bmi-metric');
  const imperial = $('#bmi-imperial');
  const toggle = $('#bmi-units');
  let unit = 'metric';

  function bandFor(bmi) {
    if (bmi < 18.5) return { name: 'Under', color: '#B5C8DB' };
    if (bmi < 25)   return { name: 'Typical', color: 'var(--sage-2)' };
    if (bmi < 30)   return { name: 'Over', color: 'var(--amber)' };
    return            { name: 'Obese', color: 'var(--clay)' };
  }

  function compute() {
    let h, w;
    if (unit === 'metric') {
      h = parseFloat($('#bmi-h').value);
      w = parseFloat($('#bmi-w').value);
      if (!h || !w) return reset();
      h = h / 100;
    } else {
      const ft = parseFloat($('#bmi-ft').value) || 0;
      const ins = parseFloat($('#bmi-in').value) || 0;
      const lb = parseFloat($('#bmi-lb').value);
      if ((!ft && !ins) || !lb) return reset();
      h = (ft * 12 + ins) * 0.0254;
      w = lb * 0.45359237;
    }
    const bmi = w / (h * h);
    if (!isFinite(bmi) || bmi <= 0) return reset();
    const band = bandFor(bmi);
    valueEl.innerHTML = `${bmi.toFixed(1)}`;
    bandEl.innerHTML = `<span style="color:${band.color}">●</span> ${band.name}`;
    // map bmi 12..40 → 0..100%
    const pct = Math.max(0, Math.min(100, ((bmi - 12) / (40 - 12)) * 100));
    needle.style.left = pct + '%';
  }
  function reset() {
    valueEl.textContent = '—';
    bandEl.textContent = '—';
    needle.style.left = '0%';
  }

  body.querySelectorAll('input').forEach(i => i.addEventListener('input', compute));
  toggle.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      toggle.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      unit = b.dataset.u;
      metric.style.display = unit === 'metric' ? 'grid' : 'none';
      imperial.style.display = unit === 'imperial' ? 'grid' : 'none';
      reset();
    });
  });

  cleanup = () => {};
}

/* ============================================================
   05 · STILLNESS  — Hold pointer in target for 30s
   ============================================================ */
function renderStillness(body, subEl) {
  subEl.textContent = 'Move your cursor (or fingertip) inside the ring. Hold it there, perfectly still, for 30 seconds.';
  body.innerHTML = `
    <div class="still-stage" id="s-stage">
      <div class="still-target" id="s-target"></div>
      <div class="still-info">
        <div class="ms" id="s-time">30.0</div>
        <div class="label" id="s-label">Move cursor into the ring</div>
      </div>
      <div class="still-progress" id="s-progress" style="width:0%;"></div>
    </div>
    <div id="s-result" style="display:none;"></div>
    <div class="actions" id="s-actions" style="display:none;">
      <button class="btn" id="s-retry">Run again</button>
    </div>
  `;

  const stage = body.querySelector('#s-stage');
  const target = body.querySelector('#s-target');
  const timeEl = body.querySelector('#s-time');
  const labelEl = body.querySelector('#s-label');
  const progress = body.querySelector('#s-progress');
  const result = body.querySelector('#s-result');
  const actions = body.querySelector('#s-actions');

  const DURATION = 30000; // ms
  let inside = false;
  let startAt = 0;
  let elapsed = 0;
  let drift = 0;
  let lastX = null, lastY = null;
  let rafId = null;
  let done = false;

  function isInsideTarget(x, y) {
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    return Math.hypot(x - cx, y - cy) < r;
  }

  function loop(t) {
    if (done) return;
    if (inside) {
      elapsed = t - startAt;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      progress.style.width = pct + '%';
      const remaining = Math.max(0, (DURATION - elapsed) / 1000);
      timeEl.textContent = remaining.toFixed(1);
      if (elapsed >= DURATION) { finish(true); return; }
    }
    rafId = requestAnimationFrame(loop);
  }

  function finish(success) {
    done = true;
    cancelAnimationFrame(rafId);
    stage.style.cursor = 'default';
    actions.style.display = 'flex';
    result.style.display = 'block';
    if (success) {
      labelEl.textContent = 'Complete';
      timeEl.textContent = '00.0';
      tone(880, 0.2);
      result.innerHTML = `
        <div class="result-block">
          <h4>Held the line</h4>
          <p>Thirty seconds of held attention, with a body that doesn't want to be still. Steadiness is a skill — not a personality trait. Useful in shooting, painting, surgery, and watching a chart open without doing anything about it. Total drift recorded: <strong>${drift.toFixed(0)} px</strong>.</p>
        </div>
      `;
    } else {
      labelEl.textContent = 'Broke contact';
      tone(180, 0.3, 'sawtooth', 0.04);
      result.innerHTML = `
        <div class="result-block">
          <h4>Lasted ${(elapsed / 1000).toFixed(1)} seconds</h4>
          <p>The cursor left the ring before the timer finished. Most people fail the first attempt — small jitters compound. Try again with shoulders down, elbow resting, breath slow.</p>
        </div>
      `;
    }
  }

  function onMove(e) {
    if (done) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x == null) return;
    const within = isInsideTarget(x, y);

    if (within) {
      target.classList.remove('still-target--out');
      target.classList.add('still-target--in');
      labelEl.textContent = 'Holding';
      if (!inside) {
        inside = true;
        startAt = performance.now() - elapsed;
        progress.classList.remove('broken');
        rafId = requestAnimationFrame(loop);
      }
      if (lastX != null) drift += Math.hypot(x - lastX, y - lastY);
      lastX = x; lastY = y;
    } else {
      if (inside) {
        // broke contact
        inside = false;
        cancelAnimationFrame(rafId);
        target.classList.remove('still-target--in');
        target.classList.add('still-target--out');
        progress.classList.add('broken');
        finish(false);
      } else {
        target.classList.remove('still-target--in', 'still-target--out');
      }
    }
  }
  stage.addEventListener('mousemove', onMove);
  stage.addEventListener('touchmove', onMove, { passive: true });
  stage.addEventListener('mouseleave', () => {
    if (inside && !done) { inside = false; finish(false); }
  });

  body.querySelector('#s-retry').addEventListener('click', () => renderStillness(body, subEl));

  cleanup = () => { cancelAnimationFrame(rafId); done = true; };
}

/* ============================================================
   INITIAL RENDER
   ============================================================ */
renderWelcome();
