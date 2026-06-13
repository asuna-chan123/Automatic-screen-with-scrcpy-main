<h1 align="center">
  <img src="https://raw.githubusercontent.com/Genymobile/scrcpy/master/app/data/icon.png" width="80" alt="Scrcpy Logo">
  <br>
  🚀 MIRRORFLUX PRO 
  <br>
  <span style="font-size: 0.5em; font-weight: normal;">The Ultimate Automatic Screen Mirroring Companion</span>
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.5-blue?style=for-the-badge&logo=appveyor" alt="Version">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D7?style=for-the-badge&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/Framework-.NET%204.7.2-512BD4?style=for-the-badge&logo=dotnet" alt="Framework">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

---

## 🌟 Overview

**MirrorFlux Pro** (formerly Scrcpy Monitor) is a robust, lightweight, and modern Windows GUI built around the legendary [scrcpy](https://github.com/Genymobile/scrcpy). We've taken the complexity out of command-line operations and transformed it into a professional dashboard. 

Whether you're a gamer needing zero-latency mirroring, a developer debugging Android apps, or someone who wants to seamlessly control their phone from across the room—or **across the globe**—MirrorFlux Pro is designed for **you**.

## 🔥 Premium Features

### 🔌 Intelligent & Automated Connectivity
- **Auto-Discovery:** Instantly detects USB-connected Android devices without any manual configuration.
- **One-Click Auto WiFi:** Ditch the cables! Connect your phone via USB once, click "Auto WiFi", and seamlessly switch to local wireless mirroring.
- **Real-Time Status Tracking:** Always know the exact state of your devices (Ready, Connected, Offline, Unauthorized).

### 🌐 [NEW] Remote Mirroring Beyond LAN (Via Tailscale VPN)
- **Break Distance Barriers:** Control your Android device even if it's sitting on your home desk while you're away at a coffee shop or the office.
- **1-Click Tailscale Connect:** Automatically detects your device's unique Tailscale IP (the `100.X.X.X` subnet) and establishes a secure, remote ADB connection.
- **Zero Port Forwarding:** No need to mess with static IPs, dynamic DNS, or risky router firewall configurations. Enjoy end-to-end encrypted remote access safely.

### 📋 Advanced Device Management
- **Persistent Custom Naming:** Tired of seeing generic serial numbers like `RQ300XXXX`? Assign friendly aliases like "My Gaming Phone" or "Test Tablet". Your names are saved permanently.
- **Smart Search & Sort:** Instantly find devices using the real-time search bar, or sort them by Name, Status, or Connection Type (USB / WiFi / Tailscale).
- **Clean Interface:** Remove disconnected or legacy device slots with a single click to keep your workspace clutter-free.

### 🔋 Power User Tools
- **Screen-Off Mirroring:** Save battery and prevent AMOLED burn-in! Toggle the `--turn-screen-off` feature directly from the UI.
- **Automated Environment Setup:** No need to mess with system PATH variables. MirrorFlux Pro smartly locates `scrcpy` and `adb` wherever it's launched.
- **Responsive Dashboard:** A fluid, modern UI that adapts dynamically as you resize the window.

---

## 🚀 Getting Started

### 📦 Installation
1. Download the latest **MirrorFlux Pro** release.
2. Ensure you have `adb.exe` and `scrcpy.exe` in the same directory (or just download the pre-packaged Portable version!).
3. Run `ScrcpyMonitor.exe` and enjoy!

### 📶 Method 1: Local Wireless Setup (LAN)
1. Plug your Android device into your PC via a USB cable.
2. Click the **"Auto WiFi"** button on your device's card.
3. Once the local IP is discovered and configured, unplug the cable.
4. Click **"Connect"** to start mirroring wirelessly with zero hassle!

### 🌍 Method 2: Remote Wireless Setup (Via Tailscale VPN)
1. **Preparation:** Install the **Tailscale** app on both your Windows PC and Android device. Log into the same Tailscale account on both.
2. Turn on Tailscale on both devices (ensure they show as active/online in your Tailnet).
3. Connect your phone to your PC via USB *just once* to initialize the wireless ADB port (`adb tcpip 5555`).
4. On MirrorFlux Pro, click **"Connect via Tailscale"**. The dashboard will automatically fetch your phone's `100.X.X.X` IP and link up securely.
5. Unplug the cable and enjoy full remote mirroring from anywhere in the world!

---

## 🛠️ System Requirements
- **OS:** Windows 7 / 10 / 11
- **Runtime:** .NET Framework 4.7.2 or higher
- **Android Device:** Developer Options & **USB Debugging** enabled
- **For Remote Access:** Tailscale app running on both host and client devices with active network permissions.

---

## 🤝 Credits & License
- **Core Engine:** Huge thanks to Genymobile for the amazing [scrcpy](https://github.com/Genymobile/scrcpy).
- **Developer:** [asuna-chan123](https://github.com/asuna-chan123)
- **License:** Released under the MIT License.

<p align="center">
  <i>"Screen mirroring has never been this smooth and effortless, no matter where you are."</i>
</p>
