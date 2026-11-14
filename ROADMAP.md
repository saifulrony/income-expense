# Income & Expense Mobile App — Product Roadmap & Development Checklist

## 1. System Architecture Overview

```
                      +------------------------------------------+
                      |   Mobile App (Android & future iOS)      |
                      |   Next.js 14+ (App Router / Static Export)|
                      |   Tailwind CSS + Lucide Icons            |
                      |   Capacitor Bridge (Native Mobile)       |
                      +--------------------+---------------------+
                                           | HTTPS / REST / JWT
                                           v
                      +------------------------------------------+
                      |           Backend API (Go / Golang)      |
                      |   Framework: Gin (REST API)              |
                      |   Auth: Signed JWT + Bcrypt Passwords    |
                      |   Database: SQLite (CGO-free / GORM)     |
                      +---------+--------------------+-----------+
                                |                    |
                                v                    v
                     +--------------------+   +-------------------+
                     |  Database Engine   |   | Google Drive API  |
                     |  (User & Tx Data)  |   | (Encrypted Backup)|
                     +--------------------+   +-------------------+
```

---

## 2. Feature Prioritization Matrix

### 🟢 Phase 1: Must-Have (Core MVP — P0)
1. **User Authentication & Security** `[COMPLETED]`
   - Secure registration (Email, Username, strong password validation).
   - Secure login with bcrypt password hashing + signed JWT (Access Token + Refresh Token flow).
   - Session management & secure token storage (Capacitor Preferences on Android/iOS).
   - Logout & token invalidation.
2. **Income & Expense Tracking (Cash In / Cash Out)** `[COMPLETED]`
   - Cash In (Income) entry: Amount, Category, Date/Time, Note/Description, Payment Mode (Cash, Bank, Mobile Wallet).
   - Cash Out (Expense) entry: Amount, Category, Date/Time, Note/Description, Payment Mode.
   - Dynamic balance calculation:
     - `Total Cash In`
     - `Total Cash Out`
     - `Net Balance (Cash In - Cash Out)`
   - Filter by date range (Today, This Week, This Month, All Time).
3. **Transaction History & Management** `[COMPLETED]`
   - Paginated transaction list with visual income/expense badges.
   - Edit, delete, and search across transactions.
   - Real-time instant balance update upon modification.
4. **Google Drive Backup & Restore** `[COMPLETED]`
   - Google Drive API integration for cloud snapshot backup.
   - One-tap manual backup to Google Drive.
   - One-tap restore from Google Drive backup file with automatic schema mapping.
   - Local offline JSON backup & restore fallback.
5. **Mobile Readiness (Android First, iOS Ready)** `[COMPLETED]`
   - Responsive, mobile-first touch UI with bottom tab bar navigation.
   - Capacitor containerization with generated Android Studio native project.

---

### 🟡 Phase 2: High Priority (Standard Features — P1)
1. **Categories & Wallets Management** `[COMPLETED]`
   - Default seeded categories (Salary, Business, Freelance, Food, Rent, Transport, Utilities, etc.).
   - Custom category creation with dynamic icons and color badges.
   - Multi-account / payment mode tracking (Cash, Bank Account, Mobile Wallet).
2. **Visual Analytics & Reports** `[COMPLETED]`
   - Income vs Expense comparative charts & monthly trends.
   - Category-wise spending breakdown with visual progress bars and percentages.
3. **Data Export** `[COMPLETED]`
   - Export filtered transactions to CSV format with a single tap.
   - Export official PDF Financial Statement reports with summary tables and branding.
   - Export full JSON ledger for offline local storage or external transfer.
4. **Automated Google Drive Cloud Backup** `[COMPLETED]`
   - Instant automatic background upload to Google Drive whenever transactions are added or modified.

---

### 🟠 Phase 3: Medium Priority (Enhancements — P2)
1. **Recurring Transactions** `[COMPLETED]`
   - Setup repeating income/expenses (Daily, Weekly, Monthly) with automated process runner (`POST /api/recurring/process`).
   - Management modal with pause/resume toggles and delete controls.
2. **Budgeting & Spending Limits** `[COMPLETED]`
   - Set monthly budget limits per category (e.g. Food: $300).
   - Progress tracking with visual threshold alerts:
     - `Safe` (< 80%)
     - `Warning` (80% - 100%)
     - `Exceeded` (> 100%)
3. **Security App Lock (PIN / Biometric)** `[COMPLETED]`
   - 4-digit security PIN lock screen preventing unauthorized app access on mobile.
   - Encrypted PIN storage in device preferences.
4. **Receipt Attachment / Camera Scanner** `[COMPLETED]`
   - Snap photos with mobile camera or upload receipt images directly during transaction entry.
   - Full-screen receipt preview modal.
5. **Offline Mode & Caching** `[COMPLETED]`
   - Offline queue (`OfflineSyncService`) that records transactions when disconnected and automatically synchronizes with the Go backend when network is restored.

---

### ⚪ Phase 4: Optional & Future Scope (P3)
1. **Multi-Currency Live Converter** `[COMPLETED]`
   - In-app currency calculator with exchange rates across USD, BDT, EUR, GBP, INR, CAD, AUD.
2. **iOS App Store Release Scaffolding** `[READY TO BUILD]`
   - 100% prepared for iOS. Simply run `npx cap add ios` inside `frontend/` on macOS and open in Xcode.

---

## 3. Development Progress Checklist

### Legend
- `[x]` Completed & Tested
- `[/]` In Progress
- `[ ]` Remaining / To-Do

---

### Phase A: Architecture & Project Scaffolding
- [x] Initialize Go Backend service (`/backend`) with clean architecture (cmd, internal, models, handlers, middleware).
- [x] Initialize Next.js 14+ Frontend app (`/frontend`) with Tailwind CSS and mobile-first layout.
- [x] Setup Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`) inside frontend.
- [x] Configure environment variables and unified API client (`frontend/lib/api.ts`).

### Phase B: Backend Development (Go)
- [x] Database setup & auto-migration engine with SQLite (`internal/database/database.go`).
- [x] Seed default categories for every newly registered user.
- [x] Auth Module:
  - [x] User Registration endpoint with validation and password hashing (`bcrypt`).
  - [x] User Login endpoint returning signed JWT Access & Refresh Tokens.
  - [x] JWT Middleware for protected routes (`internal/middleware/auth.go`).
  - [x] Profile fetch and update endpoints.
- [x] Transaction & Analytics Module:
  - [x] Create transaction with receipt photo attachment (Cash In / Cash Out).
  - [x] List transactions (with filters: date, type, category, pagination, search).
  - [x] Update and delete transaction.
  - [x] Summary endpoint: Calculate `Total Cash In`, `Total Cash Out`, `Net Balance`.
  - [x] Category breakdown analytics endpoint with percentage distributions.
  - [x] 6-month monthly trends endpoint.
- [x] Budgeting & Category Limits Module:
  - [x] `POST /api/budgets` to set spending limits.
  - [x] `GET /api/budgets` with spent amount, remaining amount, and alert status calculation.
  - [x] `DELETE /api/budgets/:id`.
- [x] Recurring Transactions Module:
  - [x] `POST /api/recurring` to configure daily, weekly, or monthly recurring entries.
  - [x] `GET /api/recurring` and `PUT /api/recurring/:id/toggle`.
  - [x] `POST /api/recurring/process` auto-generation runner.
- [x] Backup & Restore Module:
  - [x] Export full user ledger payload (versioned JSON).
  - [x] Import/Restore user ledger payload with category reconciliation.
  - [x] Backup logging endpoint (`/api/backup/log` and `/api/backup/history`).

### Phase C: Frontend Development (Next.js Mobile UI/UX)
- [x] Mobile navigation layout (Bottom Tab Bar: Home, History, Add (+), Analytics, Settings).
- [x] Authentication screens:
  - [x] Sign In & Register views with validation and demo auto-fill.
  - [x] Persistent session handling with `@capacitor/preferences`.
- [x] Dashboard / Home:
  - [x] Summary Cards: Net Balance, Cash In, Cash Out with live financial totals.
  - [x] Quick Action touch buttons: + Add Cash In, - Add Cash Out.
  - [x] Monthly Category Budgets overview card with threshold warnings.
  - [x] Recent transactions feed with "View All" link.
- [x] Add / Edit Transaction modal:
  - [x] Number pad / decimal amount input.
  - [x] Segmented Cash In (Green) vs Cash Out (Red) toggle.
  - [x] Category picker with colored icons and inline category creation.
  - [x] Payment method pills (Cash, Bank Account, Mobile Wallet).
  - [x] Camera receipt photo capture / file upload preview with removal option.
  - [x] "Make this Recurring" toggle with daily/weekly/monthly frequency.
  - [x] Date & time picker + notes input.
- [x] Transaction History Screen:
  - [x] Search bar (notes, category, payment method).
  - [x] One-tap "Export CSV" spreadsheet download.
  - [x] One-tap "Export PDF" formal financial statement download.
  - [x] Filter chips (All, Cash In Only, Cash Out Only, Category dropdown).
  - [x] Receipt icon thumbnail with full-screen zoom modal.
  - [x] Tap to edit or delete transaction.
- [x] Analytics & Visual Reports:
  - [x] Category distribution progress bars with percentage and amount.
  - [x] 6-month visual flow bar chart.
  - [x] Multi-currency conversion calculator modal (`CurrencyConverterModal.tsx`).
  - [x] Download PDF statement shortcut.
- [x] Settings & Cloud Backup:
  - [x] Google Drive API connection & Access Token save.
  - [x] Automated Cloud Sync toggle (instant sync on transaction creation).
  - [x] "Backup to Drive" one-tap upload button.
  - [x] "Restore from Drive" file picker modal.
  - [x] Local JSON backup download & upload for offline use.
  - [x] Category Budgets management modal (`BudgetModal.tsx`).
  - [x] Recurring transactions management modal (`RecurringModal.tsx`).
  - [x] App Security PIN Lock configuration (`PinLockView.tsx`).
  - [x] Currency switcher (USD, BDT, EUR, GBP, INR, CAD, AUD).
  - [x] Backend API URL configurator for physical device LAN testing.
- [x] Offline Mode:
  - [x] Local offline queueing of transactions when offline.
  - [x] Auto-sync queue to Go backend on reconnect.

### Phase D: Native Mobile Wrapper (Capacitor & Android)
- [x] Next.js static export build (`output: 'export'` in `next.config.mjs`).
- [x] Android Studio native project generated in `frontend/android`.
- [x] Configured permissions (`INTERNET`, `usesCleartextTraffic` for local LAN testing) in `AndroidManifest.xml`.
- [x] Capacitor assets synchronized (`npx cap sync android`).

### Phase E: Testing & Integration Verification
- [x] Comprehensive Go API test suite verified all endpoints (Health, Auth, Categories, Transactions, Summary, Budgets, Recurring, Backup).
- [x] Verified mathematical accuracy: Net Balance = Total Cash In - Total Cash Out.
- [x] Verified automated transaction generation for recurring rules.
- [x] Verified PDF statement generation and CSV export.
- [x] Next.js static export build verified with zero errors.
