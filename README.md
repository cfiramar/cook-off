# Cook-Off Contest 🎃🍲

A modern, real-time interactive cooking contest platform designed for live party events. Built with React 19, TypeScript, Tailwind CSS, Vite, and Firebase Firestore.

It includes dedicated, tailored experiences for all participants:
- 📺 **Android TV / Big-Screen View Mode** — Full-screen ambient gallery, live countdown timers, anti-burn-in protection, and dramatic winner reveals with confetti.
- 📱 **Host Cockpit & Mobile App** — Real-time event orchestration, timer control, drumroll triggers, podium reveals, and full guest/meal administration.
- 📋 **Planning Dashboard** — Event organizer suite with household synchronization, grocery list calculators, and custom theme editors.
- 🗳️ **Voter Portal** — Sleek mobile rating interface for party attendees with live synchronization.

---

## 📱 Native Android & Android TV Apps

In addition to the web app, dedicated native Android wrappers are available in the [`android/`](android/) directory and compiled automatically via GitHub Actions:

| Application | Target | Purpose | Key Features |
| :--- | :--- | :--- | :--- |
| **Cook-Off TV** | Android TV / Google TV | Big screen display (`/view`) | TV Leanback launcher, remote control D-Pad navigation, auto-resume last event, keep-screen-on wake lock |
| **Cook-Off Host** | Android Phones & Tablets | Event management (`/host`) | Native camera & image chooser for meal photos, mobile-optimized host console |

### Downloading & Installing APKs
Pre-compiled APKs are attached directly to each release on the [Releases](https://github.com/cfiramar/cook-off/releases) page:
- `CookOff-AndroidTV-ViewMode.apk`
- `CookOff-Host-Mobile.apk`

> 💡 **Tip for Android TV:** Install the free **Downloader by AFTVnews** app from the Google Play Store on your TV to download and install the TV APK in seconds without needing a computer or USB drive! See [android/README.md](android/README.md) for full instructions.

---

## 📁 Modular Modes Architecture

The codebase is organized by operational mode under `src/modes/`:

```
src/
├── modes/
│   ├── view/              # 📺 Big-Screen & Android TV Mode
│   │   ├── GeneralViewDashboard.tsx   # TV Event selector with D-Pad focus & auto-resume
│   │   ├── ViewMode.tsx               # Reactive presentation, timers, and podium reveals
│   │   └── index.ts
│   ├── host/              # 🎮 Host Cockpit Mode
│   │   ├── HostMode.tsx               # Live controls, timers, reveals, biometric lock
│   │   └── index.ts
│   ├── plan/              # 📋 Planning & Administration Mode
│   │   ├── PlanningDashboard.tsx      # Multi-event management
│   │   ├── PlanningMode.tsx           # Event planning workspace
│   │   ├── components/                # Modals, grocery lists, household sync, themes
│   │   └── index.ts
│   └── vote/              # 🗳️ Attendee Voting Mode
│       ├── VotersMode.tsx             # Responsive voter flow
│       ├── components/                # Welcome, guide, login, and voting grid
│       └── index.ts
├── components/            # Shared UI components (PopupProvider, PinPad, Modals)
├── hooks/                 # Real-time Firebase listeners & reactive state
├── utils/                 # Algorithmic helpers (grocery formulas, meal pairing, themes)
└── firebase.ts            # Firebase SDK initialization
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local` and add your Firebase credentials:
```bash
cp .env.example .env.local
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

---

## 🛠️ Scripts & Deployment

- `npm run dev` — Run Vite dev server with instant HMR.
- `npm test` — Run comprehensive unit tests.
- `npm run build` — TypeScript verification (`tsc -b`) and production Vite bundling.
- `npm run preview` — Locally preview the production build bundle.
- `npm run lint` — Lint codebase using Oxlint.
- `npx firebase-tools deploy --only hosting` — Deploy latest build to Firebase Hosting.

---

## 📖 Operational Documentation

For a comprehensive guide covering all routes, PIN codes, and event configurations, see **[docs/RUN_GUIDE.md](docs/RUN_GUIDE.md)**.
