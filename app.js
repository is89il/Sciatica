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
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Storage ---------- */
function emptyData() { return { version: 1, entries: {}, appointments: [] }; }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && d.entries && Array.isArray(d.appointments)) return d;
  } catch (e) { /* ignore */ }
  return emptyData();
}
let data = load();
let saveTimer;
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  if (!e.note && SLOTS.every((s) => !e[s.id])) delete data.entries[date];
}

/* ---------- Navigation ---------- */
function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  if (name === 'overview') renderOverview();
  if (name === 'appts') renderAppointments();
  if (name === 'log') renderLog();
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

/* ---------- Log view ---------- */
let currentDate = todayISO();
const dateInput = $('#log-date');

function renderLog() {
  dateInput.value = currentDate;
  $('#next-day').disabled = currentDate >= todayISO();
  const entry = getEntry(currentDate) || {};

  // appointments of the day
  const appts = data.appointments.filter((a) => a.date === currentDate);
  $('#day-appts').innerHTML = appts
    .map((a) => `<div class="appt-chip" data-id="${a.id}"><span>🗓</span><div><div class="t">${esc(a.type)}${a.time ? ' · ' + esc(a.time) : ''}</div><div class="muted small">${esc(a.provider || '')}${a.treatment ? ' — ' + esc(a.treatment.slice(0, 80)) : ''}</div></div></div>`)
    .join('') +
    `<div class="row"><button class="wide" id="log-add-appt">+ Add appointment on this day</button></div>`;
  $$('#day-appts .appt-chip').forEach((el) => el.addEventListener('click', () => openAppt(el.dataset.id)));
  $('#log-add-appt').addEventListener('click', () => openAppt(null, currentDate));

  // slots
  $('#slots').innerHTML = SLOTS.map((s, i) => {
    const sv = entry[s.id] || {};
    return `<div class="card" data-slot="${s.id}">
      <div class="slot-head"><h3>${s.icon} ${s.name} <span class="hint">${s.hint}</span></h3>
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
}

$('#slots').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const card = btn.closest('[data-slot]');
  const slot = card.dataset.slot;
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
dateInput.addEventListener('change', () => { if (dateInput.value) { currentDate = dateInput.value; renderLog(); } });
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
  renderHeatmap(dates);
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
      if (i === n - 1 && i % step !== 0 && (n - 1) % step < step / 2) return;
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
  const hasData = dates.some((d) => data.entries[d]);
  $('#chart').innerHTML = hasData ? svg : '<div class="empty">No pain logged in this period yet.</div>';
  $('#legend').innerHTML = AREAS.map((a) => `<span><i style="background:${a.color}"></i>${a.name}</span>`).join('') +
    '<span class="muted">🗓 = appointment</span>';
}

function renderStats(dates) {
  let prev, label;
  if (range === 'all') {
    const logged = dates.filter((d) => data.entries[d]);
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
  }).join('')}</div>`).join('')}</div>
  <p class="muted small">Green = low pain, red = high. Outlined squares are appointment days.</p>`;
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
      <div class="top"><span class="type">${esc(a.type)}</span><span class="when">${fmtDate(a.date)}${a.time ? ' · ' + esc(a.time) : ''}</span></div>
      ${a.provider ? `<div class="muted">${esc(a.provider)}</div>` : ''}
      ${a.treatment ? `<p><span class="k">Treatment</span><br>${esc(a.treatment)}</p>` : ''}
      ${a.homework ? `<p><span class="k">Homework</span><br>${esc(a.homework)}</p>` : ''}
      ${a.notes ? `<p><span class="k">Notes</span><br>${esc(a.notes)}</p>` : ''}
      ${ctxHtml}
    </div>`;
  });
  $('#appt-list').innerHTML = html;
  $$('#appt-list .appt').forEach((el) => el.addEventListener('click', () => openAppt(el.dataset.id)));
}

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
  const v = $('.view.active').id.replace('view-', '');
  showView(v);
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
  const lines = ['date,time_of_day,right_leg,left_leg,lower_back,slot_note,day_note,appointments'];
  Object.keys(data.entries).sort().forEach((d) => {
    const e = data.entries[d];
    const appts = data.appointments.filter((a) => a.date === d).map((a) => `${a.type}${a.treatment ? ': ' + a.treatment : ''}`).join(' | ');
    SLOTS.forEach((s) => {
      const v = e[s.id] || {};
      lines.push([d, s.id, v.right ?? '', v.left ?? '', v.back ?? '', q(v.note), q(e.note), q(appts)].join(','));
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
    data = d;
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

/* ---------- Boot ---------- */
// keep "today" fresh if app stays open overnight
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && $('#view-log').classList.contains('active')) renderLog();
});
renderLog();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if ($('#view-overview').classList.contains('active')) renderOverview(); }, 150);
});
