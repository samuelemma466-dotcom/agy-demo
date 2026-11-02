# Omachy Studio desktop assets

The repository copies are the editable source of truth:

- `omachy-studio/` contains the Omarchy 4 theme, its shell palette, Hyprland theme Lua, original wallpaper, preview and preview-only icon assets.
- `omachy-dock/` contains the Quickshell plugin manifest and QML implementation.
- `omachy-dock-activation.patch` is the separately reviewed, optional change that adds the dock ID to `~/.config/omarchy/shell.json`.

The user-level copies live under `~/.config/omarchy/themes/omachy-studio/` and `~/.config/omarchy/plugins/omachy-dock/`. They are deployment copies. Re-copy the corresponding project files there after edits, backing up each existing destination first. The wallpaper goes under the theme's `backgrounds/` directory; Omarchy 4.0.4 discovers and selects image files from that directory during theme activation.

## Implementation status

- The theme provides Omarchy shell colors for the existing top bar, menus, launcher, tooltips, notifications, lock screen, and polkit surfaces. Its `hyprland.lua` configures borders, window rounding, subtle opacity, blur, shadows, gaps, and modest window/workspace animations.
- The current `shell.json` remains the system's existing panel layout. It already has the Omarchy menu, workspaces, indicators, clock, keyboard layout, weather, system update, tray, agents, Bluetooth, network, audio, monitor, and power widgets. No replacement panel or control system is included.
- The dock is a `panel` plugin with its own Wayland layer namespace, instantiated per connected screen. It reads installed desktop entries, displays the configured favourites that exist, uses their icons, focuses a matching live window or starts the entry with `uwsm-app -- gtk-launch <desktop-id>.desktop`, and updates its indicators from Quickshell's Wayland toplevel model. If several windows match, it prefers the focused one and otherwise uses the first matching toplevel in model order.
- The design preview is an illustration, not a desktop capture. Its Wi-Fi, Bluetooth, sound and notification card is illustrative; those real actions remain in Omarchy's existing top-panel widgets and panels. The preview's app icons come from installed app assets and the Omachy desktop entries.
- Hyprland provides the window frame effects used here, not a universal native title bar. GTK, Qt and browser title bars continue to depend on each application's own decoration support. Omachy's embedded application surfaces share the CSS token palette; unrelated application internals are not themed by this project.

## Safe review commands

```bash
omarchy plugin validate ~/.config/omarchy/plugins/omachy-dock
luac -p ~/.config/omarchy/themes/omachy-studio/hyprland.lua
/usr/lib/qt6/bin/qmlformat --ignore-settings ~/.config/omarchy/plugins/omachy-dock/Dock.qml >/dev/null
```

The installed Quickshell API is 0.3.1. The QML has not been runtime-tested because the Omarchy shell is not running in the current session and testing it would require starting a visible layer-shell panel. Do not treat static checks as proof of interactive focus/launch behavior.
