"""Recover the graphical session environment for apps launched by the service.

The omachy-connect systemd user service starts before the Hyprland session has
exported WAYLAND_DISPLAY/DISPLAY into the service environment. A GTK app such
as app_runner.py inheriting that stale environment aborts with
"Gtk couldn't be initialized". These helpers copy the live session variables
from the user manager and from a running compositor/bar process.
"""

import os
import subprocess
from pathlib import Path

_DISPLAY_VARIABLES = {
    "DISPLAY",
    "WAYLAND_DISPLAY",
    "XAUTHORITY",
    "XDG_RUNTIME_DIR",
    "DBUS_SESSION_BUS_ADDRESS",
    "XDG_SESSION_TYPE",
    "XDG_SESSION_DESKTOP",
    "XDG_CURRENT_DESKTOP",
    "HYPRLAND_INSTANCE_SIGNATURE",
    "HYPRLAND_CMD",
    "PATH",
    "XDG_DATA_HOME",
    "XDG_DATA_DIRS",
    "XDG_CONFIG_HOME",
    "XDG_CONFIG_DIRS",
    "XDG_CACHE_HOME",
}

_SESSION_PROCESS_NAMES = {"quickshell", "Hyprland", "hyprland", "uwsm"}


def _read_display_environ(pid):
    try:
        raw = Path(f"/proc/{pid}/environ").read_bytes()
    except OSError:
        return {}
    values = {}
    for entry in raw.split(b"\0"):
        key, separator, value = entry.partition(b"=")
        if not separator:
            continue
        try:
            name = key.decode("utf-8")
            text = value.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if name in _DISPLAY_VARIABLES:
            values[name] = text
    return values


def _manager_environ():
    try:
        completed = subprocess.run(
            ["systemctl", "--user", "show-environment"],
            capture_output=True, text=True, timeout=2, check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return {}
    values = {}
    for line in completed.stdout.splitlines():
        name, separator, text = line.partition("=")
        if separator and name in _DISPLAY_VARIABLES:
            values[name] = text
    return values


def _live_session_environ():
    try:
        entries = list(os.scandir("/proc"))
    except OSError:
        return {}
    for entry in entries:
        if not entry.name.isdigit():
            continue
        try:
            command = Path(entry.path, "cmdline").read_bytes().split(b"\0")
        except OSError:
            continue
        if not command:
            continue
        executable = os.path.basename(command[0].decode("utf-8", "ignore"))
        if executable not in _SESSION_PROCESS_NAMES:
            continue
        values = _read_display_environ(int(entry.name))
        if values.get("WAYLAND_DISPLAY") or values.get("DISPLAY"):
            return values
    return {}


def graphical_environment():
    """Return os.environ plus the live graphical session variables."""
    environment = os.environ.copy()
    environment.update(_manager_environ())
    environment.update(_live_session_environ())
    return environment
