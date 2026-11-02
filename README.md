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
   - Starts an explicit five-minute TLS-pinned phone pairing session on the selected Wi-Fi address and stable TCP port 32975.
   - Shows the QR, approves phone requests, and shares the paired session with Omachy Drop.

3. **Omachy Drop** (`omachy drop`):
   - Handles approved phone-to-computer and computer-to-phone transfers for the active Connect session.
   - Shows offers, progress, cancellation, and SHA-256 verification status.
   - Received files are saved in `~/Downloads/OmachyDrop/`; the window can open that folder.

Connect and Drop use one local loopback service. The service runs as a separate,
unprivileged user process so closing the window that started it doesn't break
the other window. Its log is stored at `~/.local/state/omachy/service.log`
(or `$XDG_STATE_HOME/omachy/service.log`). The phone listener is separate,
TLS-pinned, bound only to the selected Wi-Fi address on TCP port 32975, and expires after five
minutes. No firewall rules or privileged listeners are created automatically.

4. **Omachy Jarvis** (`omachy jarvis`):
   - Assistant interface for a small allowlist of fixed, read-only system checks.
   - The local service rejects arbitrary command strings and does not invoke a shell.
   - A confirmation prompt is provided in the app; the server independently enforces the action allowlist.
   - Displays the real exit code, stdout, and stderr for an allowed check.

5. **Omachy Developer Tools** (`omachy developer`):
   - Workspace repository browser with Git branch badges and path copying.
   - Buttons run named, read-only system actions with fixed argument lists.
   - The server rejects unknown actions and unexpected request parameters.

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
