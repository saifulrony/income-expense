# CashFlow — Income & Expense Mobile App

An Android-first (and iOS ready) mobile application for personal income and expense tracking with real-time financial balance calculation and Google Drive cloud backup integration.

Built with **Next.js 14 (App Router)** + **Tailwind CSS** + **CapacitorJS** for the frontend, and a high-performance **Go (Golang) REST API** + **SQLite / GORM** for the backend.

---

## 🌟 Key Features

### 1. Financial Engine (Cash In & Cash Out)
- **Cash In (Income):** Log salary, business earnings, freelance, investments, and gifts.
- **Cash Out (Expense):** Log daily expenses categorized by Food, Rent, Utilities, Transport, Shopping, Healthcare, etc.
- **Real-Time Calculation:**
  - `Total Cash In`
  - `Total Cash Out`
  - `Net Balance = (Cash In - Cash Out)`
- **Dynamic Period Filter:** Today, This Week, This Month, and All Time.

### 2. User Authentication & Security
- Secure registration and login with `bcrypt` password hashing.
- Signed JWT token authentication (Access + Refresh token lifecycle).
- Persistent device session management via `@capacitor/preferences`.

### 3. Google Drive Backup & Cloud Sync
- One-tap manual backup to user's Google Drive.
- One-tap restore from Google Drive with automatic category mapping.
- Local offline JSON backup export and import fallback.

### 4. Mobile-First UI/UX & Native Android Packaging
- Designed specifically for smartphone screens with bottom navigation bar, safe-area padding, touch-friendly keypad inputs, and visual color-coding (🟢 Green for Income, 🔴 Red for Expense).
- Native Android Studio project generated via Capacitor in `frontend/android`.
- Prepared for future iOS launch with a single command (`npx cap add ios`).

---

## 🚀 Quick Start

### Run the Full Project (Backend + Frontend) in One Command:
```bash
./dev.sh
# Or using Make:
make dev
```
This automatically boots up:
- **Go REST Backend API:** `http://localhost:18080`
- **Next.js Mobile Frontend:** `http://localhost:18000`
- **Auto-shutdown:** Press `Ctrl+C` to gracefully terminate both services.

---

### Run Services Individually:

#### 1. Start the Backend API (Go)
```bash
make backend
# Or: cd backend && go run cmd/server/main.go
# Server runs on: http://localhost:18080
```

#### 2. Start the Frontend (Next.js Mobile Web View)
```bash
make frontend
# Or: cd frontend && npm run dev
# App runs on: http://localhost:18000
```

### 3. Run Backend Integration Tests
```bash
make test
# Or: bash backend/test_api.sh
```

### 4. Build & Sync to Native Android App
```bash
make build-android
```
Then open in Android Studio:
```bash
make open-android
```
From Android Studio, click **Run** to launch on an Android emulator or connected physical Android phone!

---

## 📁 Project Structure

```
income-expense/
├── backend/                   # Go (Golang) REST API Service
│   ├── cmd/server/main.go     # Application entrypoint & routes
│   ├── internal/
│   │   ├── database/          # SQLite database connection & migrations
│   │   ├── handlers/          # Auth, Transaction, Analytics, Backup handlers
│   │   ├── middleware/        # JWT Authentication middleware
│   │   ├── models/            # User, Category, Transaction, Backup models
│   │   └── utils/             # Password hashing & JWT helpers
│   ├── test_api.sh            # End-to-end API test suite
│   └── go.mod
│
├── frontend/                  # Next.js 14 Mobile Frontend & Capacitor
│   ├── android/               # Native Android Studio Project
│   ├── app/                   # Next.js App Router (page.tsx, layout.tsx)
│   ├── components/            # Mobile UI Components
│   │   ├── BottomNav.tsx      # Native-style bottom navigation bar
│   │   ├── Header.tsx         # Mobile header & refresh indicator
│   │   ├── SummaryCard.tsx    # Net Balance, Cash In & Cash Out cards
│   │   ├── TransactionModal.tsx # Add/Edit Cash In & Cash Out form
│   │   ├── TransactionItem.tsx  # Interactive transaction feed item
│   │   ├── HistoryView.tsx    # Search & filtered transaction log
│   │   ├── AnalyticsView.tsx  # Visual category & monthly charts
│   │   ├── SettingsView.tsx   # Google Drive Backup & preferences
│   │   └── AuthView.tsx       # Sign In & Registration screens
│   ├── lib/                   # API client, Google Drive service, TypeScript types
│   ├── capacitor.config.ts    # Capacitor mobile configuration
│   └── package.json
│
├── ROADMAP.md                 # Product Roadmap & Progress Checklist
├── Makefile                   # Unified developer build commands
└── README.md                  # Project documentation
```

# income-expense
