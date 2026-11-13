# Pain Tracker

A small app for tracking sciatica and lower-back pain (L5/S1 herniation) through the day, along with physiotherapy and doctor appointments.

## Features

- **Log**: score pain from 0 to 10 for the **right leg**, **left leg** and **lower back**, three times a day:
  morning (after waking up), afternoon, and evening (before bed). Tap a number to set it and tap it again to clear it.
  "Same as morning" copies the previous scores. There is an optional note per time of day and one for the whole day.
- **Sleep**: hours of night sleep (for the night before) and total naps, set with +/− buttons in 30-minute or 15-minute steps.
- **Medication**: save your medications once (name, usual dose, unit, schedule). After that, one tap logs a dose with the time. You can edit the dose or time, or remove a dose.
  When you stop taking a medication, mark it as stopped; your history is kept.
  Starting, stopping or changing the dose of a medication (with the date it took effect) is recorded and marked 💊 on the pain chart.
- **Home exercises**: save the exercises your physio gave you (sets/reps, times per day). Tap **+** after each session; an exercise is ticked ✓ when you reach the day's target. There is an optional note on how the exercises felt.
- **Other symptoms**: tap chips such as numbness, tingling, leg weakness, cramps, pain below the knee or poor sleep, and add a free-text description (where, when, how long).
- **Appointments**: physio, GP, specialist, imaging, injections and so on. Each one stores the provider, the treatment you received, homework exercises and notes.
  Every appointment also shows your average pain for the **3 days before and the 3 days after** it, so you can see whether a treatment helped.
- **Overview**: a trend chart for 7, 30 or 90 days or all time, with appointments 🗓 and medication changes 💊 marked on it, a sleep bar chart lined up underneath, and a list of events in the period. You can switch between the daily average and morning, afternoon or evening only.
  It also shows the period average compared with the previous period, averages by time of day, and a daily heatmap (including exercise and medication rows).
  There are also summaries of medication use, how well you kept up with your exercises, and how often each symptom appeared.
- **Progress & rewards**: a 🔥 streak, XP and levels, 15 badges, and a small celebration for every check-in.
  It rewards *logging*, never taking medication, and a break isn't punished: your best streak is kept and coming back earns a badge.
  The log opens on the check-in for the current time of day; the other check-ins fold into a one-line summary.
- **Reminders**: choose 3 check-in times (default 8:00 / 14:00 / 21:00) and add them to your phone's calendar as repeating daily events with an alert.
- **Settings**: dark (default, lilac and orange) or light theme, manage your medication and exercise lists, JSON backup and restore, CSV export (for Excel or Sheets), and a print/PDF report for your doctor.

Data stays **on your device** (browser localStorage). Nothing is sent anywhere. Export a backup now and then.

## Run it

It is plain HTML, CSS and JS, with no build step.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

### Put it on your phone (free)

1. On GitHub, go to repo **Settings → Pages**, set source to *Deploy from a branch*, then pick the branch and `/ (root)`.
2. Open the resulting `https://<user>.github.io/<repo>/` URL on your phone.
3. iPhone: Share → **Add to Home Screen**. Android/Chrome: menu → **Install app**.

Once installed it works offline. On iOS, use the installed home-screen app rather than a Safari tab, so the data doesn't get cleared.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Layout / views |
| `styles.css` | Styling (light and dark mode, print layout) |
| `app.js` | Main logic: storage, logging, charts, appointments, export, reminders |
| `game.js` | Streaks, XP, badges, celebrations |
| `sw.js` | Offline cache (bump `VERSION` after changes) |
| `manifest.webmanifest`, `icon.svg` | Installable app metadata |
