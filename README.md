# Omachy Desktop 🐧✨

A modern Linux desktop companion with a macOS-inspired floating aesthetic, built completely from scratch with its own visual identity and zero proprietary Apple code or assets.

---

## 🚀 Key Highlights & Design

- **Original Linux Companion Identity**: Deep obsidian and acrylic glassmorphism dark theme, rounded floating panels, custom geometric vector branding, and subtle animations.
- **Left Navigation Sidebar**: Seamless access to **Home**, **My Files**, **Phone**, **Jarvis**, **Developer Tools**, and **Settings**.
- **macOS-Inspired Application Dock**: Floating curved dock with glass blur, magnification/bounce hover feedback, active indicator dots, and quick-launch buttons.
- **Global Command Palette (`Ctrl+K`)**: Fast keyboard-driven command runner and global action search with arrow-key navigation.
- **Home Dashboard**: Live digital clock, dynamic day greeting, responsive telemetry cards (CPU, RAM, Storage, Network), interactive desktop quick actions, and recent activity feed.
- **Phone Companion Hub**: Demonstration mode for mobile connectivity with KDE Connect protocol readiness, device discovery radar, PIN verification, and integration toggles.
- **File Transfer Center**: Clearly separated **Send** (drag-and-drop dropzone & destination picker) and **Receive** (listening port & simulate beam) workflows with an honest queue status.
- **Jarvis Desktop AI**: Built-in companion chat with system task synthesis, prompt chips, and one-click copyable Linux commands.
- **Developer Hub**: Local project tracker with git branches, quick terminal command presets (`htop`, `git status`, `df -h`, `docker ps`), and workspace shortcuts.
- **Safety Compliant**: Zero root elevation (`sudo`) required, no automatic background services registered, no secrets or keys in code.

---

## 🛠️ Technology Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 6](https://vitejs.dev/)
- **Styling**: Modular CSS3 (Design tokens, CSS variables, glassmorphism, keyframe animations)
- **Icons**: [Lucide React](https://lucide.dev/) (Open-source ISC license)

---

## 📂 Project Architecture

```
agy-demo/
├── public/
│   └── omachy-icon.svg          # Original vector logo
├── src/
│   ├── components/
│   │   ├── command-palette/
│   │   │   └── CommandPalette.tsx # Ctrl+K global modal palette
│   │   ├── dashboard/
│   │   │   ├── ClockWidget.tsx    # Live clock & date widget
│   │   │   ├── HomeDashboard.tsx  # Main dashboard layout
│   │   │   ├── QuickActions.tsx   # DND, IP copy, screenshot, etc.
│   │   │   ├── RecentItems.tsx    # Recent activity list
│   │   │   └── SystemStatusCard.tsx # CPU, RAM, Disk, Network
│   │   ├── developer/
│   │   │   └── DeveloperPanel.tsx # Projects & terminal presets
│   │   ├── jarvis/
│   │   │   └── JarvisPanel.tsx    # AI assistant companion
│   │   ├── layout/
│   │   │   ├── Dock.tsx           # Floating macOS-style dock
│   │   │   ├── Header.tsx         # Companion top bar
│   │   │   └── Sidebar.tsx        # Left navigation sidebar
│   │   ├── phone/
│   │   │   └── PhonePanel.tsx     # KDE Connect phone hub
│   │   ├── settings/
│   │   │   └── SettingsPanel.tsx  # Accent color, theme, safety
│   │   └── transfers/
│   │       └── TransferPanel.tsx  # Send & Receive file actions
│   ├── mock/
│   │   └── mockData.ts            # Realistic mock data
│   ├── modules/                   # Extensible integration modules
│   │   ├── kdeconnect/            # KDE Connect D-Bus bridge
│   │   ├── transfers/             # Socket / WebRTC transfer bridge
│   │   ├── jarvis/                # Local LLM / Ollama engine bridge
│   │   └── system/                # Linux sysfs telemetry reader
│   ├── styles/
│   │   ├── animations.css         # Keyframe animations & transitions
│   │   ├── components.css         # Layout, cards, dock, palette styles
│   │   ├── index.css              # Global styles & scrollbars
│   │   └── variables.css          # Color tokens & glass variables
│   ├── types/                     # TypeScript definitions
│   ├── App.tsx                    # Top-level coordinator & hotkeys
│   └── main.tsx                   # React root entry
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🚦 How to Run Locally

### 1. Start the Vite Development Server
Inside `/home/biggiesam/agy-demo`, run:
```bash
npm run dev
```
Then open your browser at:
`http://localhost:5173`

### 2. Run Production Build & Typecheck
```bash
npm run typecheck    # Strict TypeScript verification
npm run build        # Build optimized static distribution into dist/
npm run preview      # Preview production build locally
```

---

## 🔍 Demonstration States vs. Real Integrations

In compliance with honest software design, all prototype features clearly distinguish between mock demonstrators and future native integrations:

| Feature | Current State | Production Integration Plan |
| :--- | :--- | :--- |
| **System Telemetry** | Realistic simulation with subtle micro-fluctuations | Read `/proc/stat`, `/proc/meminfo`, and `statvfs` via local backend or D-Bus |
| **Phone Connection** | Demonstrator discovery scan & PIN verification | Native `org.kde.kdeconnect` D-Bus daemon interface (`kdeconnectd`) |
| **File Transfers** | Local simulation dropzone & simulated receive queue | KDE Connect file transfer protocol (port 1716) or local socket bridge |
| **Jarvis AI Assistant** | Intelligent pattern matcher & terminal command synthesizer | Local [Ollama](https://ollama.ai) instance (`localhost:11434`) or custom LLM sidecar |
| **Terminal Presets** | One-click clipboard copy & quick preview | Direct execution via user shell or terminal multiplexer (`kitty`, `alacritty`, `foot`) |
