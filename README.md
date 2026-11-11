# Pain Tracker

A small app for tracking sciatica and lower-back pain (L5/S1 herniation) through the day, along with physiotherapy and doctor appointments.

## Features

- **Log**: score pain from 0 to 10 for the **right leg**, **left leg** and **lower back**, three times a day:
  morning (after waking up), afternoon, and evening (before bed). Tap a number to set it and tap it again to clear it.
  "Same as morning" copies the previous scores. There is an optional note per time of day and one for the whole day.
- **Appointments**: physio, GP, specialist, imaging, injections and so on. Each one stores the provider, the treatment you received, homework exercises and notes.
  Every appointment also shows your average pain for the **3 days before and the 3 days after** it, so you can see whether a treatment helped.
- **Overview**: a trend chart for 7, 30 or 90 days or all time, with appointments marked on it. You can switch between the daily average and morning, afternoon or evening only.
  It also shows the period average compared with the previous period, averages by time of day, and a daily heatmap.
- **Settings**: JSON backup and restore, CSV export (for Excel or Sheets), and a print/PDF report for your doctor.

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
| `app.js` | All logic: storage, logging, charts, appointments, export |
| `sw.js` | Offline cache (bump `VERSION` after changes) |
| `manifest.webmanifest`, `icon.svg` | Installable app metadata |
