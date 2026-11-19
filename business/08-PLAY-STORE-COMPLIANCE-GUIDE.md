# CashFlow — Google Play Store Compliance & Submission Guide

This document lists every technical and policy requirement implemented in CashFlow to pass Google Play Store review cleanly on the first attempt.

---

### 1. Technical Compliance (Already Configured in Code)

| Google Play Requirement | Status | Implementation |
| :--- | :---: | :--- |
| **Target API Level 35 (Android 15)** | ✅ Ready | `frontend/android/variables.gradle` (`compileSdkVersion = 35`, `targetSdkVersion = 35`) |
| **HTTPS-Only Production Network Security** | ✅ Ready | `frontend/android/app/src/main/res/xml/network_security_config.xml` (`cleartextTrafficPermitted="false"` globally) |
| **Disable Unencrypted ADB Backup** | ✅ Ready | `AndroidManifest.xml` (`android:allowBackup="false"`) |
| **Minimal Permissions Only** | ✅ Ready | Only `INTERNET` requested — zero SMS, Contacts, Location, or Call Log permissions |
| **Public Privacy Policy URL** | ✅ Ready | `/privacy` (`frontend/app/privacy/page.tsx`) + linked in Settings |
| **Terms of Service URL** | ✅ Ready | `/terms` (`frontend/app/terms/page.tsx`) + linked in Settings |
| **Mandatory Account & Data Deletion URL** | ✅ Ready | `/delete-account` (`frontend/app/delete-account/page.tsx`) + In-App Delete in Settings |
| **Android 12+ `android:exported` Flag** | ✅ Ready | `MainActivity` declares `android:exported="true"`, `FileProvider` declares `android:exported="false"` |

---

### 2. How to Fill Out Google Play Console Forms (Copy-Paste Guide)

#### A. Data Safety Form
- **Does your app collect or share any of the required user data types?**
  - If shipping **100% Offline Mode only (no cloud sync, no ads yet):** Select **No**.
  - If enabling **Cloud Sync + AdMob Ads:** Select **Yes**:
    - *Personal Info → Email address*: Collected for Account Management (optional), encrypted in transit (HTTPS), users can request deletion.
    - *Financial Info → User payment / expense logs*: Collected only if user opts in to Cloud Sync, encrypted in transit, NOT shared with third parties.
    - *Device or other IDs*: Collected only if AdMob is enabled (Advertising ID).

#### B. Financial Features Declaration (Very Important!)
Google Play requires finance apps to declare what financial services they offer:
- Select: **"My app doesn't provide any financial features"** *(for personal bookkeeping / manual expense tracking only — CashFlow does NOT issue loans, process bank payments, trade crypto, or offer credit cards).*
- *Tip:* Explicitly mention in reviewer notes: *"CashFlow is a manual personal bookkeeping and budgeting calculator. It does not connect to bank accounts, transfer money, or offer loans."*

#### C. App Content Declarations
- **Privacy Policy URL:** `https://yourdomain.com/privacy`
- **Account Deletion URL:** `https://yourdomain.com/delete-account`
- **Ads Declaration:** Select **"Yes, my app contains ads"** once AdMob is integrated (or **"No"** if shipping ad-free first).
- **Target Audience:** Ages **13+** or **18+** (Do NOT select under-13 children to avoid strict Families Policy audits).
- **Content Rating (IARC):** Complete the short questionnaire → receives **Everyone / PEGI 3**.

---

### 3. Building a Signed Release `.aab` (Android App Bundle) for Play Store
Google Play requires **`.aab`** (not `.apk`) for all new store submissions:

1. **Generate your private Upload Keystore (run ONCE and back up safely!):**
   ```bash
   keytool -genkey -v -keystore cashflow-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias cashflow
   ```
   *(Never lose this `.jks` file and never commit it to Git!)*

2. **Build the web export and sync Capacitor:**
   ```bash
   cd frontend
   npm run cap:sync
   ```

3. **Build the signed `.aab` in Android Studio (`npm run cap:open`)**
   - Menu: **Build → Generate Signed App Bundle / APK → Android App Bundle (.aab)**
   - Select `cashflow-release-key.jks`, choose `release`, and click **Finish**.
   - Upload `frontend/android/app/release/app-release.aab` to **Google Play Console**.
