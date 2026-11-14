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
1. **User Authentication & Security** `[IMPLEMENTED]`
   - Secure registration (Email, Username, strong password validation).
   - Secure login with bcrypt password hashing + signed JWT (Access Token + Refresh Token flow).
   - Session management & secure token storage (Capacitor Preferences on Android/iOS).
   - Logout & token invalidation.
2. **Income & Expense Tracking (Cash In / Cash Out)** `[IMPLEMENTED]`
   - Cash In (Income) entry: Amount, Category, Date/Time, Note/Description, Payment Mode (Cash, Bank, Mobile Wallet).
   - Cash Out (Expense) entry: Amount, Category, Date/Time, Note/Description, Payment Mode.
   - Dynamic balance calculation:
     - `Total Cash In`
     - `Total Cash Out`
     - `Net Balance (Cash In - Cash Out)`
   - Filter by date range (Today, This Week, This Month, All Time).
3. **Transaction History & Management** `[IMPLEMENTED]`
   - Paginated transaction list with visual income/expense badges.
   - Edit, delete, and search across transactions.
   - Real-time instant balance update upon modification.
4. **Google Drive Backup & Restore** `[IMPLEMENTED]`
   - Google Drive API integration for cloud snapshot backup.
   - One-tap manual backup to Google Drive.
   - One-tap restore from Google Drive backup file with automatic schema mapping.
   - Local offline JSON backup & restore fallback.
5. **Mobile Readiness (Android First, iOS Ready)** `[IMPLEMENTED]`
   - Responsive, mobile-first touch UI with bottom tab bar navigation.
   - Capacitor containerization with generated Android Studio native project.

---

### 🟡 Phase 2: High Priority (Standard Features — P1)
1. **Categories & Wallets Management** `[IMPLEMENTED]`
   - Default seeded categories (Salary, Business, Freelance, Food, Rent, Transport, Utilities, etc.).
   - Custom category creation with dynamic icons and color badges.
   - Multi-account / payment mode tracking (Cash, Bank Account, Mobile Wallet).
2. **Visual Analytics & Reports** `[IMPLEMENTED]`
   - Income vs Expense comparative charts & monthly trends.
   - Category-wise spending breakdown with visual progress bars and percentages.
3. **Data Export** `[IMPLEMENTED]`
   - JSON export for offline local storage or external transfer.
4. **Scheduled / Automated Google Drive Backup** `[PLANNED]`
   - Automated periodic background sync trigger when connected to Wi-Fi.

---

### 🟠 Phase 3: Medium Priority (Enhancements — P2)
1. **Recurring Transactions** `[PLANNED]`
   - Setup repeating income/expenses (e.g. monthly salary, rent, subscriptions).
2. **Budgeting & Spending Limits** `[PLANNED]`
   - Set monthly budget limits per category (e.g. Food: $300).
   - Alert/warning when approaching 80% or 100% of category budget.
3. **Offline Caching & Background Sync** `[PLANNED]`
   - Offline IndexedDB queue that synchronizes with Go backend when online.
4. **Biometric Security** `[PLANNED]`
   - Fingerprint / Face ID unlock using `@capacitor-community/biometric` before opening.

---

### ⚪ Phase 4: Optional / Future Scope (P3)
1. **Receipt Attachment / Scanner** `[PLANNED]`
   - Camera & Gallery integration to capture receipt image per transaction.
2. **Multi-Currency Dynamic Conversion** `[PLANNED]`
   - Live exchange rates across world currencies.
3. **iOS App Store Release** `[READY TO BUILD]`
   - Run `npx cap add ios` inside `frontend/` on macOS and build in Xcode.

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
  - [x] Create transaction (Cash In / Cash Out).
  - [x] List transactions (with filters: date, type, category, pagination, search).
  - [x] Update and delete transaction.
  - [x] Summary endpoint: Calculate `Total Cash In`, `Total Cash Out`, `Net Balance`.
  - [x] Category breakdown analytics endpoint with percentage distributions.
  - [x] 6-month monthly trends endpoint.
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
  - [x] Recent transactions feed with "View All" link.
- [x] Add / Edit Transaction modal:
  - [x] Number pad / decimal amount input.
  - [x] Segmented Cash In (Green) vs Cash Out (Red) toggle.
  - [x] Category picker with colored icons and inline category creation.
  - [x] Payment method pills (Cash, Bank Account, Mobile Wallet).
  - [x] Date & time picker + notes input.
- [x] Transaction History Screen:
  - [x] Search bar (notes, category, payment method).
  - [x] Filter chips (All, Cash In Only, Cash Out Only, Category dropdown).
  - [x] Tap to edit or delete transaction.
- [x] Analytics & Visual Reports:
  - [x] Category distribution progress bars with percentage and amount.
  - [x] 6-month visual flow bar chart.
- [x] Settings & Cloud Backup:
  - [x] Google Drive API connection & Access Token save.
  - [x] "Backup to Drive" one-tap upload button.
  - [x] "Restore from Drive" file picker modal.
  - [x] Local JSON backup download & upload for offline use.
  - [x] Currency switcher (USD $, BDT ৳, EUR €, GBP £, INR ₹, etc.).
  - [x] Backend API URL configurable directly in mobile settings for physical device testing.

### Phase D: Native Mobile Wrapper (Capacitor & Android)
- [x] Next.js static export build (`output: 'export'` in `next.config.mjs`).
- [x] Generate native Android Studio project (`frontend/android`).
- [x] Android Manifest configured with INTERNET and `usesCleartextTraffic` permissions.
- [x] Capacitor assets synchronized (`npx cap sync android`).

### Phase E: Testing & Integration Verification
- [x] Automated Go API test suite verified all endpoints (Health, Auth, Categories, Transactions, Summary, Backup).
- [x] Verified mathematical accuracy: Net Balance = Total Cash In - Total Cash Out.
- [x] Next.js static build verified with zero errors.

---

### Phase F: Future Enhancements (Remaining)
- [ ] Setup background auto-sync scheduler for Google Drive.
- [ ] Add `@capacitor-community/biometric` for fingerprint/face lock.
- [ ] Add receipt photo attachment via Camera API.
- [ ] Enable iOS native build (`npx cap add ios`) when ready for Apple App Store.
