# KanaSensei かな先生

> An engineering approach to mastering Japanese kana — built for the **MEXT Scholarship 2028** application.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Firebase%20Hosting-bc002d?style=flat-square)](https://kanasensei-f78fc.web.app)
[![PWA](https://img.shields.io/badge/PWA-Installable-2d9e5a?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-b8860b?style=flat-square)](LICENSE)

---

## Overview

Most learners abandon Japanese kana within two weeks — not because the characters are hard, but because traditional flashcard apps offer no feedback loop and no motivation to return. **KanaSensei** addresses this by combining a scientifically-grounded **Spaced Repetition System (SRS)** with arcade-style game modes and real-time global statistics, transforming a dry memorisation task into a structured, engaging educational platform.

The project was designed with a single measurable goal: **reduce the time to full kana fluency from the typical 4–6 weeks to under 10 days of consistent daily sessions**, by optimising review scheduling around the human forgetting curve.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Vanilla JS (ES Modules) | Zero build-step — runs natively in the browser, maximising transparency for academic review |
| Styling | Custom CSS (design tokens) | Washi-paper aesthetic with CSS custom properties for consistent theming |
| Auth | Firebase Authentication | Google Sign-In with a single `signInWithPopup` call; no backend required |
| Database | Firebase Firestore | Per-user SRS progress persisted in the cloud; merge writes prevent data loss |
| Realtime | Firebase Realtime Database | Sub-100ms latency for the live global activity feed and presence system |
| Hosting | Firebase Hosting | Global CDN, automatic HTTPS, one-command deploy (`firebase deploy`) |
| Offline | Service Worker (Cache API) | App shell cached on install; stale-while-revalidate for content, network-only for Firebase |

---

## Key Engineering Features

### 1 · Spaced Repetition System (SRS)

The core of KanaSensei is a custom SRS engine (`js/engine.js`) inspired by the **SuperMemo SM-2** algorithm and Ebbinghaus's forgetting curve research.

Each kana character is assigned a **stage (1–8)**. A correct answer advances the stage; an incorrect answer penalises it (−2 stages above stage 4, −1 below). Each stage maps to a review interval that doubles approximately every step:

```
Stage 1 →  4 hours
Stage 2 →  8 hours
Stage 3 →  1 day
Stage 4 →  2 days
Stage 5 →  1 week
Stage 6 →  2 weeks
Stage 7 →  1 month
Stage 8 →  4 months  (≈ "mastered")
```

Card selection prioritises **overdue reviews** (sorted by oldest due date), then **unseen cards**, then free practice — ensuring the learner always works on what their long-term memory needs most.

### 2 · Difficulty System

Four difficulty presets alter timer pressure, retry allowance, XP penalties, and life drain, making the same content accessible to beginners (Scholar) and challenging for advanced learners (Oni Lord):

| Mode | Timer | Retries | XP penalty | Life drain |
|---|---|---|---|---|
| 📖 Scholar | — | ∞ | 0 | ✗ |
| ⚔️ Samurai | 5 s | 1 | 0 | ✗ |
| 🔥 Demon | 3 s | 0 | −5 | ✗ |
| 👹 Oni Lord | 2 s | 0 | −10 | ✓ |

### 3 · Real-time Live Dashboard

Built on **Firebase Realtime Database** — no Cloud Functions, no server — the live dashboard displays:

- Active users in the last 5 minutes (presence via `serverTimestamp`)
- Total global learners and aggregate mastered kana count
- Live activity feed (answers, level-ups, boss victories) with sub-second latency
- Personal XP chart for the last 7 days (Chart.js)

The entire presence system is a client-side `onValue` subscription — a deliberate architectural choice to stay within the **Spark (free) plan** while still delivering real-time UX.

### 4 · Progressive Web App

KanaSensei is fully installable on mobile and desktop via the Web App Manifest and a Service Worker that implements **stale-while-revalidate** for the app shell and **network-only** for all Firebase traffic, ensuring data is always fresh while the UI loads instantly from cache.

### 5 · Zero-dependency Audio Engine

Sound effects (correct answer, wrong answer, meteor explosion, countdown tick) are synthesised at runtime using the **Web Audio API** — no audio files to load, no external dependencies, no latency.

---

## Project Structure

```
public/
├── index.html              # Landing page (bilingual EN/PL)
├── app.html                # Main application shell
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching & update strategy
│
├── css/
│   └── main.css            # Design tokens, layout, all component styles
│
└── js/
    ├── config.js           # Firebase initialisation (replace placeholders)
    ├── auth.js             # Google Sign-In / Sign-Out wiring
    ├── db.js               # Firestore data layer (read / write helpers)
    ├── engine.js           # SRS algorithm — card draw, answer checking
    ├── data.js             # Kana & vocabulary datasets
    ├── live-dashboard.js   # Firebase Realtime Database — presence + feed
    └── main.js             # Application controller — routing, all game modes
```

> **Architecture principle:** each module has a single responsibility and is imported by `main.js` only. No circular dependencies. No bundler needed — ES Modules resolve natively in every modern browser.

---

## Game Modes

| Mode | Description |
|---|---|
| 🎯 Training Arena | SRS-driven flashcard drill with shodō (書道) practice canvas |
| ☄️ Kana Meteors | Arcade typing — shoot falling kana before they reach the ground |
| ⚡ Speed Run | How many kana can you correctly read in 60 seconds? |
| 🀄 Kana Pairs | Match kana to romaji — memory card game format |
| 👹 Boss Fight | Defeat the Yokai Demon by correctly reading dakuten characters |
| 語彙 Vocabulary | Japanese word recognition with Polish translations |
| 五十音 Theory | Interactive kana reference tables with TTS pronunciation |

---

## Getting Started

### Prerequisites
- A Firebase project (free Spark plan is sufficient)
- Firebase CLI: `npm install -g firebase-tools`

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/kanasensei.git
cd kanasensei

# 2. Add your Firebase credentials
#    Edit public/js/config.js and replace the placeholder values

# 3. Create a Realtime Database in Firebase Console
#    Set rules:
#    { "rules": { ".read": true, ".write": "auth != null" } }

# 4. Deploy
firebase login
firebase init hosting
firebase deploy
```

---

## Roadmap

Continuous improvement is core to this project — inspired by the Japanese principle of **改善 (kaizen)**.

- [ ] **AI handwriting recognition** — Claude Vision API integration for shodō canvas feedback (pending backend proxy for API key security)
- [ ] **JLPT N5 vocabulary module** — expand from 10 demo words to the full N5 word list (~800 entries)
- [ ] **Yomigana (furigana) mode** — display kanji with hiragana reading guides
- [ ] **Streak recovery system** — allow users to repair a broken streak with bonus review sessions
- [ ] **Offline-first SRS sync** — queue Firestore writes when offline, flush on reconnect using `enableIndexedDbPersistence`
- [ ] **Analytics dashboard** — aggregate learning curves per character to identify universally difficult kana

---

## Author

**Wiktor Waryszak**
MEXT Scholarship Applicant 2028

[![Portfolio](https://img.shields.io/badge/Portfolio-waryszak.dev-bc002d?style=flat-square)](https://portfolio-8cbmts5em-wikok9014-4871s-projects.vercel.app/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-wiktorwaryszak-0077b5?style=flat-square)](https://www.linkedin.com/in/wiktor-waryszak-8427613b4/)
[![GitHub](https://img.shields.io/badge/GitHub-yourusername-1a1008?style=flat-square)](https://github.com/Radian20Hz)

---

*Built with ❤️ and 🍵 — 頑張ってください*
