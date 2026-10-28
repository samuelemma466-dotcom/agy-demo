# Omachy Desktop Suite 🐧✨

A modular suite of standalone Linux desktop utility applications for **Omarchy Linux (Arch-based) / Hyprland (Wayland)**. Built with a modern acrylic glass aesthetic, real Linux hardware and network integrations, and completely independent native application windows.

---

## 🧭 Architecture Overview

Omachy is **not** a website or an OS shell replacement. It is a suite of individual, installable desktop utilities:

```mermaid
flowchart TD
    Launcher["Omachy Desktop Launcher / CLI (bin/omachy)"] --> CC["Omachy Control Center\n(380x590 utility window)"]
    Launcher --> CN["Omachy Connect\n(480x620 phone hub)"]
    Launcher --> DR["Omachy Drop\n(480x580 file transfer)"]
    Launcher --> JV["Omachy Jarvis\n(520x680 shell AI)"]
    Launcher --> DV["Omachy Dev Tools\n(780x620 projects hub)"]
    Launcher --> SU["Omachy Suite\n(980x680 multi-launcher)"]

    subgraph Native Linux Integration Layer (server/system_bridge.py)
        NM["NetworkManager (nmcli)"]
        BZ["BlueZ (bluetoothctl)"]
        PW["PipeWire / WirePlumber (wpctl)"]
        SYS["Linux sysfs (/sys/class/power_supply)"]
        KD["KDE Connect detection (kdeconnect-cli)"]
        FS["Real Drop directory (~/Downloads/OmachyDrop)"]
    end

    CC --> NM & BZ & PW & SYS
    CN --> KD
    DR --> FS
    JV --> SYS
```

---

## 📦 The 5 Standalone Applications

1. **Omachy Control Center** (`omachy control-center`):
   - Compact utility window (inspired by macOS Control Center & Linux quick settings).
   - Real Wi-Fi network connection (`nmcli`), signal strength, radio toggle, and network scanner.
   - Real Bluetooth status (`bluetoothctl`), power switch, and paired device list (`BT Speaker`, `vivo V21`, `TWS`).
   - Real audio output slider controlling PipeWire/WirePlumber (`wpctl`), with mute toggle and sink identification.
   - Real battery capacity & charging state from Linux sysfs (`/sys/class/power_supply/BAT0`).
   - One-click shortcuts for Do Not Disturb, Jarvis, Drop, and Suite.

2. **Omachy Connect** (`omachy connect`):
   - Phone pairing and convergence hub.
   - Real KDE Connect detection: reports whether `kdeconnect-cli` is active or missing, with clear fallback instructions.
   - PIN verification simulation, Wi-Fi discovery scan, and feature toggles.

3. **Omachy Drop** (`omachy drop`):
   - Real file transfer and staging tool.
   - Drag-and-drop or select any real file on your system to stage it into `~/Downloads/OmachyDrop/`.
   - Real file list with file sizes and timestamps.
   - One-click button to open `~/Downloads/OmachyDrop/` in the system file manager via `xdg-open`.

4. **Omachy Jarvis** (`omachy jarvis`):
   - Interactive intelligent shell assistant.
   - Distinguishes **Suggestions** (read-only AI recommendations) from **Executed Commands**.
   - Confirmation dialog before running any command: *"Are you sure you want to run this in your user shell?"*
   - Root / `sudo` execution prohibited by safety policy.
   - Displays real exit code, stdout, and stderr.

5. **Omachy Developer Tools** (`omachy developer`):
   - Workspace repository browser with Git branch badges and path copying.
   - Presets for common Linux commands (`ps aux`, `df -h`, `ip -br addr`, `systemctl --user`).
   - Real output capture box.

6. **Omachy Suite Launcher** (`omachy suite`):
   - Hub to launch any of the standalone windows independently.
   - Includes access to the original reference prototype.

---

## 🚀 How to Run

### Command-Line Execution
Run any application directly from terminal inside `/home/biggiesam/agy-demo`:

```bash
# Launch Omachy Control Center
./bin/omachy control-center

# Launch Omachy Connect (Phone Hub)
./bin/omachy connect

# Launch Omachy Drop (File Beam)
./bin/omachy drop

# Launch Omachy Jarvis (Shell Assistant)
./bin/omachy jarvis

# Launch Omachy Developer Tools
./bin/omachy developer

# Launch Master Suite Launcher
./bin/omachy suite
```

### Install Application Launchers (App Menu)
To install `.desktop` entries into `~/.local/share/applications/` so they appear in your application launcher (wofi/rofi/anyrun/fuzzel):

```bash
./bin/install-desktop-launchers.sh
```
*(Runs strictly within user space — no `sudo` required!)*

---

## 🛠️ Tauri 2 Migration Path & Environment Assessment

| Metric | Status |
| :--- | :--- |
| **Operating System** | Omarchy 4.0.4 (Arch-based Linux) |
| **Window Manager** | Hyprland (Wayland Session) |
| **Rust Toolchain (`rustc` / `cargo`)** | **Not installed** |
| **Current Native Runner** | Native Wayland Gtk 3 + WebKit2 4.1 (`PyGObject`) |

### Recommended Migration Path:
1. **Stage 1 (Current - Zero Extra Dependencies)**:
   - Uses system-native `PyGObject` + `WebKit2 4.1` (already installed on Omarchy).
   - Instant native Wayland windows, zero compilation overhead, zero package installation.
   - Uses real Linux CLI tools (`nmcli`, `bluetoothctl`, `wpctl`, `/sys/class/power_supply`).
2. **Stage 2 (Tauri 2 Compilation)**:
   - When ready and approved, install Rust:
     ```bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     ```
   - Initialize Tauri in the project:
     ```bash
     npm install -D @tauri-apps/cli @tauri-apps/api
     npx tauri init
     ```
   - Because the React frontend already calls the clean `systemApi` JSON contract, moving to Tauri 2 involves mapping `systemApi` calls directly to `tauri::command` handlers in Rust!
