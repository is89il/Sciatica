'use strict';

/* ---------- Config ---------- */
const STORAGE_KEY = 'paintracker.v1';
const SLOTS = [
  { id: 'morning', name: 'Morning', hint: 'after waking up', icon: '🌅' },
  { id: 'afternoon', name: 'Afternoon', hint: 'midday', icon: '☀️' },
  { id: 'evening', name: 'Evening', hint: 'before bed', icon: '🌙' },
];
const AREAS = [
  { id: 'right', name: 'Right leg', color: 'var(--right)' },
  { id: 'left', name: 'Left leg', color: 'var(--left)' },
  { id: 'back', name: 'Lower back', color: 'var(--back)' },
];
const SYMPTOMS = [
  'Numbness', 'Tingling / pins & needles', 'Leg weakness', 'Burning', 'Muscle cramps / spasms',
  'Pain below the knee', 'Pain in the other leg', 'Morning stiffness', 'Worse when sitting',
  'Worse when lying down', 'Woke up due to sciatica pain', 'Poor sleep',
];
const MED_COLOR = 'var(--med)';

/* ---------- Helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => toISO(new Date());
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const fmt = (v) => (v == null ? '–' : v.toFixed(1));
const painColor = (v) => `hsl(${120 - v * 12} 70% ${v >= 7 ? 40 : 42}%)`;
const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  fromISO(iso).toLocaleDateString(undefined, opts);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
// "13th Nov 2026"
const fmtLong = (iso) => { const d = fromISO(iso); return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
// "Today" / "Yesterday" / "Wednesday"
const dayName = (iso) => {
  const diff = daysBetween(iso, todayISO());
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff === -1 ? 'Tomorrow' : WEEKDAYS[fromISO(iso).getDay()];
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Storage ---------- */
function emptyData() { return { version: 2, entries: {}, appointments: [], meds: [], exercises: [] }; }
function migrate(d) {
  d.meds = Array.isArray(d.meds) ? d.meds : [];
  d.exercises = Array.isArray(d.exercises) ? d.exercises : [];
  d.version = 2;
  return d;
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && d.entries && Array.isArray(d.appointments)) return migrate(d);
  } catch (e) { /* ignore */ }
  return emptyData();
}
let data = load();
let saveTimer;
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function save() {
  persist();
  checkBadgesSoon();
  const hint = $('#saved-hint');
  hint.textContent = 'Saved ✓';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => (hint.textContent = 'Saved automatically'), 1200);
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function getEntry(date, create = false) {
  if (!data.entries[date] && create) data.entries[date] = { note: '' };
  return data.entries[date];
}
function getSlot(date, slot, create = false) {
  const e = getEntry(date, create);
  if (!e) return undefined;
  if (!e[slot] && create) e[slot] = { right: null, left: null, back: null, note: '' };
  return e[slot];
}
function pruneEntry(date) {
  const e = data.entries[date];
  if (!e) return;
  for (const s of SLOTS) {
    const v = e[s.id];
    if (v && AREAS.every((a) => v[a.id] == null) && !v.note) delete e[s.id];
  }
  if (e.meds && !e.meds.length) delete e.meds;
  if (e.exercises) {
    for (const k of Object.keys(e.exercises)) if (!e.exercises[k]) delete e.exercises[k];
    if (!Object.keys(e.exercises).length) delete e.exercises;
  }
  if (e.symptoms && !e.symptoms.length) delete e.symptoms;
  if (e.sleep && e.sleep.night == null && e.sleep.nap == null) delete e.sleep;
  for (const k of ['exNote', 'symptomNote']) if (k in e && !e[k]) delete e[k];
  const keys = Object.keys(e).filter((k) => k !== 'note');
  if (!e.note && !keys.length) delete data.entries[date];
}

/* ---------- Navigation ---------- */
function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  if (name === 'overview') renderOverview();
  if (name === 'appts') renderAppointments();
  if (name === 'log') renderLog();
  if (name === 'settings') renderManageLists();
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

/* ---------- Log view ---------- */
let currentDate = todayISO();
const dateInput = $('#log-date');
function currentSlotId() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
// Which slot cards are open. Today: the one for the current time of day.
// Other days: the first one that isn't fully logged yet.
let openSlots = null, openFor = null;
function ensureOpenSlots() {
  if (openFor === currentDate && openSlots) return;
  openFor = currentDate;
  const first = currentDate === todayISO() ? currentSlotId() : (SLOTS.find((s) => !slotComplete(currentDate, s.id)) || SLOTS[0]).id;
  openSlots = new Set([first]);
}
const slotSummary = (sv) => AREAS.map((a) => `<span class="mini" style="--c:${a.color}">${({ right: 'R leg', left: 'L leg', back: 'Back' })[a.id]} <b>${sv[a.id] ?? '–'}</b></span>`).join('');

function renderLog() {
  dateInput.value = currentDate;
  dateInput.max = todayISO();
  $('#log-date-main').textContent = dayName(currentDate);
  $('#log-date-sub').textContent = fmtLong(currentDate);
  $('#jump-today-wrap').classList.toggle('show', currentDate !== todayISO());
  $('#next-day').disabled = currentDate >= todayISO();
  const entry = getEntry(currentDate) || {};

  // appointments of the day
  const appts = data.appointments.filter((a) => a.date === currentDate);
  $('#day-appts').innerHTML = appts
    .map((a) => `<div class="appt-chip" data-id="${a.id}"><span>🗓</span><div><div class="t">${esc(a.type)}${a.time ? ' · ' + esc(a.time) : ''}</div><div class="muted small">${esc(a.provider || '')}${a.treatment ? ' — ' + esc(a.treatment.slice(0, 80)) : ''}</div>${txTags(a)}</div></div>`)
    .join('') +
    `<div class="row"><button class="wide" id="log-add-appt">+ Add appointment on this day</button></div>`;
  $$('#day-appts .appt-chip').forEach((el) => el.addEventListener('click', () => openAppt(el.dataset.id)));
  $('#log-add-appt').addEventListener('click', () => openAppt(null, currentDate));

  // slots
  ensureOpenSlots();
  renderProgress();
  $('#slots').innerHTML = SLOTS.map((s, i) => {
    const sv = entry[s.id] || {};
    const open = openSlots.has(s.id);
    const done = slotComplete(currentDate, s.id);
    const logged = slotLogged(currentDate, s.id);
    if (!open) {
      return `<div class="card slot collapsed ${done ? 'done' : ''}" data-slot="${s.id}">
        <button class="slot-toggle" data-toggle>
          <span class="st-name">${s.icon} ${s.name}</span>
          ${logged ? `<span class="minis">${slotSummary(sv)}</span>` : '<span class="muted small">tap to log</span>'}
          <span class="st-check">${done ? '✓' : '›'}</span>
        </button></div>`;
    }
    return `<div class="card slot ${done ? 'done' : ''}" data-slot="${s.id}">
      <div class="slot-head"><button class="slot-title" data-toggle><h3>${s.icon} ${s.name} <span class="hint">${s.hint}</span></h3></button>
        ${i > 0 ? `<button class="copy-prev" data-copy="${SLOTS[i - 1].id}">Same as ${SLOTS[i - 1].name.toLowerCase()}</button>` : ''}
      </div>
      ${AREAS.map((a) => {
        const val = sv[a.id];
        return `<div class="area">
          <div class="area-name"><span><span class="dot" style="background:${a.color}"></span><b>${a.name}</b></span><span class="muted">${val == null ? 'not logged' : val + '/10'}</span></div>
          <div class="scale" data-area="${a.id}">
            ${Array.from({ length: 11 }, (_, n) => `<button data-v="${n}" class="${val === n ? 'sel' : ''}" style="${val === n ? `background:${painColor(n)}` : ''}" aria-label="${a.name} ${n} out of 10">${n}</button>`).join('')}
          </div></div>`;
      }).join('')}
      <div class="slot-note"><textarea rows="1" placeholder="Note (optional)" data-note>${esc(sv.note || '')}</textarea></div>
    </div>`;
  }).join('');

  $('#day-note').value = entry.note || '';
  renderSleepCard(entry);
  renderMedsCard(entry);
  renderExCard(entry);
  renderSymCard(entry);
}

/* ---------- Sleep (log) ---------- */
const SLEEP = [
  { id: 'night', name: 'Night sleep', hint: 'the night before this day', step: 0.25, start: 7, max: 16 },
  { id: 'nap', name: 'Naps', hint: 'total during the day', step: 0.25, start: 0.5, max: 8 },
];
const fmtHours = (h) => {
  if (h == null) return '–';
  const m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
  return hh && mm ? `${hh}h ${pad(mm)}m` : hh ? `${hh}h` : `${mm}m`;
};
function renderSleepCard(entry) {
  const sl = entry.sleep || {};
  $('#sleep-card').innerHTML = `<div class="slot-head"><h3>😴 Sleep</h3><span class="hint">${sl.night != null || sl.nap != null ? 'total ' + fmtHours((sl.night || 0) + (sl.nap || 0)) : ''}</span></div>
    ${SLEEP.map((k) => `<div class="sleep-row" data-sleep="${k.id}">
      <div class="info"><b>${k.name}</b><div class="muted">${k.hint}</div></div>
      <div class="counter"><button data-d="-1" aria-label="Less ${k.name}">−</button><span>${sl[k.id] == null ? 'not set' : fmtHours(sl[k.id])}</span><button data-d="1" aria-label="More ${k.name}">+</button></div>
    </div>`).join('')}`;
}
$('#sleep-card').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-d]'); if (!b) return;
  const k = SLEEP.find((x) => x.id === b.closest('[data-sleep]').dataset.sleep);
  const e = getEntry(currentDate, true); e.sleep = e.sleep || { night: null, nap: null };
  const cur = e.sleep[k.id], d = Number(b.dataset.d);
  if (cur == null) e.sleep[k.id] = d > 0 ? k.start : null;
  else {
    const v = cur + d * k.step;
    e.sleep[k.id] = v < 0 ? null : Math.min(k.max, v); // going below 0 clears it
  }
  pruneEntry(currentDate); save(); renderLog();
});

/* ---------- Medication (log) ---------- */
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const doseLabel = (m) => [m.dose, m.unit].filter(Boolean).join(' ');
function logDose(med) {
  const e = getEntry(currentDate, true);
  e.meds = e.meds || [];
  e.meds.push({ id: uid(), medId: med.id, name: med.name, dose: med.dose || '', unit: med.unit || '', time: currentDate === todayISO() ? nowTime() : '' });
  e.meds.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  save();
}
function renderMedsCard(entry) {
  const active = data.meds.filter((m) => m.active !== false);
  const taken = entry.meds || [];
  $('#meds-card').innerHTML = `<div class="slot-head"><h3>💊 Medication</h3><span class="hint">${taken.length ? taken.length + ' dose' + (taken.length > 1 ? 's' : '') : ''}</span></div>
    <div class="quick">${active.map((m) => `<button data-med="${m.id}">+ ${esc(m.name)}${m.dose ? ' ' + esc(doseLabel(m)) : ''}</button>`).join('')}
      <button class="add" data-newmed>+ New medication</button></div>
    ${taken.length ? taken.map((t) => `<div class="intake" data-intake="${t.id}">
        <span>${esc(t.name)}</span>
        <input value="${esc(t.dose)}" data-f="dose" inputmode="decimal" aria-label="Dose" placeholder="dose">
        <input type="time" value="${esc(t.time)}" data-f="time" aria-label="Time">
        <button class="x" data-rm aria-label="Remove">✕</button></div>`).join('')
      : '<div class="empty-sm">Nothing logged. Tap a medication above when you take it.</div>'}`;
}
$('#meds-card').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.med) { logDose(data.meds.find((m) => m.id === b.dataset.med)); renderLog(); }
  else if ('newmed' in b.dataset) openMed(null, true);
  else if ('rm' in b.dataset) {
    const e = getEntry(currentDate); const id = b.closest('[data-intake]').dataset.intake;
    e.meds = e.meds.filter((t) => t.id !== id);
    pruneEntry(currentDate); save(); renderLog();
  }
});
$('#meds-card').addEventListener('change', (ev) => {
  const f = ev.target.dataset.f; if (!f) return;
  const id = ev.target.closest('[data-intake]').dataset.intake;
  const t = getEntry(currentDate).meds.find((x) => x.id === id);
  t[f] = ev.target.value.trim();
  if (f === 'time') getEntry(currentDate).meds.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  save();
});

/* ---------- Exercises (log) ---------- */
function renderExCard(entry) {
  const done = entry.exercises || {};
  // show active exercises + any retired ones that were done on this day
  const list = data.exercises.filter((x) => x.active !== false || done[x.id]);
  $('#ex-card').innerHTML = `<div class="slot-head"><h3>🏃 Home exercises</h3><button class="copy-prev" data-newex>+ New</button></div>
    ${list.length ? list.map((x) => {
      const n = done[x.id] || 0; const target = Number(x.target) || 1;
      return `<div class="ex-row ${n >= target ? 'done' : ''}" data-ex="${x.id}">
        <div class="info"><b>${esc(x.name)}</b><div class="muted">${esc(x.detail || '')}${x.target ? `${x.detail ? ' · ' : ''}${x.target}× per day` : ''}</div></div>
        <div class="counter"><button data-d="-1" aria-label="Less">−</button><span>${n}${x.target ? '/' + x.target : ''}</span><button data-d="1" aria-label="More">+</button></div>
      </div>`;
    }).join('') : '<div class="empty-sm">Add the exercises your physio gave you, then tap + each time you do a session.</div>'}
    <div class="slot-note"><textarea rows="1" placeholder="How did the exercises feel? (optional)" data-exnote>${esc(entry.exNote || '')}</textarea></div>`;
}
$('#ex-card').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if ('newex' in b.dataset) return openEx(null);
  if (!b.dataset.d) return;
  const id = b.closest('[data-ex]').dataset.ex;
  const e = getEntry(currentDate, true); e.exercises = e.exercises || {};
  e.exercises[id] = Math.max(0, (e.exercises[id] || 0) + Number(b.dataset.d));
  pruneEntry(currentDate); save(); renderLog();
});
$('#ex-card').addEventListener('input', (ev) => {
  if (!('exnote' in ev.target.dataset)) return;
  getEntry(currentDate, true).exNote = ev.target.value;
  pruneEntry(currentDate); save();
});

/* ---------- Symptoms (log) ---------- */
function renderSymCard(entry) {
  const on = new Set(entry.symptoms || []);
  $('#sym-card').innerHTML = `<div class="slot-head"><h3>⚡ Other symptoms</h3></div>
    <div class="chips">${SYMPTOMS.map((sy) => `<button class="chip ${on.has(sy) ? 'on' : ''}" data-sym="${esc(sy)}">${esc(sy)}</button>`).join('')}</div>
    <textarea rows="2" placeholder="Describe: where (e.g. right foot, outer calf), when, how long…" data-symnote>${esc(entry.symptomNote || '')}</textarea>`;
}
$('#sym-card').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-sym]'); if (!b) return;
  const e = getEntry(currentDate, true); const set = new Set(e.symptoms || []);
  set.has(b.dataset.sym) ? set.delete(b.dataset.sym) : set.add(b.dataset.sym);
  e.symptoms = SYMPTOMS.filter((x) => set.has(x));
  pruneEntry(currentDate); save(); renderLog();
});
$('#sym-card').addEventListener('input', (ev) => {
  if (!('symnote' in ev.target.dataset)) return;
  getEntry(currentDate, true).symptomNote = ev.target.value;
  pruneEntry(currentDate); save();
});

/* ---------- Manage medications & exercises (dialogs + settings lists) ---------- */
const medDlg = $('#med-dialog'), medForm = $('#med-form');
let editingMed = null, medFromLog = false;
function openMed(id, fromLog = false) {
  editingMed = id; medFromLog = fromLog;
  const m = id ? data.meds.find((x) => x.id === id) : {};
  medForm.reset();
  $('#med-dialog-title').textContent = id ? 'Edit medication' : 'New medication';
  $('#med-delete').style.display = id ? '' : 'none';
  $('#med-log-now-wrap').style.display = fromLog ? '' : 'none';
  for (const k of ['name', 'dose', 'unit', 'schedule']) medForm.elements[k].value = m[k] || '';
  if (!id) medForm.elements.unit.value = 'mg';
  medForm.elements.active.checked = m.active !== false;
  medForm.elements.effective.value = currentDate <= todayISO() ? currentDate : todayISO();
  $('#med-eff-wrap').firstChild.textContent = id ? 'If you changed dose or stopped/restarted: on which date?' : 'Started on';
  renderMedHistory(m);
  medDlg.returnValue = '';
  medDlg.showModal();
}
medDlg.addEventListener('close', () => {
  if (medDlg.returnValue !== 'save') return;
  const f = medForm.elements;
  const rec = { id: editingMed || uid(), name: f.name.value.trim(), dose: f.dose.value.trim(), unit: f.unit.value.trim(), schedule: f.schedule.value.trim(), active: f.active.checked };
  if (!rec.name) return;
  const i = data.meds.findIndex((x) => x.id === rec.id);
  const old = i >= 0 ? data.meds[i] : null;
  const when = f.effective.value || todayISO();
  rec.changes = [...(old?.changes || [])];
  const ch = (kind) => rec.changes.push({ id: uid(), date: when, kind, dose: rec.dose, unit: rec.unit });
  if (!old) ch(rec.active ? 'start' : 'stop');
  else if (old.active === false && rec.active) ch('start');
  else if (old.active !== false && !rec.active) ch('stop');
  else if (rec.active && (old.dose !== rec.dose || old.unit !== rec.unit)) ch('dose');
  rec.changes.sort((a, b) => a.date.localeCompare(b.date));
  if (i >= 0) data.meds[i] = rec; else data.meds.push(rec);
  if (medFromLog && f.lognow.checked) logDose(rec);
  save(); refreshActive();
});
$('#med-delete').addEventListener('click', () => {
  if (!confirm('Delete this medication from your list? Doses already logged stay in your history. (Tip: untick "Currently taking" instead.)')) return;
  data.meds = data.meds.filter((x) => x.id !== editingMed);
  save(); medDlg.close('deleted'); refreshActive();
});

const KIND_LABEL = { start: 'Started', dose: 'Dose change', stop: 'Stopped' };
function renderMedHistory(m) {
  if (!m.id) { $('#med-history').innerHTML = ''; return; }
  const evs = medEvents().filter((e) => e.medId === m.id);
  $('#med-history').innerHTML = `<div class="hist"><b>Change history</b> <span class="muted">(shown on the pain chart · edits save right away)</span>
    ${evs.map((e) => `<div class="hist-row" data-change="${e.changeId || ''}" data-derived="${e.changeId ? '' : '1'}">
        <select data-k="kind" aria-label="Type of change">${Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}" ${k === e.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input type="date" data-k="date" value="${e.date}" aria-label="Date">
        <input data-k="dose" value="${esc(e.dose || '')}" placeholder="dose" inputmode="decimal" aria-label="Dose" ${e.kind === 'stop' ? 'disabled' : ''}>
        <button type="button" data-rmchange aria-label="Remove change">✕</button>
      </div>`).join('') || '<div class="empty-sm">No changes recorded yet.</div>'}
    <button type="button" class="copy-prev" id="add-change">+ Add a past change</button>
    ${evs.some((e) => !e.changeId) ? '<div class="muted small">The "Started" row without a recorded date comes from your first logged dose. Editing it saves it as a real entry.</div>' : ''}
  </div>`;
}
function medForEdit() { const m = data.meds.find((x) => x.id === editingMed); m.changes = m.changes || []; return m; }
// Turn a derived "first dose" row into a stored change so it can be edited/removed
function materialize(m, row) {
  if (row.dataset.change) return m.changes.find((c) => c.id === row.dataset.change);
  const ev = medEvents().find((e) => e.medId === m.id && !e.changeId);
  const c = { id: uid(), date: ev.date, kind: 'start', dose: ev.dose || '', unit: ev.unit || m.unit || '' };
  m.changes.push(c);
  return c;
}
$('#med-history').addEventListener('change', (ev) => {
  const k = ev.target.dataset.k; if (!k) return;
  const m = medForEdit(); const row = ev.target.closest('.hist-row');
  const c = materialize(m, row);
  c[k] = ev.target.value.trim();
  if (!c.date) c.date = todayISO();
  m.changes.sort((a, b) => a.date.localeCompare(b.date));
  save(); renderMedHistory(m);
});
$('#med-history').addEventListener('click', (ev) => {
  const m = editingMed && medForEdit(); if (!m) return;
  if (ev.target.id === 'add-change') {
    m.changes.push({ id: uid(), date: todayISO(), kind: 'dose', dose: medForm.elements.dose.value.trim(), unit: medForm.elements.unit.value.trim() });
    m.changes.sort((a, b) => a.date.localeCompare(b.date));
    save(); renderMedHistory(m); return;
  }
  const b = ev.target.closest('[data-rmchange]'); if (!b) return;
  const row = b.closest('.hist-row');
  if (row.dataset.derived) {
    // hide the derived start by storing an explicit start the user can see; removing it = mark as ignored
    m.ignoreFirstDose = true;
  } else m.changes = m.changes.filter((c) => c.id !== row.dataset.change);
  save(); renderMedHistory(m);
});
// All medication changes as chart events. Meds without a recorded start
// (added before change tracking existed) use their first logged dose.
function medEvents() {
  const first = {};
  for (const d of Object.keys(data.entries).sort()) {
    for (const t of data.entries[d].meds || []) if (t.medId && !first[t.medId]) first[t.medId] = { date: d, dose: t.dose, unit: t.unit };
  }
  const out = [];
  for (const m of data.meds) {
    const changes = m.changes || [];
    if (!m.ignoreFirstDose && !changes.some((c) => c.kind === 'start') && first[m.id]) {
      const f = first[m.id];
      out.push({ medId: m.id, date: f.date, kind: 'start', dose: f.dose, unit: f.unit, label: `Started ${m.name} ${[f.dose, f.unit].filter(Boolean).join(' ')}`.trim() });
    }
    for (const c of changes) {
      const dose = [c.dose, c.unit || m.unit].filter((v) => v).join(' ');
      const label = c.kind === 'start' ? `Started ${m.name} ${dose}` : c.kind === 'stop' ? `Stopped ${m.name}` : `${m.name} dose → ${dose}`;
      out.push({ medId: m.id, changeId: c.id, date: c.date, kind: c.kind, dose: c.dose, unit: c.unit, label: label.trim() });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const exDlg = $('#ex-dialog'), exForm = $('#ex-form');
let editingEx = null;
function openEx(id) {
  editingEx = id;
  const x = id ? data.exercises.find((e) => e.id === id) : {};
  exForm.reset();
  $('#ex-dialog-title').textContent = id ? 'Edit exercise' : 'New home exercise';
  $('#ex-delete').style.display = id ? '' : 'none';
  for (const k of ['name', 'detail', 'target', 'notes']) exForm.elements[k].value = x[k] || '';
  exForm.elements.active.checked = x.active !== false;
  exDlg.returnValue = '';
  exDlg.showModal();
}
exDlg.addEventListener('close', () => {
  if (exDlg.returnValue !== 'save') return;
  const f = exForm.elements;
  const rec = { id: editingEx || uid(), name: f.name.value.trim(), detail: f.detail.value.trim(), target: f.target.value ? Number(f.target.value) : '', notes: f.notes.value.trim(), active: f.active.checked };
  if (!rec.name) return;
  const i = data.exercises.findIndex((x) => x.id === rec.id);
  if (i >= 0) data.exercises[i] = rec; else data.exercises.push(rec);
  save(); refreshActive();
});
$('#ex-delete').addEventListener('click', () => {
  if (!confirm('Delete this exercise and its logged sessions? (Tip: untick "Currently doing" to keep the history.)')) return;
  data.exercises = data.exercises.filter((x) => x.id !== editingEx);
  for (const d of Object.keys(data.entries)) {
    const e = data.entries[d];
    if (e.exercises) { delete e.exercises[editingEx]; pruneEntry(d); }
  }
  save(); exDlg.close('deleted'); refreshActive();
});

function renderManageLists() {
  const sortActive = (a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name);
  $('#med-list').innerHTML = data.meds.length ? [...data.meds].sort(sortActive).map((m) => `<div class="list-item ${m.active === false ? 'inactive' : ''}" data-id="${m.id}">
      <div><b>${esc(m.name)}</b> ${esc(doseLabel(m))}<div class="muted">${esc(m.schedule || '')}${m.active === false ? ' (stopped)' : ''}</div></div><span class="muted">Edit ›</span></div>`).join('')
    : '<div class="empty-sm">No medications yet.</div>';
  $('#ex-list').innerHTML = data.exercises.length ? [...data.exercises].sort(sortActive).map((x) => `<div class="list-item ${x.active === false ? 'inactive' : ''}" data-id="${x.id}">
      <div><b>${esc(x.name)}</b> <span class="muted">${esc(x.detail || '')}${x.target ? ' · ' + x.target + '×/day' : ''}</span><div class="muted">${esc(x.notes || '')}${x.active === false ? ' (retired)' : ''}</div></div><span class="muted">Edit ›</span></div>`).join('')
    : '<div class="empty-sm">No exercises yet.</div>';
}
$('#med-list').addEventListener('click', (ev) => { const r = ev.target.closest('[data-id]'); if (r) openMed(r.dataset.id); });
$('#ex-list').addEventListener('click', (ev) => { const r = ev.target.closest('[data-id]'); if (r) openEx(r.dataset.id); });
$('#add-med').addEventListener('click', () => openMed(null));
$('#add-ex').addEventListener('click', () => openEx(null));

$('#slots').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const card = btn.closest('[data-slot]');
  const slot = card.dataset.slot;
  if ('toggle' in btn.dataset) {
    openSlots.has(slot) ? openSlots.delete(slot) : openSlots.add(slot);
    return renderLog();
  }
  const wasComplete = slotComplete(currentDate, slot), dayBefore = SLOTS.every((x) => slotComplete(currentDate, x.id));
  if (btn.dataset.copy) {
    const src = getSlot(currentDate, btn.dataset.copy);
    if (!src || AREAS.every((a) => src[a.id] == null)) return;
    const dst = getSlot(currentDate, slot, true);
    AREAS.forEach((a) => (dst[a.id] = src[a.id]));
  } else if (btn.dataset.v != null) {
    const area = btn.closest('.scale').dataset.area;
    const v = Number(btn.dataset.v);
    const s = getSlot(currentDate, slot, true);
    s[area] = s[area] === v ? null : v; // tap again to clear
  } else return;
  pruneEntry(currentDate);
  save();
  renderLog();
  celebrateCheckin(currentDate, slot, wasComplete, dayBefore);
});
$('#slots').addEventListener('input', (ev) => {
  if (!ev.target.matches('[data-note]')) return;
  const slot = ev.target.closest('[data-slot]').dataset.slot;
  getSlot(currentDate, slot, true).note = ev.target.value;
  pruneEntry(currentDate);
  save();
});
$('#day-note').addEventListener('input', (ev) => {
  getEntry(currentDate, true).note = ev.target.value;
  pruneEntry(currentDate);
  save();
});
dateInput.addEventListener('change', () => { if (dateInput.value) { currentDate = dateInput.value > todayISO() ? todayISO() : dateInput.value; renderLog(); } });
dateInput.addEventListener('click', () => { try { dateInput.showPicker(); } catch (e) { /* older browsers open it themselves */ } });
$('#jump-today').addEventListener('click', () => { currentDate = todayISO(); renderLog(); });
$('#prev-day').addEventListener('click', () => { currentDate = addDays(currentDate, -1); renderLog(); });
$('#next-day').addEventListener('click', () => { if (currentDate < todayISO()) { currentDate = addDays(currentDate, 1); renderLog(); } });

/* ---------- Analytics ---------- */
// value for one day + area according to metric ('avg' or a slot id)
function dayValue(date, area, metric) {
  const e = data.entries[date];
  if (!e) return null;
  if (metric === 'avg') return mean(SLOTS.map((s) => e[s.id]?.[area]).filter((v) => v != null));
  return e[metric]?.[area] ?? null;
}
function rangeDates(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
function firstDate() {
  const all = [...Object.keys(data.entries), ...data.appointments.map((a) => a.date)].filter((d) => d <= todayISO()).sort();
  return all[0] || todayISO();
}
function hasPain(date) {
  const e = data.entries[date];
  return !!e && SLOTS.some((s) => e[s.id] && AREAS.some((a) => e[s.id][a.id] != null));
}
function periodMean(dates, area, metric) {
  return mean(dates.map((d) => dayValue(d, area, metric)).filter((v) => v != null));
}

/* ---------- Overview ---------- */
let range = '30';
let metric = 'avg';
$('#range-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  range = b.dataset.range;
  $$('#range-seg button').forEach((x) => x.classList.toggle('on', x === b));
  renderOverview();
});
$('#metric-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  metric = b.dataset.metric;
  $$('#metric-seg button').forEach((x) => x.classList.toggle('on', x === b));
  renderOverview();
});

function currentRange() {
  const end = todayISO();
  if (range === 'all') {
    let start = firstDate();
    if (daysBetween(start, end) < 6) start = addDays(end, -6);
    return [start, end];
  }
  return [addDays(end, -(Number(range) - 1)), end];
}

function renderOverview() {
  const [start, end] = currentRange();
  const dates = rangeDates(start, end);
  renderChart(dates);
  renderStats(dates);
  renderSlotTable(dates);
  renderSleepOverview(dates);
  renderMedsOverview(dates);
  renderExOverview(dates);
  renderSymOverview(dates);
  renderHeatmap(dates);
}

function renderSleepOverview(dates) {
  const sl = dates.map((d) => data.entries[d]?.sleep).filter(Boolean);
  const nights = sl.map((s) => s.night).filter((v) => v != null);
  const naps = sl.map((s) => s.nap).filter((v) => v != null);
  const woke = dates.filter((d) => data.entries[d]?.symptoms?.includes('Woke up due to sciatica pain')).length;
  if (!nights.length && !naps.length && !woke) { $('#ov-sleep').innerHTML = '<div class="empty-sm">No sleep logged in this period.</div>'; return; }
  // pain on short vs long nights (needs a few nights of each)
  const painOf = (d) => mean(AREAS.map((a) => dayValue(d, a.id, 'avg')).filter((v) => v != null));
  const short = [], long = [];
  dates.forEach((d) => { const h = data.entries[d]?.sleep?.night, p = painOf(d); if (h == null || p == null) return; (h < 6 ? short : h >= 7 ? long : []).push(p); });
  const cmp = short.length >= 3 && long.length >= 3
    ? `<p class="muted small">Average pain after short nights (&lt;6h): <b>${fmt(mean(short))}</b> · after 7h+: <b>${fmt(mean(long))}</b></p>` : '';
  $('#ov-sleep').innerHTML = `<div class="stats">
      <div class="stat"><div class="k">Avg night</div><div class="n">${fmtHours(mean(nights))}</div><div class="k">${nights.length} nights logged</div></div>
      <div class="stat"><div class="k">Avg naps</div><div class="n">${fmtHours(mean(naps))}</div><div class="k">${naps.filter(Boolean).length} days with naps</div></div>
      <div class="stat"><div class="k">Woken by pain</div><div class="n">${woke}</div><div class="k">of ${dates.length} nights</div></div>
    </div>${cmp}`;
}

function renderMedsOverview(dates) {
  const by = new Map(); // key: med name
  dates.forEach((d) => (data.entries[d]?.meds || []).forEach((t) => {
    const k = t.medId || t.name;
    const r = by.get(k) || { name: t.name, unit: t.unit, days: new Set(), doses: 0, total: 0, numeric: true };
    r.days.add(d); r.doses++;
    const n = parseFloat(String(t.dose).replace(',', '.'));
    if (isNaN(n)) r.numeric = false; else r.total += n;
    by.set(k, r);
  }));
  const n = dates.length;
  $('#ov-meds').innerHTML = by.size ? [...by.values()].sort((a, b) => b.doses - a.doses).map((r) => `<div class="ov-row">
      <div class="top"><b>${esc(r.name)}</b><span class="muted">${r.days.size} of ${n} days</span></div>
      <div class="muted small">${r.doses} dose${r.doses > 1 ? 's' : ''}${r.numeric && r.total ? ` · avg ${+(r.total / r.days.size).toFixed(r.total / r.days.size >= 10 ? 0 : 1)} ${esc(r.unit || '')} on days taken` : ''}</div>
      <div class="bar"><i style="width:${(r.days.size / n) * 100}%"></i></div></div>`).join('')
    : '<div class="empty-sm">No medication logged in this period.</div>';
}

function renderExOverview(dates) {
  const n = dates.length;
  const list = data.exercises.filter((x) => x.active !== false || dates.some((d) => data.entries[d]?.exercises?.[x.id]));
  $('#ov-ex').innerHTML = list.length ? list.map((x) => {
    const counts = dates.map((d) => data.entries[d]?.exercises?.[x.id] || 0);
    const days = counts.filter(Boolean).length;
    const sessions = counts.reduce((a, b) => a + b, 0);
    const target = Number(x.target) || 0;
    const pct = target ? Math.min(100, (sessions / (target * n)) * 100) : (days / n) * 100;
    return `<div class="ov-row">
      <div class="top"><b>${esc(x.name)}</b><span class="muted">${days} of ${n} days</span></div>
      <div class="muted small">${sessions} session${sessions === 1 ? '' : 's'}${target ? ` · ${Math.round(pct)}% of target (${target}×/day)` : ''}</div>
      <div class="bar"><i style="width:${pct}%;background:var(--good)"></i></div></div>`;
  }).join('') : '<div class="empty-sm">No exercises set up yet. Add them in Settings or on the Log page.</div>';
}

function renderSymOverview(dates) {
  const counts = new Map();
  const notes = [];
  dates.forEach((d) => {
    const e = data.entries[d]; if (!e) return;
    (e.symptoms || []).forEach((s) => counts.set(s, (counts.get(s) || 0) + 1));
    if (e.symptomNote) notes.push([d, e.symptomNote]);
  });
  const n = dates.length;
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s, c]) => `<div class="ov-row">
      <div class="top"><b>${esc(s)}</b><span class="muted">${c} of ${n} days</span></div>
      <div class="bar"><i style="width:${(c / n) * 100}%;background:var(--back)"></i></div></div>`).join('');
  const recent = notes.slice(-5).reverse().map(([d, t]) => `<div class="ov-row"><span class="muted small">${fmtDate(d)}</span><br>${esc(t)}</div>`).join('');
  $('#ov-sym').innerHTML = (rows || '<div class="empty-sm">No other symptoms logged in this period.</div>') +
    (recent ? `<h3 style="margin-top:14px">Recent symptom notes</h3>${recent}` : '');
}

function renderChart(dates) {
  const W = Math.max(300, Math.round($('#chart').clientWidth || 640)), H = Math.round(Math.min(280, Math.max(200, W * 0.55))), L = 26, R = 10, T = 12, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const n = dates.length;
  const x = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => T + ih - (v / 10) * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Pain chart">`;
  // grid
  for (let v = 0; v <= 10; v += 2) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>`;
    svg += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`;
  }
  // x labels
  const step = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 60))));
  dates.forEach((d, i) => {
    if (i % step === 0 || i === n - 1) {
      if (i !== n - 1 && n > 1 && x(n - 1) - x(i) < 52) return; // keep room for the last label
      svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === n - 1 && n > 1 ? 'end' : i === 0 && n > 1 ? 'start' : 'middle'}" font-size="11" fill="var(--muted)">${fmtDate(d, { day: 'numeric', month: 'short' })}</text>`;
    }
  });
  // appointment markers
  const idx = Object.fromEntries(dates.map((d, i) => [d, i]));
  data.appointments.forEach((a) => {
    if (idx[a.date] == null) return;
    const xi = x(idx[a.date]);
    svg += `<line x1="${xi}" x2="${xi}" y1="${T}" y2="${T + ih}" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width="1"><title>${esc(a.type)} ${esc(a.provider || '')}</title></line>`;
    svg += `<text x="${xi}" y="${T + 9}" text-anchor="middle" font-size="10">🗓</text>`;
  });
  // medication change markers
  medEvents().forEach((e) => {
    if (idx[e.date] == null) return;
    const xi = x(idx[e.date]) + 0.5;
    svg += `<line x1="${xi}" x2="${xi}" y1="${T}" y2="${T + ih}" stroke="${MED_COLOR}" stroke-width="1.5" opacity=".7"><title>${esc(e.label)}</title></line>`;
    svg += `<text x="${xi}" y="${T + ih - 3}" text-anchor="middle" font-size="11">💊</text>`;
  });
  // lines
  AREAS.forEach((a) => {
    let path = '', pen = false, dots = '';
    dates.forEach((d, i) => {
      const v = dayValue(d, a.id, metric);
      if (v == null) { pen = false; return; }
      path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
      if (n <= 45) dots += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${a.color}"><title>${a.name} ${fmtDate(d)}: ${fmt(v)}</title></circle>`;
    });
    svg += `<path d="${path}" fill="none" stroke="${a.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  });
  svg += '</svg>';
  const hasData = dates.some(hasPain);
  $('#chart').innerHTML = hasData ? svg : '<div class="empty">No pain logged in this period yet.</div>';
  $('#legend').innerHTML = AREAS.map((a) => `<span><i style="background:${a.color}"></i>${a.name}</span>`).join('') +
    '<span class="muted">🗓 = appointment</span><span class="muted">💊 = medication change</span>';
  renderSleepChart(dates, { L, R, W });
  renderChartEvents(dates);
}

function renderSleepChart(dates, { L, R, W }) {
  const vals = dates.map((d) => data.entries[d]?.sleep || {});
  if (!vals.some((v) => v.night != null || v.nap != null)) { $('#sleep-chart').innerHTML = ''; return; }
  const H = 96, T = 6, B = 4, ih = H - T - B, iw = W - L - R, n = dates.length, MAX = 12;
  const slot = iw / n, bw = Math.max(2, Math.min(16, slot * 0.7));
  const cx = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (h) => T + ih - (Math.min(h, MAX) / MAX) * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sleep chart">`;
  for (const h of [0, 4, 8, 12]) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(h)}" y2="${y(h)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(h) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${h}h</text>`;
  }
  vals.forEach((v, i) => {
    const night = v.night || 0, nap = v.nap || 0;
    if (!night && !nap) return;
    const x0 = Math.min(Math.max(cx(i) - bw / 2, L), W - R - bw);
    const tip = `${fmtDate(dates[i])}: night ${fmtHours(v.night)}, naps ${fmtHours(v.nap)}`;
    if (night) svg += `<rect x="${x0}" y="${y(night)}" width="${bw}" height="${y(0) - y(night)}" rx="1.5" fill="var(--sleep)"><title>${tip}</title></rect>`;
    if (nap) svg += `<rect x="${x0}" y="${y(night + nap)}" width="${bw}" height="${y(night) - y(night + nap)}" rx="1.5" fill="var(--nap)"><title>${tip}</title></rect>`;
  });
  svg += '</svg>';
  $('#sleep-chart').innerHTML = `<h4>😴 Sleep</h4>${svg}<div class="legend"><span><i style="background:var(--sleep);height:8px"></i>Night</span><span><i style="background:var(--nap);height:8px"></i>Naps</span></div>`;
}

function renderChartEvents(dates) {
  const [start, end] = [dates[0], dates[dates.length - 1]];
  const inRange = (d) => d >= start && d <= end;
  const evs = [
    ...medEvents().filter((e) => inRange(e.date)).map((e) => ({ date: e.date, icon: '💊', text: e.label })),
    ...data.appointments.filter((a) => inRange(a.date)).map((a) => ({ date: a.date, icon: '🗓', text: `${a.type}${a.provider ? ' · ' + a.provider : ''}` })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  $('#chart-events').innerHTML = evs.length ? `<h4>Events in this period</h4>${evs.map((e) => `<div class="ev"><span class="d">${fmtDate(e.date, { day: 'numeric', month: 'short' })}</span><span>${e.icon} ${esc(e.text)}</span></div>`).join('')}` : '';
}

function renderStats(dates) {
  let prev, label;
  if (range === 'all') {
    const logged = dates.filter(hasPain);
    prev = logged.slice(0, 7);
    dates = logged.slice(-7);
    label = 'last 7 logged days vs first 7';
  } else {
    const n = dates.length;
    prev = rangeDates(addDays(dates[0], -n), addDays(dates[0], -1));
    label = `vs previous ${n} days`;
  }
  $('#stats').innerHTML = `<div class="stats">${AREAS.map((a) => {
    const cur = periodMean(dates, a.id, metric);
    const p = periodMean(prev, a.id, metric);
    let delta = '';
    if (cur != null && p != null) {
      const d = cur - p;
      const cls = d < -0.05 ? 'better' : d > 0.05 ? 'worse' : '';
      delta = `<div class="d ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${Math.abs(d).toFixed(1)}</div>`;
    }
    return `<div class="stat"><div class="k" style="color:${a.color}">${a.name}</div><div class="n">${fmt(cur)}</div>${delta}</div>`;
  }).join('')}</div><p class="muted small">Average pain ${range === 'all' ? '(' + label + ')' : 'in period, ' + label}. ▼ green = improving.</p>`;
}

function renderSlotTable(dates) {
  const rows = AREAS.map((a) => `<tr><td style="color:${a.color};font-weight:600">${a.name}</td>${SLOTS.map((s) => {
    const v = periodMean(dates, a.id, s.id);
    return `<td>${v == null ? '–' : `<b style="color:${painColor(v)}">${fmt(v)}</b>`}</td>`;
  }).join('')}</tr>`).join('');
  $('#slot-table').innerHTML = `<table><thead><tr><th></th>${SLOTS.map((s) => `<th>${s.icon} ${s.name}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderHeatmap(dates) {
  const apptDates = new Set(data.appointments.map((a) => a.date));
  const cols = `grid-template-columns: repeat(${dates.length}, 1fr)`;
  $('#heatmap').innerHTML = `<div class="hm">${AREAS.map((a) => `<div>${a.name}</div><div class="hm-row" style="${cols}">${dates.map((d) => {
    const v = dayValue(d, a.id, metric);
    return `<div class="hm-cell ${apptDates.has(d) ? 'appt' : ''}" title="${fmtDate(d)}: ${fmt(v)}" style="${v != null ? `background:${painColor(v)}` : ''}"></div>`;
  }).join('')}</div>`).join('')}
  <div>Exercises</div><div class="hm-row" style="${cols}">${dates.map((d) => {
    const ex = data.entries[d]?.exercises || {};
    const sessions = Object.values(ex).reduce((a, b) => a + b, 0);
    const target = data.exercises.filter((x) => x.active !== false).reduce((a, x) => a + (Number(x.target) || 1), 0) || 1;
    const r = Math.min(1, sessions / target);
    return `<div class="hm-cell" title="${fmtDate(d)}: ${sessions} exercise session(s)" style="${sessions ? `background:color-mix(in srgb, var(--good) ${30 + r * 70}%, var(--line))` : ''}"></div>`;
  }).join('')}</div>
  <div>Medication</div><div class="hm-row" style="${cols}">${dates.map((d) => {
    const c = (data.entries[d]?.meds || []).length;
    return `<div class="hm-cell" title="${fmtDate(d)}: ${c} dose(s)" style="${c ? `background:color-mix(in srgb, var(--med) ${30 + Math.min(c, 5) * 14}%, var(--line))` : ''}"></div>`;
  }).join('')}</div></div>
  <p class="muted small">Pain: green = low, red = high. Outlined squares are appointment days. Exercises: brighter green = closer to your daily target. Medication: brighter yellow = more doses.</p>`;
}

/* ---------- Appointments ---------- */
function painAround(date) {
  // avg of all areas on the 3 days before vs the 3 days after (incl. not the day itself)
  const before = rangeDates(addDays(date, -3), addDays(date, -1));
  const after = rangeDates(addDays(date, 1), addDays(date, 3));
  const m = (ds) => mean(AREAS.map((a) => periodMean(ds, a.id, 'avg')).filter((v) => v != null));
  return { before: m(before), after: m(after) };
}

function renderAppointments() {
  const list = [...data.appointments].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  if (!list.length) {
    $('#appt-list').innerHTML = '<div class="empty">No appointments yet.<br>Add physio, doctor or other visits to see them on your pain chart.</div>';
    return;
  }
  const today = todayISO();
  let html = '', lastGroup = '';
  list.forEach((a) => {
    const group = a.date > today ? 'Upcoming' : fromISO(a.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (group !== lastGroup) { html += `<div class="month-h">${group}</div>`; lastGroup = group; }
    const ctx = painAround(a.date);
    const ctxHtml = a.date <= today && (ctx.before != null || ctx.after != null)
      ? `<div class="pain-ctx">Avg pain 3 days before: <b>${fmt(ctx.before)}</b> → 3 days after: <b>${fmt(ctx.after)}</b></div>` : '';
    html += `<div class="card appt" data-id="${a.id}">
      <div class="top"><span class="type">${esc(a.type)}</span><span class="when">${fmtLong(a.date)}${a.time ? ' · ' + esc(a.time) : ''}</span></div>
      ${a.provider ? `<div class="muted">${esc(a.provider)}</div>` : ''}
      ${txTags(a)}
      ${a.treatment ? `<p><span class="k">Treatment</span><br>${esc(a.treatment)}</p>` : ''}
      ${a.homework ? `<p><span class="k">Homework</span><br>${esc(a.homework)}</p>` : ''}
      ${a.notes ? `<p><span class="k">Notes</span><br>${esc(a.notes)}</p>` : ''}
      ${ctxHtml}
    </div>`;
  });
  $('#appt-list').innerHTML = html;
  $$('#appt-list .appt').forEach((el) => el.addEventListener('click', () => openAppt(el.dataset.id)));
}

const TREATMENTS = [
  'Manual therapy', 'Dry needling', 'Acupuncture', 'Massage / relaxation', 'Exercise therapy',
  'Mobilisation / manipulation', 'Nerve mobilisation', 'Heat / TENS', 'Taping', 'Advice / education',
];
const txTags = (a) => (a.treatments?.length ? `<div class="tx-tags">${a.treatments.map((t) => `<span class="tx-tag">${esc(t)}</span>`).join('')}</div>` : '');
let apptTx = new Set();
function renderTxChips() {
  $('#appt-tx').innerHTML = TREATMENTS.map((t) => `<button type="button" class="chip ${apptTx.has(t) ? 'on' : ''}" data-tx="${esc(t)}">${esc(t)}</button>`).join('');
}
$('#appt-tx').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tx]'); if (!b) return;
  apptTx.has(b.dataset.tx) ? apptTx.delete(b.dataset.tx) : apptTx.add(b.dataset.tx);
  renderTxChips();
});
const dlg = $('#appt-dialog');
const form = $('#appt-form');
let editingId = null;
function openAppt(id, date) {
  editingId = id;
  const a = id ? data.appointments.find((x) => x.id === id) : null;
  form.reset();
  $('#appt-dialog-title').textContent = a ? 'Edit appointment' : 'New appointment';
  $('#appt-delete').style.display = a ? '' : 'none';
  const last = data.appointments[data.appointments.length - 1];
  const vals = a || { date: date || todayISO(), type: last?.type || 'Physiotherapy', provider: last?.provider || '' };
  for (const k of ['date', 'time', 'type', 'provider', 'treatment', 'homework', 'notes']) {
    if (form.elements[k]) form.elements[k].value = vals[k] || '';
  }
  apptTx = new Set(a?.treatments || []);
  renderTxChips();
  dlg.returnValue = '';
  dlg.showModal();
}
$('#add-appt').addEventListener('click', () => openAppt(null));
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  const f = form.elements;
  const rec = {
    id: editingId || uid(),
    date: f.date.value, time: f.time.value, type: f.type.value,
    provider: f.provider.value.trim(), treatment: f.treatment.value.trim(),
    homework: f.homework.value.trim(), notes: f.notes.value.trim(),
    treatments: TREATMENTS.filter((t) => apptTx.has(t)),
  };
  if (!rec.date) return;
  const i = data.appointments.findIndex((x) => x.id === rec.id);
  if (i >= 0) data.appointments[i] = rec; else data.appointments.push(rec);
  save();
  refreshActive();
});
$('#appt-delete').addEventListener('click', () => {
  if (!editingId || !confirm('Delete this appointment?')) return;
  data.appointments = data.appointments.filter((x) => x.id !== editingId);
  save();
  dlg.close('deleted');
  refreshActive();
});
function refreshActive() {
  // re-render the current view without jumping to the top
  const v = $('.view.active').id.replace('view-', '');
  ({ log: renderLog, overview: renderOverview, appts: renderAppointments, settings: renderManageLists })[v]?.();
}

/* ---------- Settings: export / import ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export-json').addEventListener('click', () =>
  download(`pain-tracker-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json'));
$('#export-csv').addEventListener('click', () => {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = ['date,time_of_day,right_leg,left_leg,lower_back,slot_note,day_note,appointments,medication,exercises,exercise_note,symptoms,symptom_note,sleep_night_h,naps_h'];
  const exName = (id) => data.exercises.find((x) => x.id === id)?.name || id;
  Object.keys(data.entries).sort().forEach((d) => {
    const e = data.entries[d];
    const appts = data.appointments.filter((a) => a.date === d).map((a) => `${a.type}${a.treatments?.length ? ' [' + a.treatments.join(', ') + ']' : ''}${a.treatment ? ': ' + a.treatment : ''}`).join(' | ');
    SLOTS.forEach((s) => {
      const v = e[s.id] || {};
      const meds = (e.meds || []).map((t) => `${t.time ? t.time + ' ' : ''}${t.name} ${[t.dose, t.unit].filter(Boolean).join(' ')}`.trim()).join(' | ');
      const ex = Object.entries(e.exercises || {}).map(([id, c]) => `${exName(id)} x${c}`).join(' | ');
      lines.push([d, s.id, v.right ?? '', v.left ?? '', v.back ?? '', q(v.note), q(e.note), q(appts), q(meds), q(ex), q(e.exNote), q((e.symptoms || []).join(' | ')), q(e.symptomNote), e.sleep?.night ?? '', e.sleep?.nap ?? ''].join(','));
    });
  });
  download(`pain-log-${todayISO()}.csv`, lines.join('\n'), 'text/csv');
});
$('#import-json').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d.entries || !Array.isArray(d.appointments)) throw new Error('bad format');
    if (!confirm('Replace all current data with this backup?')) return;
    data = migrate(d);
    save();
    alert('Backup restored.');
  } catch (e) {
    alert('Could not read that file. Is it a Pain Tracker backup?');
  } finally {
    ev.target.value = '';
  }
});
$('#print-report').addEventListener('click', () => {
  showView('overview');
  renderAppointments();
  setTimeout(() => window.print(), 300);
});
$('#wipe').addEventListener('click', () => {
  if (!confirm('Delete ALL pain entries and appointments? Export a backup first if unsure.')) return;
  if (!confirm('Are you really sure? This cannot be undone.')) return;
  data = emptyData();
  save();
  showView('log');
});

/* ---------- Reminders (calendar file) ---------- */
// Web apps can't schedule notifications on their own (that needs a push server),
// so we create repeating calendar events with an alert: works on every phone.
const REM_KEY = 'paintracker.reminders';
function loadReminderTimes() {
  try { return JSON.parse(localStorage.getItem(REM_KEY)) || {}; } catch (e) { return {}; }
}
(() => {
  const t = loadReminderTimes();
  for (const s of SLOTS) {
    const el = $(`#rem-${s.id}`);
    if (t[s.id]) el.value = t[s.id];
    el.addEventListener('change', () => {
      const cur = loadReminderTimes(); cur[s.id] = el.value;
      try { localStorage.setItem(REM_KEY, JSON.stringify(cur)); } catch (e) { /* ignore */ }
    });
  }
})();
function buildICS() {
  const appUrl = location.href.split('#')[0].split('?')[0];
  const start = todayISO().replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pain Tracker//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const s of SLOTS) {
    const t = ($(`#rem-${s.id}`).value || '08:00').replace(':', '');
    lines.push('BEGIN:VEVENT',
      `UID:paintracker-${s.id}-${start}@local`, `DTSTAMP:${stamp}`,
      `DTSTART:${start}T${t}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
      `SUMMARY:${s.icon} Pain check-in (${s.name.toLowerCase()})`,
      `DESCRIPTION:3 taps: right leg\\, left leg\\, back. Keep your streak going! ${appUrl}`,
      `URL:${appUrl}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${s.name} pain check-in`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
$('#add-reminders').addEventListener('click', () => download('pain-tracker-reminders.ics', buildICS(), 'text/calendar'));

/* ---------- Theme ---------- */
function applyTheme(t) {
  try { localStorage.setItem('paintracker.theme', t); } catch (e) { /* ignore */ }
  const eff = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  document.documentElement.dataset.theme = eff;
  $('meta[name=theme-color]').content = eff === 'light' ? '#f6f3fb' : '#14111b';
  $$('#theme-seg button').forEach((b) => b.classList.toggle('on', b.dataset.theme === t));
}
$('#theme-seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { applyTheme(b.dataset.theme); refreshActive(); } });
applyTheme((() => { try { return localStorage.getItem('paintracker.theme') || 'dark'; } catch (e) { return 'dark'; } })());

/* ---------- Boot ---------- */
// keep "today" fresh if app stays open overnight
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && $('#view-log').classList.contains('active')) renderLog();
});
renderLog();
checkBadges(); // first run marks already-earned badges as seen
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if ($('#view-overview').classList.contains('active')) renderOverview(); }, 150);
});
