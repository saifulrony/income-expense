# CashFlow — Android Installation & Build Guide 📱

This folder contains scripts and utilities to generate and install the Android version of **CashFlow** (`CashFlow.apk`) on your physical phone or emulator.

---

## 🚀 Quick Start (Easiest & Fastest Method)

### Method 1: Build & Locate APK via Android Studio (Recommended)
If you have **Android Studio** installed on your computer:
```bash
cd frontend
npx cap open android
```
1. Android Studio will open the native project in `frontend/android`.
2. In the top toolbar, click: **`Build`** > **`Build Bundle(s) / APK(s)`** > **`Build APK(s)`**.
3. When finished, a popup in the bottom right will say *"APK(s) generated successfully"* — click **`locate`** to grab your installable `app-debug.apk`!

---

### Method 2: 1-Click Command Line Build (`install/make_android.sh`)
If you have Java JDK 17+ and the Android SDK configured:
```bash
./install/make_android.sh
```
* Compiles the static Next.js production web bundle.
* Synchronizes assets into the native Capacitor Android container.
* Invokes Gradle to compile `CashFlow.apk`.
* Places the finished APK right here at: `install/CashFlow.apk`.

*(If your terminal does not have JDK 17 installed yet, run `./install/setup_environment.sh` or `sudo apt install openjdk-17-jdk`)*.

---

## 📲 How to Install the APK on Your Android Phone

### Option A: 1-Click ADB Install (via USB Cable)
1. Enable **Developer Options** & **USB Debugging** on your phone:
   * Go to `Settings` > `About Phone` > tap **Build Number** 7 times.
   * Go to `Settings` > `Developer Options` > turn ON **USB Debugging**.
2. Connect your phone to your computer with a USB cable.
3. Run:
   ```bash
   ./install/install_to_phone.sh
   ```
   * It will automatically detect your phone, install the APK, and launch the app!

### Option B: Wireless / Direct File Transfer
1. Send `install/CashFlow.apk` to your phone using:
   * **Google Drive** / **Dropbox**
   * **WhatsApp** / **Telegram** (send the file to yourself)
   * **Email** attachment or USB File Transfer (MTP)
2. On your phone, tap the received `.apk` file.
3. If prompted with *"For your security, your phone is not allowed to install unknown apps from this source"*, tap **Settings** and toggle **Allow from this source**.
4. Tap **Install**!

---

## 🌐 Connecting to the Backend Server from Your Phone
When running on a physical Android device:
1. Ensure your phone and your computer are connected to the same Wi-Fi network.
2. Find your computer's local IP address (`ip route get 1.2.3.4 | awk '{print $7}'`, e.g. `192.168.1.100`).
3. In CashFlow on your phone, go to **Settings** > **Backend API Server URL** and enter:
   ```
   http://192.168.1.100:18080/api
   ```
4. Tap **Update** — your phone now talks directly to your local Go backend on port **18080**!

