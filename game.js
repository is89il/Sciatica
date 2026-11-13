'use strict';
/* Gamification: streaks, XP, levels, badges and small celebrations.
   Everything is derived from the logged data, so nothing can get out of sync.
   Design notes (ADHD-friendly):
   - rewards *logging*, never taking more medication or "less pain"
   - breaks are not punished: a "comeback" is a badge, best streak is kept forever
   - instant feedback on every check-in (toast + confetti)            */

const LEVEL_TITLES = [
  'Just starting', 'Getting going', 'Check-in regular', 'Steady tracker', 'Pattern spotter',
  'Data detective', 'Consistency pro', 'Recovery hero', 'Spine whisperer', 'Legend',
];
const xpForLevel = (n) => 50 * n * (n - 1); // L1 0, L2 100, L3 300, L4 600, L5 1000 …

function checkinsOn(d) {
  const e = data.entries[d];
  if (!e) return 0;
  return SLOTS.filter((s) => e[s.id] && AREAS.some((a) => e[s.id][a.id] != null)).length;
}
function slotLogged(d, slot) {
  const v = data.entries[d]?.[slot];
  return !!v && AREAS.some((a) => v[a.id] != null);
}
function slotComplete(d, slot) {
  const v = data.entries[d]?.[slot];
  return !!v && AREAS.every((a) => v[a.id] != null);
}

function gameStats() {
  const days = Object.keys(data.entries).filter((d) => d <= todayISO()).sort();
  let xp = 0, checkins = 0, fullDays = 0, mornings = 0, sleepNights = 0, exSessions = 0, comeback = false;
  let best = 0, run = 0, prev = null, perfectRun = 0, bestPerfect = 0;
  for (const d of days) {
    const e = data.entries[d];
    const c = checkinsOn(d);
    checkins += c; xp += c * 10;
    if (c === 3) { fullDays++; xp += 15; }
    if (c && e.morning) mornings++;
    if (e.sleep && (e.sleep.night != null || e.sleep.nap != null)) { sleepNights++; xp += 5; }
    for (const [id, n] of Object.entries(e.exercises || {})) {
      const ex = data.exercises.find((x) => x.id === id);
      const capped = Math.min(n, Number(ex?.target) || 3); // no extra points for overdoing it
      exSessions += n; xp += capped * 3;
    }
    if (e.symptoms?.length || e.symptomNote) xp += 2;
    if (c) {
      const gap = prev ? daysBetween(prev, d) : 1;
      if (gap > 3) comeback = true;
      run = gap === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      perfectRun = c === 3 && gap === 1 ? perfectRun + 1 : c === 3 ? 1 : 0;
      bestPerfect = Math.max(bestPerfect, perfectRun);
      prev = d;
    }
  }
  xp += data.appointments.filter((a) => a.date <= todayISO()).length * 10;

  // current streak: counts back from today; if today isn't logged yet, from yesterday
  let streak = 0;
  let d = checkinsOn(todayISO()) ? todayISO() : addDays(todayISO(), -1);
  while (checkinsOn(d)) { streak++; d = addDays(d, -1); }

  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return {
    xp, level, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    levelFrom: xpForLevel(level), levelTo: xpForLevel(level + 1),
    streak, best: Math.max(best, streak), checkins, fullDays, mornings, sleepNights, exSessions,
    bestPerfect, comeback, appts: data.appointments.length, today: checkinsOn(todayISO()),
  };
}

const BADGES = [
  { id: 'first', icon: '🌱', name: 'First step', desc: 'Log your first check-in', test: (s) => s.checkins >= 1 },
  { id: 'fullday', icon: '⭐', name: 'Full day', desc: 'All 3 check-ins in one day', test: (s) => s.fullDays >= 1 },
  { id: 'streak3', icon: '🔥', name: 'On fire', desc: '3-day streak', test: (s) => s.best >= 3 },
  { id: 'streak7', icon: '🚀', name: 'One week strong', desc: '7-day streak', test: (s) => s.best >= 7 },
  { id: 'streak14', icon: '🌙', name: 'Two weeks', desc: '14-day streak', test: (s) => s.best >= 14 },
  { id: 'streak30', icon: '👑', name: 'Monthly monarch', desc: '30-day streak', test: (s) => s.best >= 30 },
  { id: 'perfect7', icon: '💎', name: 'Perfect week', desc: '7 days in a row with all 3 check-ins', test: (s) => s.bestPerfect >= 7 },
  { id: 'early', icon: '🌅', name: 'Early bird', desc: '10 morning check-ins', test: (s) => s.mornings >= 10 },
  { id: 'c50', icon: '💯', name: 'Half century', desc: '50 check-ins', test: (s) => s.checkins >= 50 },
  { id: 'c200', icon: '🏔️', name: 'Mountain of data', desc: '200 check-ins', test: (s) => s.checkins >= 200 },
  { id: 'sleep7', icon: '😴', name: 'Sleep scientist', desc: 'Log sleep on 7 days', test: (s) => s.sleepNights >= 7 },
  { id: 'ex10', icon: '🏃', name: 'Moving it', desc: '10 exercise sessions', test: (s) => s.exSessions >= 10 },
  { id: 'ex50', icon: '🦾', name: 'Physio’s favourite', desc: '50 exercise sessions', test: (s) => s.exSessions >= 50 },
  { id: 'appt', icon: '🗓', name: 'Care team', desc: 'Log an appointment', test: (s) => s.appts >= 1 },
  { id: 'comeback', icon: '💜', name: 'Comeback', desc: 'Pick it up again after a break. Every restart counts!', test: (s) => s.comeback },
];

/* ---------- UI: progress strip, topbar streak, achievements dialog ---------- */
function renderProgress() {
  const s = gameStats();
  const pct = Math.min(100, ((s.xp - s.levelFrom) / (s.levelTo - s.levelFrom)) * 100);
  const cur = currentSlotId();
  const nextSlot = SLOTS.find((sl) => sl.id === cur && !slotComplete(todayISO(), sl.id)) || SLOTS.find((sl) => !slotComplete(todayISO(), sl.id));
  let msg;
  if (s.today === 3) msg = 'All 3 check-ins done today. Amazing! 🎉';
  else if (nextSlot) msg = `Next up: ${nextSlot.icon} ${nextSlot.name} check-in. 3 taps and done.`;
  if (!s.today && s.streak) msg = `Log today to keep your ${s.streak}-day streak going 🔥`;
  if (!s.checkins) msg = 'Start with one check-in. Tap your pain scores below.';
  $('#progress').innerHTML = `<button class="progress" id="open-achievements" aria-label="Open achievements">
      <div class="p-top">
        <span class="streak ${s.streak ? 'on' : ''}">🔥 <b>${s.streak}</b> day${s.streak === 1 ? '' : 's'}</span>
        <span class="today-dots" aria-label="${s.today} of 3 check-ins today">${SLOTS.map((sl) => `<i class="${slotLogged(todayISO(), sl.id) ? 'on' : ''}">${sl.icon}</i>`).join('')}</span>
        <span class="lvl">Lv ${s.level}</span>
      </div>
      <div class="xpbar"><i style="width:${pct}%"></i></div>
      <div class="p-msg">${msg || ''}<span class="muted"> · ${s.title} · ${s.xp} XP</span></div>
    </button>`;
  $('#topbar-streak').textContent = s.streak ? `🔥 ${s.streak}` : '';
}
document.addEventListener('click', (e) => { if (e.target.closest('#open-achievements')) openAchievements(); });

function openAchievements() {
  const s = gameStats();
  const earned = new Set(BADGES.filter((b) => b.test(s)).map((b) => b.id));
  $('#ach-body').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="k">Level ${s.level}</div><div class="n">${s.xp}</div><div class="k">XP · ${s.levelTo - s.xp} to next</div></div>
      <div class="stat"><div class="k">Streak</div><div class="n">🔥${s.streak}</div><div class="k">best ${s.best} days</div></div>
      <div class="stat"><div class="k">Check-ins</div><div class="n">${s.checkins}</div><div class="k">${s.fullDays} full days</div></div>
    </div>
    <h4>Badges · ${earned.size}/${BADGES.length}</h4>
    <div class="badges">${BADGES.map((b) => `<div class="badge ${earned.has(b.id) ? 'got' : ''}"><div class="bi">${b.icon}</div><b>${b.name}</b><span>${b.desc}</span></div>`).join('')}</div>
    <p class="muted small">How to earn XP: 10 per check-in, +15 for a full day, 5 for logging sleep, 3 per exercise session (up to your daily target), 2 for noting symptoms, 10 per appointment. Taking medication never earns points.</p>`;
  $('#ach-dialog').showModal();
}

/* ---------- Celebrations ---------- */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(html, big = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (big ? ' big' : '');
  t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), big ? 2600 : 1800);
  setTimeout(() => t.remove(), big ? 3100 : 2300);
}
function confetti(n = 28) {
  if (reduceMotion) return;
  const colors = ['var(--accent)', 'var(--accent2)', 'var(--good)', 'var(--med)', 'var(--back)'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const angle = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 160;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist - 80}px`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 80}ms`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1400);
}
const CHEERS = ['Nice one!', 'Logged!', 'Great job!', 'You’re on it!', 'Boom, done!', 'Future-you says thanks!', 'Data hero!'];
const cheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)];

// called by the log view after a pain tap, with the state before the change
function celebrateCheckin(date, slot, wasComplete, wasFullDay) {
  if (date > todayISO()) return;
  const now = slotComplete(date, slot);
  if (!wasComplete && now) {
    const s = SLOTS.find((x) => x.id === slot);
    const full = !wasFullDay && SLOTS.every((x) => slotComplete(date, x.id));
    if (full) { confetti(60); toast(`⭐ <b>Full day!</b> All 3 check-ins done · +25 XP`, true); }
    else { confetti(); toast(`${s.icon} <b>${cheer()}</b> ${s.name} check-in · +10 XP`); }
  }
}

// badge unlocks, checked after every save (debounced)
let badgeTimer;
function checkBadgesSoon() { clearTimeout(badgeTimer); badgeTimer = setTimeout(checkBadges, 400); }
function checkBadges() {
  const s = gameStats();
  data.game = data.game || {};
  const earned = BADGES.filter((b) => b.test(s)).map((b) => b.id);
  if (!data.game.seen) { data.game.seen = earned; persist(); renderProgress(); return; } // first run: no flood of popups
  const fresh = earned.filter((id) => !data.game.seen.includes(id));
  const prevLevel = data.game.level || s.level;
  fresh.forEach((id, i) => {
    const b = BADGES.find((x) => x.id === id);
    setTimeout(() => { confetti(50); toast(`${b.icon} <b>Badge unlocked: ${b.name}</b><br><span class="small">${b.desc}</span>`, true); }, 900 + i * 1200);
  });
  if (s.level > prevLevel) setTimeout(() => toast(`🆙 <b>Level ${s.level}!</b> ${s.title}`, true), 600);
  if (fresh.length || s.level !== data.game.level) {
    data.game.seen = [...new Set([...data.game.seen, ...fresh])];
    data.game.level = s.level;
    persist();
  }
  renderProgress();
}
