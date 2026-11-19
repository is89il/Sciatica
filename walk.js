'use strict';
/* Walking: real walks you log, and a walking goal (a trail) you move along.
   Distance on the trail = km you actually walked since the goal started
   + a small bonus for check-ins (100 m) and exercise sessions (50 m).
   Loaded after app.js (uses its helpers); the app starts on DOMContentLoaded. */

const BONUS_CHECKIN_KM = 0.1;
const BONUS_EXERCISE_KM = 0.05;
const PACES = [
  { id: 'slow', name: 'Slow', kmh: 3 },
  { id: 'easy', name: 'Easy', kmh: 4 },
  { id: 'normal', name: 'Normal', kmh: 5 },
  { id: 'brisk', name: 'Brisk', kmh: 6 },
];

// Ready-made goals. Distances are approximate (≈) and can be edited after choosing.
const GOAL_PRESETS = [
  { group: 'Near Amersfoort', id: 'afrt-loop', icon: '🏰', name: 'Amersfoort old town loop', km: 2.5, landmarks: [
    [0, 'Onze Lieve Vrouwetoren'], [0.6, 'Koppelpoort'], [1.3, 'Muurhuizen'], [1.9, 'Kamperbinnenpoort'], [2.5, 'Back at the tower'] ] },
  { group: 'Near Amersfoort', id: 'afrt-spakenburg', icon: '⛵', name: 'Amersfoort → Spakenburg harbour', km: 12, landmarks: [
    [0, 'Amersfoort Centraal'], [4, 'Hoogland'], [8, 'Bunschoten'], [12, 'Spakenburg harbour'] ] },
  { group: 'Near Amersfoort', id: 'afrt-soestdijk', icon: '👑', name: 'Amersfoort → Paleis Soestdijk', km: 12, landmarks: [
    [0, 'Amersfoort Centraal'], [3.5, 'Amersfoortse Berg'], [8.5, 'Soest'], [12, 'Paleis Soestdijk'] ] },
  { group: 'Near Amersfoort', id: 'afrt-austerlitz', icon: '🔺', name: 'Amersfoort → Pyramide van Austerlitz', km: 13, landmarks: [
    [0, 'Amersfoort Centraal'], [3.5, 'Amersfoortse Berg'], [7, 'Landgoed Den Treek'], [10, 'Henschotermeer'], [13, 'Pyramide van Austerlitz'] ] },
  { group: 'Near Amersfoort', id: 'afrt-utrecht', icon: '⛪', name: 'Amersfoort → Utrecht Domtoren', km: 25, landmarks: [
    [0, 'Amersfoort Centraal'], [8, 'Landgoed Den Treek'], [16, 'Slot Zeist'], [21, 'De Bilt'], [25, 'Domtoren Utrecht'] ] },
  { group: 'Netherlands', id: 'pieterpad', icon: '🇳🇱', name: 'Pieterpad (Pieterburen → Sint-Pietersberg)', km: 498, landmarks: [
    [0, 'Pieterburen'], [38, 'Groningen'], [58, 'Zuidlaren'], [130, 'Coevorden'], [152, 'Hardenberg'], [172, 'Ommen'],
    [205, 'Holten'], [250, 'Vorden'], [290, 'Groenlo'], [330, 'Millingen aan de Rijn'], [345, 'Groesbeek'], [365, 'Gennep'],
    [405, 'Venlo'], [435, 'Roermond'], [465, 'Sittard'], [498, 'Sint-Pietersberg, Maastricht'] ] },
  { group: 'Camino de Santiago', id: 'camino-sarria', icon: '🐚', name: 'Camino Francés: last 100 km (Sarria → Santiago)', km: 115, landmarks: [
    [0, 'Sarria'], [22, 'Portomarín'], [47, 'Palas de Rei'], [62, 'Melide'], [76, 'Arzúa'], [95, 'O Pedrouzo'], [115, 'Santiago de Compostela'] ] },
  { group: 'Camino de Santiago', id: 'camino-portugues', icon: '🐚', name: 'Camino Portugués (Porto → Santiago)', km: 240, landmarks: [
    [0, 'Porto'], [60, 'Barcelos'], [93, 'Ponte de Lima'], [120, 'Valença / Tui'], [170, 'Pontevedra'], [192, 'Caldas de Reis'], [215, 'Padrón'], [240, 'Santiago de Compostela'] ] },
  { group: 'Camino de Santiago', id: 'camino-frances', icon: '🐚', name: 'Camino Francés (Saint-Jean → Santiago)', km: 780, landmarks: [
    [0, 'Saint-Jean-Pied-de-Port'], [25, 'Roncesvalles'], [68, 'Pamplona'], [160, 'Logroño'], [285, 'Burgos'], [465, 'León'],
    [515, 'Astorga'], [570, 'Ponferrada'], [625, 'O Cebreiro'], [665, 'Sarria'], [780, 'Santiago de Compostela'] ] },
  { group: 'Abroad', id: 'tongariro', icon: '🌋', name: 'Tongariro Alpine Crossing', km: 19.4, landmarks: [
    [0, 'Mangatepopo car park'], [4.5, 'Soda Springs'], [6, "Devil's Staircase"], [7, 'South Crater'], [8.6, 'Red Crater (1886 m)'],
    [9.4, 'Emerald Lakes'], [10.7, 'Blue Lake'], [14.5, 'Ketetahi Shelter'], [19.4, 'Ketetahi car park'] ] },
];

const fmtKm = (km) => (km == null ? '–' : km < 100 ? km.toFixed(1).replace(/\.0$/, '') : Math.round(km).toString()) + ' km';
const walkKm = (w) => (w.km != null && w.km !== '' ? Number(w.km) : (Number(w.min) || 0) / 60 * (PACES.find((p) => p.id === w.pace)?.kmh || 4));

/* ---------- Goal progress ---------- */
function goalProgress() {
  const g = data.goal;
  if (!g || !g.km) return null;
  let walked = 0, bonus = 0;
  for (const [d, e] of Object.entries(data.entries)) {
    if (d < g.start || d > todayISO()) continue;
    for (const w of e.walks || []) walked += walkKm(w);
    bonus += checkinsOn(d) * BONUS_CHECKIN_KM;
    bonus += Object.values(e.exercises || {}).reduce((a, n) => a + n, 0) * BONUS_EXERCISE_KM;
  }
  const total = walked + bonus;
  const laps = Math.floor(total / g.km);
  const pos = total - laps * g.km;
  const lm = (g.landmarks || []).slice().sort((a, b) => a[0] - b[0]);
  const reachedIdx = lm.reduce((acc, l, i) => (l[0] <= pos + 1e-9 ? i : acc), -1);
  const next = lm.find((l) => l[0] > pos + 1e-9);
  return { g, walked, bonus, total, laps, pos, lm, reachedIdx, next, pct: Math.min(100, (pos / g.km) * 100) };
}
function countdown(target) {
  if (!target) return '';
  const days = daysBetween(todayISO(), target);
  if (days < 0) return 'target date passed';
  if (days === 0) return 'today is the day!';
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30.4), d = Math.round(days - y * 365 - m * 30.4);
  const parts = [];
  if (y) parts.push(`${y} year${y > 1 ? 's' : ''}`);
  if (m) parts.push(`${m} month${m > 1 ? 's' : ''}`);
  if (!y && d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  return `${parts.join(' ')} to go`;
}
function trailSvg(p, h = 46) {
  const W = 320, L = 10, R = 10, y = h / 2 + 4, iw = W - L - R;
  const x = (km) => L + (km / p.g.km) * iw;
  let s = `<svg viewBox="0 0 ${W} ${h}" class="trail-svg" preserveAspectRatio="none" aria-hidden="true">`;
  s += `<path d="M${L} ${y} L${W - R} ${y}" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/>`;
  s += `<path d="M${L} ${y} L${x(p.pos).toFixed(1)} ${y}" stroke="url(#trailgrad)" stroke-width="6" stroke-linecap="round"/>`;
  s += '<defs><linearGradient id="trailgrad"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)"/></linearGradient></defs>';
  p.lm.forEach((l, i) => {
    s += `<circle cx="${x(l[0]).toFixed(1)}" cy="${y}" r="${i === p.lm.length - 1 ? 6 : 4}" fill="${i <= p.reachedIdx ? 'var(--accent2)' : 'var(--card2)'}" stroke="var(--muted)" stroke-width="1"/>`;
  });
  s += `<text x="${x(p.pos).toFixed(1)}" y="${y - 8}" text-anchor="middle" font-size="16">🚶</text></svg>`;
  return s;
}

/* ---------- Log: trail card + walks card ---------- */
function renderTrailCard() {
  const p = goalProgress();
  const el = $('#trail-card');
  if (!p) {
    el.innerHTML = `<button class="trail-empty" data-goal>🎯 <b>Set a walking goal</b><span class="muted small">The Pieterpad, a Camino, a walk to Spakenburg… Your real walks move you along it.</span></button>`;
    return;
  }
  const last = p.lm[p.lm.length - 1];
  el.innerHTML = `<button class="trail" data-goal aria-label="Walking goal">
    <div class="tr-top"><b>${esc(p.g.icon || '🎯')} ${esc(p.g.name)}</b><span class="muted small">${countdown(p.g.target)}</span></div>
    ${trailSvg(p)}
    <div class="tr-bot"><span><b>${fmtKm(p.pos)}</b> of ${fmtKm(p.g.km)}${p.laps ? ` · crossing #${p.laps + 1}` : ''}</span>
    <span class="muted small">${p.next ? `next: ${esc(p.next[1])} in ${fmtKm(p.next[0] - p.pos)}` : last ? `🎉 ${esc(last[1])}!` : ''}</span></div>
  </button>`;
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-goal]')) openGoal(); });

function renderWalkCard(entry) {
  const walks = entry.walks || [];
  const total = walks.reduce((a, w) => a + walkKm(w), 0), mins = walks.reduce((a, w) => a + (Number(w.min) || 0), 0);
  $('#walk-card').innerHTML = `<div class="slot-head"><h3>🚶 Walks</h3><span class="hint">${walks.length ? `${mins} min · ${fmtKm(total)}` : ''}</span></div>
    ${walks.map((w) => `<div class="walk-row" data-walk="${w.id}">
      <span>👟 <b>${w.min} min</b> · ${fmtKm(walkKm(w))}${w.km == null || w.km === '' ? ` <span class="muted small">(${(PACES.find((p) => p.id === w.pace) || PACES[1]).name.toLowerCase()} pace)</span>` : ''}${w.stopped ? ' <span class="tag-warn">stopped by pain</span>' : ''}${w.note ? `<br><span class="muted small">${esc(w.note)}</span>` : ''}</span>
      <button class="x" data-rmwalk aria-label="Remove walk">✕</button></div>`).join('')}
    <button class="wide add-walk" data-addwalk>+ Log a walk</button>`;
}
$('#walk-card').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if ('addwalk' in b.dataset) return openWalk();
  if ('rmwalk' in b.dataset) {
    const e = getEntry(currentDate); const id = b.closest('[data-walk]').dataset.walk;
    e.walks = e.walks.filter((w) => w.id !== id);
    pruneEntry(currentDate); save(); renderLog();
  }
});

/* ---------- Walk dialog ---------- */
const walkDlg = $('#walk-dialog'), walkForm = $('#walk-form');
let walkMode = 'pace', walkPace = 'easy';
function renderWalkChoices() {
  $('#walk-mins').innerHTML = [10, 15, 20, 30, 45, 60].map((m) => `<button type="button" class="chip ${Number(walkForm.elements.min.value) === m ? 'on' : ''}" data-min="${m}">${m}</button>`).join('');
  $('#walk-mode').innerHTML = `<button type="button" class="${walkMode === 'pace' ? 'on' : ''}" data-mode="pace">I know my speed</button><button type="button" class="${walkMode === 'km' ? 'on' : ''}" data-mode="km">I know the distance</button>`;
  $('#walk-paces').style.display = walkMode === 'pace' ? '' : 'none';
  $('#walk-km-wrap').style.display = walkMode === 'km' ? '' : 'none';
  $('#walk-paces').innerHTML = PACES.map((p) => `<button type="button" class="chip ${walkPace === p.id ? 'on' : ''}" data-pace="${p.id}">${p.name} <span class="small">${p.kmh} km/h</span></button>`).join('');
  const min = Number(walkForm.elements.min.value) || 0;
  const km = walkMode === 'km' ? Number(String(walkForm.elements.km.value).replace(',', '.')) || 0 : min / 60 * PACES.find((p) => p.id === walkPace).kmh;
  $('#walk-calc').textContent = min ? `≈ ${fmtKm(km)}${walkMode === 'km' && km ? ` · ${(km / (min / 60)).toFixed(1)} km/h` : ''}` : '';
}
function openWalk() {
  walkForm.reset();
  walkMode = 'pace'; walkPace = data.lastPace || 'easy';
  walkForm.elements.min.value = 15;
  renderWalkChoices();
  walkDlg.returnValue = '';
  walkDlg.showModal();
}
walkForm.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[type=button]'); if (!b) return;
  if (b.dataset.min) walkForm.elements.min.value = b.dataset.min;
  if (b.dataset.mode) walkMode = b.dataset.mode;
  if (b.dataset.pace) walkPace = b.dataset.pace;
  renderWalkChoices();
});
walkForm.addEventListener('input', renderWalkChoices);
walkDlg.addEventListener('close', () => {
  if (walkDlg.returnValue !== 'save') return;
  const f = walkForm.elements;
  const min = Math.round(Number(f.min.value));
  if (!min) return;
  const before = goalProgress();
  const w = { id: uid(), min, stopped: f.stopped.checked, note: f.note.value.trim() };
  if (walkMode === 'km' && f.km.value) w.km = Number(String(f.km.value).replace(',', '.'));
  else { w.pace = walkPace; data.lastPace = walkPace; }
  const e = getEntry(currentDate, true);
  e.walks = [...(e.walks || []), w];
  save(); renderLog();
  const after = goalProgress();
  toast(`👟 <b>${cheer()}</b> ${min} min · ${fmtKm(walkKm(w))}${after?.next ? `<br><span class="small">${fmtKm(after.next[0] - after.pos)} to ${esc(after.next[1])}</span>` : ''}`);
  if (!before) confetti(20);
});

/* ---------- Goal dialog ---------- */
const goalDlg = $('#goal-dialog'), goalForm = $('#goal-form');
function presetOptions() {
  const groups = [...new Set(GOAL_PRESETS.map((p) => p.group))];
  return groups.map((g) => `<optgroup label="${g}">${GOAL_PRESETS.filter((p) => p.group === g).map((p) => `<option value="${p.id}">${p.icon} ${esc(p.name)} (≈${p.km} km)</option>`).join('')}</optgroup>`).join('') +
    '<option value="custom">✏️ My own goal…</option>';
}
const landmarksToText = (lm) => lm.map(([km, n]) => `${km} ${n}`).join('\n');
function textToLandmarks(t) {
  return t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^([\d.,]+)\s*(?:km)?\s*[-:–]?\s*(.+)$/i);
    return m ? [Number(m[1].replace(',', '.')), m[2].trim()] : null;
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
}
function fillFromPreset(id) {
  const p = GOAL_PRESETS.find((x) => x.id === id);
  const f = goalForm.elements;
  if (!p) { f.name.value = ''; f.km.value = ''; f.landmarks.value = ''; f.icon.value = '🎯'; return; }
  f.name.value = p.name; f.km.value = p.km; f.icon.value = p.icon; f.landmarks.value = landmarksToText(p.landmarks);
}
function openGoal() {
  const g = data.goal;
  const f = goalForm.elements;
  goalForm.reset();
  f.preset.innerHTML = presetOptions();
  if (g) {
    f.preset.value = g.preset && GOAL_PRESETS.some((p) => p.id === g.preset) ? g.preset : 'custom';
    f.name.value = g.name; f.km.value = g.km; f.icon.value = g.icon || '🎯'; f.target.value = g.target || ''; f.start.value = g.start;
    f.landmarks.value = landmarksToText(g.landmarks || []);
  } else {
    f.preset.value = 'tongariro'; fillFromPreset('tongariro'); f.start.value = todayISO();
  }
  $('#goal-remove').style.display = g ? '' : 'none';
  const p = goalProgress();
  $('#goal-stats').innerHTML = p ? `<div class="muted small">So far: <b>${fmtKm(p.walked)}</b> walked + <b>${fmtKm(p.bonus)}</b> check-in bonus = ${fmtKm(p.total)}${p.laps ? ` (${p.laps} complete)` : ''}</div>` : '';
  goalDlg.returnValue = '';
  goalDlg.showModal();
}
goalForm.elements.preset.addEventListener('change', (e) => fillFromPreset(e.target.value));
goalDlg.addEventListener('close', () => {
  if (goalDlg.returnValue !== 'save') return;
  const f = goalForm.elements;
  const km = Number(String(f.km.value).replace(',', '.'));
  if (!f.name.value.trim() || !km) return;
  let landmarks = textToLandmarks(f.landmarks.value).filter((l) => l[0] <= km);
  if (!landmarks.length || landmarks[0][0] > 0) landmarks.unshift([0, 'Start']);
  if (landmarks[landmarks.length - 1][0] < km) landmarks.push([km, 'Finish']);
  data.goal = { preset: f.preset.value, icon: f.icon.value || '🎯', name: f.name.value.trim(), km, target: f.target.value, start: f.start.value || todayISO(), landmarks };
  data.goal.seenKey = goalKey(); // only celebrate landmarks reached from now on
  save(); refreshActive();
});
$('#goal-remove').addEventListener('click', () => {
  if (!confirm('Remove your walking goal? Your logged walks are kept.')) return;
  delete data.goal; save(); goalDlg.close('removed'); refreshActive();
});

/* ---------- Landmark celebrations ---------- */
function goalKey() { const p = goalProgress(); return p ? p.laps * 1000 + p.reachedIdx : -1; }
function checkGoal() {
  if (!data.goal) return;
  const p = goalProgress(); const key = p.laps * 1000 + p.reachedIdx;
  const seen = data.goal.seenKey ?? -1;
  if (key > seen) {
    data.goal.seenKey = key;
    persist();
    const finished = p.laps > Math.floor(seen / 1000);
    if (finished) { confetti(80); toast(`🏁 <b>You finished the ${esc(p.g.name)}!</b><br><span class="small">Starting crossing #${p.laps + 1}. Keep walking!</span>`, true); }
    else if (p.reachedIdx > 0) { confetti(50); toast(`📍 <b>You reached ${esc(p.lm[p.reachedIdx][1])}!</b><br><span class="small">${fmtKm(p.pos)} of ${fmtKm(p.g.km)}</span>`, true); }
  }
}

/* ---------- Overview ---------- */
function renderWalkOverview(dates) {
  const ws = dates.flatMap((d) => (data.entries[d]?.walks || []).map((w) => ({ ...w, d })));
  const p = goalProgress();
  const goalHtml = p ? `<div class="ov-row"><div class="top"><b>${esc(p.g.icon || '🎯')} ${esc(p.g.name)}</b><span class="muted">${fmtKm(p.pos)} / ${fmtKm(p.g.km)}</span></div>${trailSvg(p)}
    <div class="muted small">${p.next ? `Next: ${esc(p.next[1])} in ${fmtKm(p.next[0] - p.pos)}` : ''}${p.g.target ? ` · ${countdown(p.g.target)}` : ''}</div></div>` : '';
  if (!ws.length) { $('#ov-walk').innerHTML = goalHtml + '<div class="empty-sm">No walks logged in this period.</div>'; return; }
  const km = ws.reduce((a, w) => a + walkKm(w), 0), min = ws.reduce((a, w) => a + w.min, 0);
  const longest = ws.reduce((a, w) => (w.min > a.min ? w : a), ws[0]);
  const days = new Set(ws.map((w) => w.d)).size;
  const stopped = ws.filter((w) => w.stopped).length;
  // average walk length, first half vs second half of the period: is walking tolerance improving?
  const half = dates[Math.floor(dates.length / 2)];
  const m1 = mean(ws.filter((w) => w.d < half).map((w) => w.min)), m2 = mean(ws.filter((w) => w.d >= half).map((w) => w.min));
  const trend = m1 != null && m2 != null ? `<p class="muted small">Average walk: <b>${Math.round(m1)} min</b> in the first half of this period → <b>${Math.round(m2)} min</b> in the second half.</p>` : '';
  $('#ov-walk').innerHTML = `<div class="stats">
      <div class="stat"><div class="k">Distance</div><div class="n">${fmtKm(km)}</div><div class="k">${ws.length} walks · ${days} days</div></div>
      <div class="stat"><div class="k">Time</div><div class="n">${fmtHours(min / 60)}</div><div class="k">avg ${Math.round(min / ws.length)} min/walk</div></div>
      <div class="stat"><div class="k">Longest</div><div class="n">${fmtHours(longest.min / 60)}</div><div class="k">${stopped ? `${stopped}× stopped by pain` : 'none stopped by pain'}</div></div>
    </div>${trend}${goalHtml}`;
}
