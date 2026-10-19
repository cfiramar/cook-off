# Cook-Off Contest - Run & Operations Guide

This guide explains how to run the application locally, build it for production, deploy it to Firebase Hosting, and provides links and descriptions for all screens.

---

## 1. How to Run the App

### Prerequisites
- **Node.js**: v18 or higher recommended
- **npm**: Comes bundled with Node.js

### Step 1: Install Dependencies
Open a terminal in the project root directory and run:
```bash
npm install
```

### Step 2: Environment Variables
Ensure the `.env.local` file exists in the root directory with the necessary Firebase configuration keys:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Step 3: Run Development Server
To start the app locally with hot-reloading:
```bash
npm run dev
```
The app will typically run at: [http://localhost:5173/](http://localhost:5173/)

### Step 4: Build for Production
To typecheck and bundle the project:
```bash
npm run build
```
The compiled files will be output to the `dist` folder.

### Step 5: Preview Production Build Locally
To test the production build locally before deploying:
```bash
npm run preview
```

### Step 6: Deploy to Firebase Hosting
To deploy the latest build to Firebase Hosting:
```bash
npm run build
npx firebase-tools deploy --only hosting
```

**Live Hosted URLs:**
- [https://cook-off-contest.web.app](https://cook-off-contest.web.app)
- [https://cook-off-contest.firebaseapp.com](https://cook-off-contest.firebaseapp.com)

---

## 2. Screens & URL Directory

> **Note**: Replace `{eventId}` with your specific event identifier (e.g., `event1` or the Firestore document ID).

### A. Planning Dashboard (לוח בקרה ואירועים)
- **Description**: Main landing dashboard. Displays all cook-off events, allows creating new events, and quick navigation to event management.
- **Local Link**: [http://localhost:5173/planning](http://localhost:5173/planning) *(Visiting `/` automatically redirects here)*
- **Production Link**: [https://cook-off-contest.web.app/planning](https://cook-off-contest.web.app/planning)

---

### B. Event Planning & Management (ניהול ותכנון אירוע)
- **Description**: Comprehensive management panel for an individual event. Manage event details, visual themes, guest list and roles, dishes/courses, and live results.
- **Local Links**:
  - Main / Details: [http://localhost:5173/planning/{eventId}/details](http://localhost:5173/planning/{eventId}/details)
  - Themes & Colors: [http://localhost:5173/planning/{eventId}/themes](http://localhost:5173/planning/{eventId}/themes)
  - Guest Manager: [http://localhost:5173/planning/{eventId}/guests](http://localhost:5173/planning/{eventId}/guests)
  - Meal Manager: [http://localhost:5173/planning/{eventId}/meals](http://localhost:5173/planning/{eventId}/meals)
  - Results Summary: [http://localhost:5173/planning/{eventId}/results](http://localhost:5173/planning/{eventId}/results)
- **Production Links**:
  - Main / Details: `https://cook-off-contest.web.app/planning/{eventId}/details`
  - Themes & Colors: `https://cook-off-contest.web.app/planning/{eventId}/themes`
  - Guest Manager: `https://cook-off-contest.web.app/planning/{eventId}/guests`
  - Meal Manager: `https://cook-off-contest.web.app/planning/{eventId}/meals`
  - Results Summary: `https://cook-off-contest.web.app/planning/{eventId}/results`

---

### C. Voter Mode (מסך הצבעה לאורחים ומשתתפים)
- **Description**: Mobile-friendly interface for guests and judges. Allows participants to view active dishes and submit ratings and scores in real-time.
- **Local Link**: [http://localhost:5173/{eventId}](http://localhost:5173/{eventId})
- **Production Link**: `https://cook-off-contest.web.app/{eventId}`

---

### D. Host / Moderator Mode (מסך מנחה ומנהל תחרות)
- **Description**: Control room for the event host. Allows advancing through competition stages, opening/closing voting on dishes, managing live status, and triggering reveals.
- **Local Link**: [http://localhost:5173/host/{eventId}](http://localhost:5173/host/{eventId})
- **Production Link**: `https://cook-off-contest.web.app/host/{eventId}`

---

### E. General View Dashboard (בחירת אירוע לתצוגה)
- **Description**: Index screen to select which event to display in presentation/spectator mode.
- **Local Link**: [http://localhost:5173/view](http://localhost:5173/view)
- **Production Link**: [https://cook-off-contest.web.app/view](https://cook-off-contest.web.app/view)

---

### F. View Mode / TV Big-Screen Presentation (מסך הקרנה ותצוגה חיה)
- **Description**: Designed for TVs and projectors. Features animated live leaderboards, real-time voting statistics, dramatic score reveals, and winner ceremonies.
- **Local Link**: [http://localhost:5173/view/{eventId}](http://localhost:5173/view/{eventId})
- **Production Link**: `https://cook-off-contest.web.app/view/{eventId}`
