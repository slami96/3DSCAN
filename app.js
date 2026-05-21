/* ============================================================
   SOMA — app.js
   Test panel logic. Results call window.soma.setResult()
   which drives GLSL shader effects in real time.
   ============================================================ */

const panel      = document.getElementById('panel');
const resetBtn   = document.getElementById('reset');
const manifestEl = document.getElementById('manifest');

/* ---- Session clock ---- */
const clockEl = document.getElementById('session-clock');
const clockStart = Date.now();
setInterval(() => {
  const s = Math.floor((Date.now() - clockStart) / 1000);
  clockEl.textContent = `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}, 1000);

/* ---- Date stamp ---- */
const d = new Date();
if (clockEl) clockEl.title = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();

/* ---- Session state ---- */
const SESSION = { memory: null, breath: null, bmi: null, reaction: null, stillness: null };
function markDone(id) {
  SESSION[id] = true;
  manifestEl?.querySelectorAll('.manifest__dot').forEach(dot => {
    if (dot.dataset.test === id) dot.classList.add('done');
  });
}
function setActiveManifest(id) {
  manifestEl?.querySelectorAll('.manifest__dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.test === id && !SESSION[id]);
  });
}

/* ---- Animated number counter ---- */
function countUp(el, from, to, dur = 1100, suffix = '') {
  const t0 = performance.now();
  function tick() {
    const t = Math.min(1, (performance.now() - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * e) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  tick();
}

/* ---- Web audio cues ---- */
let ctx;
function beep(freq = 440, dur = 0.1, type = 'sine', vol = 0.04) {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
  } catch {}
}

/* ---- Routing ---- */
let cleanup = () => {};
let currentTest = null;

const TESTS = {
  memory:    { n: '01', sub: 'Cognitive Recall',    time: '~60s', fn: renderMemory    },
  breath:    { n: '02', sub: 'Breath Pacer',        time: '~80s', fn: renderBreath    },
  bmi:       { n: '03', sub: 'Body Composition',    time: '~20s', fn: renderBMI       },
  reaction:  { n: '04', sub: 'Reaction Time',       time: '~45s', fn: renderReaction  },
  stillness: { n: '05', sub: 'Stillness Drill',     time: '~30s', fn: renderStillness },
};

function loadTest(id) {
  cleanup();
  cleanup = () => {};
  currentTest = id;

  window.soma?.setActive(id);
  setActiveManifest(id);

  if (!id) { renderHome(); return; }
  const t = TESTS[id];
  panel.innerHTML = `
    <header class="ph">
      <p class="ph__eye">${t.n} — ${t.sub.toUpperCase()}</p>
      <h2 class="ph__h" id="ph-h">${t.sub.split(' ')[0]}.</h2>
      <p class="ph__sub" id="ph-sub"></p>
    </header>
    <div class="pb" id="pb"></div>
    <footer class="pf">SOMA · Check ${t.n}/05 · ${t.time} · Self-check, not diagnostic</footer>
  `;
  t.fn(document.getElementById('pb'), document.getElementById('ph-sub'));
}

window.loadTest = loadTest;
resetBtn?.addEventListener('click', () => {
  beep(330); loadTest(null); window.soma?.clearActive?.();
});

/* manifest dot click → navigate */
manifestEl?.querySelectorAll('.manifest__dot').forEach(d => {
  d.style.cursor = 'pointer';
  d.addEventListener('click', () => { beep(550); loadTest(d.dataset.test); });
});

/* ============================================================
   HOME
   ============================================================ */
function renderHome() {
  panel.innerHTML = `
    <div class="home">
      <p class="ph__eye">SOMA · BIOMETRIC CANVAS</p>
      <p class="home__num">05</p>
      <h2 class="home__h">Results written<br>on the body.</h2>
      <p class="home__p">Complete each check. Watch the model respond — every result paints a living effect directly onto the 3D surface. Drag to orbit while a test runs and see it update in real time.</p>
      <ol class="toc" id="toc">
        ${Object.entries(TESTS).map(([k, t]) => `
          <li data-id="${k}" class="${SESSION[k] ? 'done' : ''}">
            <span class="toc__n">${t.n}</span>
            <span class="toc__name">${t.sub}</span>
            <span class="toc__time">${t.time}</span>
          </li>`).join('')}
      </ol>
    </div>
  `;
  document.querySelectorAll('#toc li').forEach(li =>
    li.addEventListener('click', () => { beep(550); loadTest(li.dataset.id); })
  );
}

/* ============================================================
   01 · MEMORY — Simon + live neural shader feedback
   ============================================================ */
function renderMemory(body, sub) {
  sub.textContent = 'Watch the sequence. Repeat it back. Score drives neural density on the model.';
  body.innerHTML = `
    <div class="stats">
      <div><div class="stat__lbl">Round</div><div class="stat__val" id="m-round">—</div></div>
      <div><div class="stat__lbl">Length</div><div class="stat__val scan" id="m-len">—</div></div>
      <div><div class="stat__lbl">Best</div><div class="stat__val" id="m-best"><em id="m-best-n">${localStorage.getItem('soma.mem.best') ?? 0}</em></div></div>
    </div>
    <div class="tiles">
      <button class="tile" data-c="0" data-i="0">Forest</button>
      <button class="tile" data-c="1" data-i="1">Ember</button>
      <button class="tile" data-c="2" data-i="2">Arctic</button>
      <button class="tile" data-c="3" data-i="3">Dusk</button>
    </div>
    <div id="m-status" class="note" style="display:none;"></div>
    <div class="actions">
      <button class="btn btn--primary" id="m-go">Begin sequence</button>
      <button class="btn btn--ghost" id="m-stop" style="display:none;">Stop</button>
    </div>`;

  const tiles    = [...body.querySelectorAll('.tile')];
  const roundEl  = body.querySelector('#m-round');
  const lenEl    = body.querySelector('#m-len');
  const bestEl   = body.querySelector('#m-best-n');
  const statusEl = body.querySelector('#m-status');
  const goBtn    = body.querySelector('#m-go');
  const stopBtn  = body.querySelector('#m-stop');

  let seq = [], input = [], round = 0, best = +(localStorage.getItem('soma.mem.best') || 0), running = false;

  function lightTile(i, ms = 400) {
    tiles[i].classList.add('lit');
    beep([330, 415, 494, 277][i], 0.18, 'sine', 0.045);
    return new Promise(r => setTimeout(() => { tiles[i].classList.remove('lit'); setTimeout(r, 100); }, ms));
  }

  function setEnabled(on) { tiles.forEach(t => { t.disabled = !on; t.style.opacity = on ? '1' : '0.55'; }); }

  async function playSeq() {
    setEnabled(false);
    await new Promise(r => setTimeout(r, 500));
    for (const i of seq) await lightTile(i, 420);
    setEnabled(true);
  }

  function nextRound() {
    round++; input = [];
    seq.push(Math.floor(Math.random() * 4));
    roundEl.textContent = round;
    lenEl.textContent   = seq.length;
    statusEl.style.display = 'none';
    // push score to shader
    window.soma?.setResult('memory', { level: round });
    playSeq();
  }

  function fail() {
    running = false;
    setEnabled(false);
    const score = round - 1;
    if (score > best) {
      best = score;
      localStorage.setItem('soma.mem.best', score);
      bestEl.textContent = score;
    }
    window.soma?.setResult('memory', { level: score });
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div class="note__lbl">Round ${round}</div>
      <p>Recalled <strong>${score}</strong> clean ${score === 1 ? 'step' : 'steps'}. The neural glow on the model reflects your depth of recall — denser means further you went.</p>`;
    goBtn.textContent = 'Try again'; goBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    beep(160, 0.3, 'sawtooth', 0.035);
    if (score >= 4) markDone('memory');
  }

  tiles.forEach(t => t.addEventListener('click', () => {
    if (!running) return;
    const i = +t.dataset.i;
    lightTile(i, 200); input.push(i);
    if (input[input.length - 1] !== seq[input.length - 1]) { fail(); return; }
    if (input.length === seq.length) {
      setEnabled(false);
      beep(880, 0.12);
      window.soma?.setResult('memory', { level: round + 1 });
      setTimeout(() => nextRound(), 650);
    }
  }));

  goBtn.addEventListener('click', () => {
    seq = []; input = []; round = 0; running = true;
    goBtn.style.display = 'none'; stopBtn.style.display = 'inline-flex';
    nextRound();
  });
  stopBtn.addEventListener('click', () => fail());
  cleanup = () => { running = false; };
}

/* ============================================================
   02 · BREATH — 4-7-8 pacer, phase drives circulation shader
   ============================================================ */
function renderBreath(body, sub) {
  sub.textContent = 'Inhale 4 — hold 7 — exhale 8. Four cycles. The chest circulation responds in real time.';

  const phases = [
    { name: 'Inhale',  s: 4, targetBreath: 1.0, freq: 330 },
    { name: 'Hold',    s: 7, targetBreath: 1.0, freq: 0   },
    { name: 'Exhale',  s: 8, targetBreath: 0.0, freq: 220 },
    { name: 'Rest',    s: 1, targetBreath: 0.0, freq: 0   },
  ];
  const CYCLES = 4;
  const CIRC   = 2 * Math.PI * 118; // circumference of progress ring r=118

  body.innerHTML = `
    <div class="pacer">
      <div class="pacer__stage">
        <svg class="pacer__svg" viewBox="0 0 260 260">
          <!-- Outer atmospheric rings -->
          <circle cx="130" cy="130" r="120" fill="none" stroke="rgba(255,122,42,0.07)" stroke-width="0.6" stroke-dasharray="2 4"/>
          <circle cx="130" cy="130" r="100" fill="none" stroke="rgba(255,122,42,0.05)" stroke-width="0.6"/>
          <!-- Breathing core -->
          <circle id="bp-core" cx="130" cy="130" r="70" fill="rgba(26,10,4,0.9)" stroke="rgba(255,122,42,0.2)" stroke-width="0.8"
            style="transform-origin:center; transition:transform 4s cubic-bezier(0.4,0,0.2,1), stroke 1s;"/>
          <!-- Phase progress arc -->
          <circle id="bp-arc" cx="130" cy="130" r="90" fill="none" stroke="var(--ember)" stroke-width="1.5"
            stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" stroke-linecap="round"
            transform="rotate(-90 130 130)" style="transition:stroke-dashoffset 1s linear;"/>
        </svg>
        <div class="pacer__text">
          <div class="pacer__phase" id="bp-phase">Ready</div>
          <div class="pacer__count" id="bp-count">—</div>
        </div>
      </div>
      <div class="pacer__cyc" id="bp-cyc">Press start to begin</div>
      <div class="actions">
        <button class="btn btn--primary" id="bp-start">Start pacer</button>
        <button class="btn btn--ghost"   id="bp-stop" style="display:none;">Stop</button>
      </div>
      <div id="bp-done" class="note" style="display:none;"></div>
    </div>`;

  const phaseEl = body.querySelector('#bp-phase');
  const countEl = body.querySelector('#bp-count');
  const cycEl   = body.querySelector('#bp-cyc');
  const core    = body.querySelector('#bp-core');
  const arc     = body.querySelector('#bp-arc');
  const startB  = body.querySelector('#bp-start');
  const stopB   = body.querySelector('#bp-stop');
  const doneEl  = body.querySelector('#bp-done');

  let running = false, ival = null, tout = null;

  function setCore(big) {
    core.style.transform = big ? 'scale(1)' : 'scale(0.52)';
    core.style.stroke    = big ? 'rgba(255,122,42,0.65)' : 'rgba(255,122,42,0.2)';
  }

  function runPhase(pi, ci) {
    if (!running) return;
    if (pi >= phases.length) { runCycle(ci + 1); return; }
    if (ci >= CYCLES)        { complete(); return; }
    const ph = phases[pi];
    phaseEl.textContent = ph.name;
    if (ph.freq) beep(ph.freq, 0.12, 'sine', 0.03);

    setCore(ph.targetBreath > 0.5);
    window.soma?.setResult('breath', { phase: ph.targetBreath });

    // Phase arc
    arc.style.transition = 'none';
    arc.style.strokeDashoffset = CIRC;
    requestAnimationFrame(() => {
      arc.style.transition = `stroke-dashoffset ${ph.s}s linear`;
      arc.style.strokeDashoffset = '0';
    });

    let r = ph.s; countEl.textContent = r;
    clearInterval(ival);
    ival = setInterval(() => { r--; countEl.textContent = Math.max(0, r); }, 1000);
    tout = setTimeout(() => { clearInterval(ival); runPhase(pi + 1, ci); }, ph.s * 1000);
  }

  function runCycle(ci) {
    if (!running) return;
    if (ci >= CYCLES) { complete(); return; }
    cycEl.textContent = `Cycle ${ci + 1} of ${CYCLES}`;
    runPhase(0, ci);
  }

  function complete() {
    running = false;
    setCore(false);
    phaseEl.textContent = 'Complete'; countEl.textContent = '';
    cycEl.textContent = 'Take your time before moving on';
    window.soma?.setResult('breath', { phase: 0.6 });
    startB.style.display = 'inline-flex'; startB.textContent = 'Run again';
    stopB.style.display = 'none';
    doneEl.style.display = 'block';
    doneEl.innerHTML = `<div class="note__lbl">80 seconds · 4 cycles</div>
      <p>The circulation rings on the chest are now active. They follow the breath you just set: the wave speed and intensity encode the phase cadence. 4-7-8 biases the nervous system toward parasympathetic mode — observe the shift in your body while orbiting the model.</p>`;
    markDone('breath');
    beep(660, 0.2);
  }

  function stop() {
    running = false;
    clearTimeout(tout); clearInterval(ival);
    setCore(false);
    arc.style.transition = 'none'; arc.style.strokeDashoffset = CIRC;
    phaseEl.textContent = 'Stopped'; countEl.textContent = '—';
    startB.style.display = 'inline-flex'; stopB.style.display = 'none';
    window.soma?.setResult('breath', { phase: 0 });
  }

  startB.addEventListener('click', () => {
    running = true;
    doneEl.style.display = 'none';
    startB.style.display = 'none'; stopB.style.display = 'inline-flex';
    runCycle(0);
  });
  stopB.addEventListener('click', stop);
  cleanup = () => { running = false; clearTimeout(tout); clearInterval(ival); };
}

/* ============================================================
   03 · BMI — live needle + chromatic band on body
   ============================================================ */
function renderBMI(body, sub) {
  sub.textContent = 'Enter measurements. The colour band appears on the abdomen at the correct anatomical height.';
  body.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:-4px;">
      <div class="units" id="bmi-u">
        <button class="on" data-u="metric">Metric</button>
        <button data-u="imperial">Imperial</button>
      </div>
    </div>
    <div class="fields" id="bmi-metric">
      <div class="field"><label for="bmi-h">Height (cm)</label><input id="bmi-h" type="number" placeholder="175" min="80" max="250" inputmode="decimal"/></div>
      <div class="field"><label for="bmi-w">Weight (kg)</label><input id="bmi-w" type="number" placeholder="70" min="20" max="300" inputmode="decimal"/></div>
    </div>
    <div class="fields" id="bmi-imp" style="display:none;">
      <div class="field"><label for="bmi-ft">Height (ft)</label><input id="bmi-ft" type="number" placeholder="5" min="3" max="8" inputmode="decimal"/></div>
      <div class="field"><label for="bmi-in">Inches</label><input id="bmi-in" type="number" placeholder="9" min="0" max="11" inputmode="decimal"/></div>
      <div class="field"><label for="bmi-lb">Weight (lb)</label><input id="bmi-lb" type="number" placeholder="155" min="50" max="600" inputmode="decimal"/></div>
    </div>
    <div class="stats">
      <div><div class="stat__lbl">BMI</div><div class="stat__val scan" id="bmi-val">—</div></div>
      <div><div class="stat__lbl">Band</div><div class="stat__val" id="bmi-band" style="font-size:22px;padding-top:12px;">—</div></div>
    </div>
    <div>
      <div class="bmi-scale"><span></span><span></span><span></span><span></span></div>
      <div class="bmi-needle-row"><div class="bmi-needle" id="bmi-ndl" style="left:0%"></div></div>
      <div class="bmi-labels"><span>Under</span><span>18.5–25</span><span>25–30</span><span>30+</span></div>
    </div>
    <div class="note">
      <div class="note__lbl">Context</div>
      <p>BMI was designed to study <strong>populations</strong>, not individuals — it cannot distinguish fat from muscle, and gives misleading numbers for athletes, elderly adults, and many ethnic groups. The body band is a visual reference, not a health verdict.</p>
    </div>`;

  const $ = s => body.querySelector(s);
  const valEl   = $('#bmi-val'), bandEl = $('#bmi-band'), ndlEl = $('#bmi-ndl');
  const metricF = $('#bmi-metric'), impF = $('#bmi-imp');
  let unit = 'metric';

  function compute() {
    let h, w;
    if (unit === 'metric') {
      h = parseFloat($('#bmi-h').value); w = parseFloat($('#bmi-w').value);
      if (!h || !w) return reset();
      h /= 100;
    } else {
      const ft = parseFloat($('#bmi-ft').value) || 0;
      const ins = parseFloat($('#bmi-in').value) || 0;
      const lb  = parseFloat($('#bmi-lb').value);
      if ((!ft && !ins) || !lb) return reset();
      h = (ft * 12 + ins) * 0.0254; w = lb * 0.453592;
    }
    const bmi = w / (h * h);
    if (!isFinite(bmi) || bmi < 5) return reset();

    // Display
    countUp(valEl, 0, +bmi.toFixed(1), 800);

    const bands = [
      { max: 18.5, name: 'Under',   color: 'var(--arc)' },
      { max: 25,   name: 'Typical', color: 'var(--bio)' },
      { max: 30,   name: 'Over',    color: 'var(--band)' },
      { max: 999,  name: 'Obese',   color: 'var(--ember)' },
    ];
    const b = bands.find(x => bmi < x.max);
    bandEl.innerHTML = `<span style="color:${b.color}">●</span> ${b.name}`;

    // Needle: map bmi 13–40 → 0–100%
    const pct = Math.max(0, Math.min(100, ((bmi - 13) / 27) * 100));
    ndlEl.style.left = pct + '%';

    // Normalized for shader: -1 (under) .. 0 (typical 22) .. +1 (obese 35+)
    const norm = ((bmi - 22) / 10);
    window.soma?.setResult('bmi', { normalized: Math.max(-1, Math.min(1, norm)) });
    markDone('bmi');
  }

  function reset() {
    valEl.textContent = '—'; bandEl.textContent = '—'; ndlEl.style.left = '0%';
    window.soma?.setResult('bmi', { normalized: 0, bmiSet: false });
  }

  body.querySelectorAll('input').forEach(i => i.addEventListener('input', compute));
  $('#bmi-u').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#bmi-u').querySelectorAll('button').forEach(x => x.classList.remove('on'));
      btn.classList.add('on');
      unit = btn.dataset.u;
      metricF.style.display = unit === 'metric' ? 'grid' : 'none';
      impF.style.display    = unit === 'imperial' ? 'grid' : 'none';
      reset();
    });
  });
}

/* ============================================================
   04 · REACTION — 5 trials, arc speed driven by median
   ============================================================ */
function renderReaction(body, sub) {
  sub.textContent = 'Wait for the field to turn green. Click as fast as you can. Five trials.';
  body.innerHTML = `
    <div class="rxn-stage wait" id="rxn">
      <div id="rxn-in" style="text-align:center;">
        <div class="rxn-h">Ready</div>
        <div class="rxn-p">Click anywhere to start</div>
      </div>
    </div>
    <div class="trials" id="rxn-trials">
      ${[0,1,2,3,4].map(i=>`<div class="tdot" id="td-${i}">${i+1}</div>`).join('')}
    </div>
    <div id="rxn-result"></div>`;

  const stageEl   = body.querySelector('#rxn');
  const innerEl   = body.querySelector('#rxn-in');
  const resultEl  = body.querySelector('#rxn-result');
  const dots      = [0,1,2,3,4].map(i => body.querySelector(`#td-${i}`));

  let state = 'idle', goAt = 0, trial = 0, times = [], timer = null;

  function set(cls, html) {
    stageEl.className = `rxn-stage ${cls}`;
    if (html !== undefined) innerEl.innerHTML = html;
  }

  function startTrial() {
    state = 'wait';
    set('wait', `<div class="rxn-h" style="opacity:.6">Wait…</div><div class="rxn-p">Trial ${trial + 1} of 5</div>`);
    timer = setTimeout(() => {
      state = 'ready'; goAt = performance.now();
      set('go', `<div class="rxn-h">NOW</div><div class="rxn-p">Click!</div>`);
      beep(660, 0.06);
    }, 900 + Math.random() * 2600);
  }

  function record(ms) {
    times.push(ms);
    const dot = dots[trial];
    dot.classList.add('done');
    dot.textContent = ms < 1000 ? Math.round(ms) : '—';
    dot.style.fontSize = '8px';
    trial++;
    if (trial >= 5) { finish(); return; }
    set('result', `
      <div style="text-align:center;">
        <div class="rxn-ms" id="rxn-ms-val">—</div>
        <div class="rxn-p" style="color:var(--ink3)">Click to continue</div>
      </div>`);
    countUp(body.querySelector('#rxn-ms-val'), 0, Math.round(ms), 700, ' ms');
    state = 'idle';
  }

  function falseFire() {
    clearTimeout(timer);
    set('early', `<div class="rxn-h">Too early</div><div class="rxn-p">Wait for green</div>`);
    beep(120, 0.22, 'sawtooth');
    dots[trial].classList.add('miss'); dots[trial].textContent = '—';
    trial++;
    if (trial >= 5) { finish(); return; }
    state = 'cooldown';
    setTimeout(() => set('idle', `<div class="rxn-h" style="font-size:28px;">Click to continue</div>`), 1400);
  }

  function finish() {
    state = 'done';
    const valid  = times.filter(t => t > 0).sort((a, b) => a - b);
    const median = valid[Math.floor(valid.length / 2)] ?? null;
    const best   = valid[0] ?? null;
    const norm   = median ? Math.max(0, Math.min(1, 1 - (median - 150) / 350)) : 0.5;
    window.soma?.setResult('reaction', { normalized: norm });
    markDone('reaction');

    set('result', `
      <div style="text-align:center;">
        <div class="rxn-ms" id="rxn-fin-ms">—</div>
        <div class="rxn-p" style="color:var(--ink3)">Median</div>
      </div>`);
    if (median) countUp(body.querySelector('#rxn-fin-ms'), 0, Math.round(median), 900, ' ms');

    resultEl.innerHTML = `
      <div class="stats" style="margin-top:12px;">
        <div><div class="stat__lbl">Median</div><div class="stat__val scan" id="r-med">—</div></div>
        <div><div class="stat__lbl">Best</div><div class="stat__val" id="r-best"><em>—</em></div></div>
        <div><div class="stat__lbl">Trials</div><div class="stat__val">${valid.length}/5</div></div>
      </div>
      <div class="note">
        <div class="note__lbl">What drives the arc speed on the model</div>
        <p>A faster median compresses the lightning arc's transit time — you'll see it fire down the arm more rapidly. Typical simple visual RT: <strong>200–300 ms</strong>. Results vary with caffeine, fatigue, and display latency.</p>
      </div>
      <div class="actions" style="margin-top:14px;">
        <button class="btn btn--primary" id="rxn-again">Run again</button>
      </div>`;
    if (median) countUp(resultEl.querySelector('#r-med'), 0, Math.round(median), 800, ' ms');
    if (best)   countUp(resultEl.querySelector('#r-best em'), 0, Math.round(best), 700, ' ms');
    resultEl.querySelector('#rxn-again').addEventListener('click', () => renderReaction(body, sub));
  }

  stageEl.addEventListener('click', () => {
    if      (state === 'idle' || state === 'cooldown') { if (trial < 5) startTrial(); }
    else if (state === 'wait')   falseFire();
    else if (state === 'ready') { beep(880, 0.08); record(performance.now() - goAt); state = 'idle'; }
  });

  cleanup = () => { clearTimeout(timer); };
}

/* ============================================================
   05 · STILLNESS — hold cursor inside ring for 30s
   Crystal growth fraction sent live to shader
   ============================================================ */
function renderStillness(body, sub) {
  sub.textContent = 'Move your cursor inside the ring. Hold it still for 30 seconds. Watch the crystal grow upward on the model.';
  const DUR = 30000;
  body.innerHTML = `
    <div class="still-stage" id="ss">
      <div class="still-target" id="st"></div>
      <div class="still-info">
        <div class="still-t" id="ss-t">30.0</div>
        <div class="still-lbl" id="ss-lbl">Move cursor into the ring</div>
      </div>
      <div class="still-bar" id="ss-bar" style="width:0%"></div>
    </div>
    <div id="ss-result"></div>
    <div class="actions" id="ss-actions" style="display:none;">
      <button class="btn btn--primary" id="ss-retry">Run again</button>
    </div>`;

  const stage   = body.querySelector('#ss');
  const target  = body.querySelector('#st');
  const timeEl  = body.querySelector('#ss-t');
  const lblEl   = body.querySelector('#ss-lbl');
  const barEl   = body.querySelector('#ss-bar');
  const resultEl= body.querySelector('#ss-result');
  const actEl   = body.querySelector('#ss-actions');

  let inside = false, startAt = 0, elapsed = 0, raf = null, done = false, drift = 0;
  let lastX = null, lastY = null;

  function inRing(x, y) {
    const r = target.getBoundingClientRect();
    return Math.hypot(x - (r.left + r.width/2), y - (r.top + r.height/2)) < r.width / 2;
  }

  function loop(ts) {
    if (done) return;
    if (inside) {
      elapsed = ts - startAt;
      const f = Math.min(1, elapsed / DUR);
      const remain = Math.max(0, (DUR - elapsed) / 1000);
      barEl.style.width = (f * 100) + '%';
      timeEl.textContent = remain.toFixed(1);
      // Push crystal growth live to shader
      window.soma?.setResult('stillness', { fraction: f });
      if (elapsed >= DUR) { succeed(); return; }
    }
    raf = requestAnimationFrame(loop);
  }

  function succeed() {
    done = true;
    lblEl.textContent = 'Complete';
    timeEl.textContent = '00.0';
    barEl.style.boxShadow = '0 0 12px var(--bio)';
    window.soma?.setResult('stillness', { fraction: 1 });
    markDone('stillness');
    beep(880, 0.22);
    actEl.style.display = 'flex';
    resultEl.innerHTML = `<div class="note">
      <div class="note__lbl">Crystal growth complete · Drift: ${drift.toFixed(0)} px</div>
      <p>The full crystalline pattern now climbs the model's legs — the height and density you just unlocked. Stillness is a trainable skill. Athletes, surgeons, and bartenders on a busy service all learn to separate intention from micro-tremor.</p></div>`;
  }

  function fail() {
    done = true;
    cancelAnimationFrame(raf);
    target.className = 'still-target out';
    barEl.classList.add('broken');
    lblEl.textContent = 'Broke contact';
    window.soma?.setResult('stillness', { fraction: elapsed / DUR });
    beep(160, 0.25, 'sawtooth', 0.03);
    actEl.style.display = 'flex';
    resultEl.innerHTML = `<div class="note">
      <div class="note__lbl">Held for ${(elapsed/1000).toFixed(1)} seconds</div>
      <p>The crystals stopped growing when you left the ring. Shoulders down, elbow rested, slow breath — try again.</p></div>`;
  }

  function onMove(e) {
    if (done) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x == null) return;

    if (lastX != null) drift += Math.hypot(x - lastX, y - lastY);
    lastX = x; lastY = y;

    if (inRing(x, y)) {
      target.className = 'still-target in';
      lblEl.textContent = 'Holding';
      if (!inside) {
        inside = true;
        startAt = performance.now() - elapsed;
        barEl.classList.remove('broken');
        raf = requestAnimationFrame(loop);
      }
    } else {
      if (inside) { inside = false; cancelAnimationFrame(raf); fail(); }
      else { target.className = 'still-target'; }
    }
  }

  stage.addEventListener('mousemove', onMove);
  stage.addEventListener('touchmove', onMove, { passive: true });
  stage.addEventListener('mouseleave', () => { if (inside && !done) { inside = false; fail(); } });
  body.querySelector('#ss-retry')?.addEventListener('click', () => renderStillness(body, sub));

  cleanup = () => { done = true; cancelAnimationFrame(raf); };
}

/* ---- Boot ---- */
renderHome();
