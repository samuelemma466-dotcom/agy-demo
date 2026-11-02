"""
Omachy Desktop — Real Linux System Bridge Module
Interacts with:
- NetworkManager (nmcli)
- BlueZ (bluetoothctl)
- PipeWire / WirePlumber (wpctl)
- Linux sysfs (/sys/class/power_supply)
- KDE Connect (kdeconnect-cli)
- File sharing (~/Downloads/OmachyDrop)
"""

import os
import shutil
import subprocess
import json
from pathlib import Path

from display_env import graphical_environment

DROP_DIR = Path.home() / "Downloads" / "OmachyDrop"

# Client-facing execution is intentionally limited to these fixed, read-only
# argument vectors. Never accept a command string from a client or invoke a shell.
ALLOWED_ACTIONS = {
    "process_summary": ["ps", "-eo", "pid,comm,%cpu,%mem", "--sort=-%cpu"],
    "disk_usage": ["df", "-h", "/"],
    "network_interfaces": ["ip", "-br", "addr"],
    "user_services": ["systemctl", "--user", "list-units", "--type=service", "--state=running", "--no-pager"],
    "git_status": ["git", "-C", str(Path(__file__).resolve().parent.parent), "status", "-sb"],
    "docker_containers": ["docker", "ps", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"],
}


def run_allowed_action(action: str):
    """Run one explicitly permitted read-only action with a fixed argv."""
    argv = ALLOWED_ACTIONS.get(action)
    if argv is None:
        return {"success": False, "error": "Action is not permitted."}
    if not shutil.which(argv[0]):
        return {"success": False, "error": f"Required program is unavailable: {argv[0]}"}
    try:
        proc = subprocess.run(
            argv,
            shell=False,
            text=True,
            capture_output=True,
            timeout=8,
            cwd=str(Path.home()),
        )
        return {
            "success": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": proc.stdout[:16000],
            "stderr": proc.stderr[:4000],
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Action timed out after 8 seconds."}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_wifi_status():
    """Queries real NetworkManager status and active Wi-Fi via nmcli."""
    if not shutil.which("nmcli"):
        return {"available": False, "reason": "nmcli not installed"}

    try:
        # Check radio
        radio_out = subprocess.check_output(
            ["nmcli", "radio", "wifi"], text=True, timeout=2
        ).strip()
        enabled = radio_out.lower() == "enabled"

        # List networks
        out = subprocess.check_output(
            ["nmcli", "-t", "-f", "ACTIVE,SSID,SIGNAL,SECURITY", "dev", "wifi"],
            text=True,
            timeout=4,
        )

        networks = []
        active_net = None

        for line in out.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 3:
                is_active = parts[0] == "yes"
                ssid = parts[1] or "(Hidden Network)"
                signal = int(parts[2]) if parts[2].isdigit() else 0
                security = parts[3] if len(parts) > 3 else "Open"
                item = {
                    "ssid": ssid,
                    "signal": signal,
                    "security": security,
                    "active": is_active,
                }
                if is_active and not active_net:
                    active_net = item
                networks.append(item)

        return {
            "available": True,
            "enabled": enabled,
            "active": active_net,
            "networks": networks[:8],
        }
    except Exception as e:
        return {"available": False, "error": str(e)}


def set_wifi_radio(enabled: bool):
    """Toggle Wi-Fi radio on/off."""
    if not shutil.which("nmcli"):
        return {"success": False, "error": "nmcli not found"}
    try:
        state = "on" if enabled else "off"
        subprocess.check_call(["nmcli", "radio", "wifi", state], timeout=3)
        return {"success": True, "enabled": enabled}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_bluetooth_status():
    """Queries BlueZ status via bluetoothctl."""
    if not shutil.which("bluetoothctl"):
        return {"available": False, "reason": "bluetoothctl not installed"}

    try:
        show_out = subprocess.check_output(
            ["bluetoothctl", "show"], text=True, timeout=2
        )
        powered = "Powered: yes" in show_out

        paired = []
        d_out = subprocess.check_output(
            ["bluetoothctl", "devices", "Paired"], text=True, timeout=2
        )
        for line in d_out.strip().split("\n"):
            if line.startswith("Device "):
                parts = line.split(" ", 2)
                paired.append(
                    {
                        "mac": parts[1],
                        "name": parts[2] if len(parts) > 2 else parts[1],
                    }
                )

        return {"available": True, "powered": powered, "paired_devices": paired}
    except Exception as e:
        return {"available": False, "error": str(e)}


def set_bluetooth_power(enabled: bool):
    """Toggle Bluetooth power on/off."""
    if not shutil.which("bluetoothctl"):
        return {"success": False, "error": "bluetoothctl not found"}
    try:
        state = "on" if enabled else "off"
        subprocess.check_call(["bluetoothctl", "power", state], timeout=3)
        return {"success": True, "powered": enabled}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_audio_status():
    """Queries audio sink volume and mute state via wpctl or pactl."""
    if shutil.which("wpctl"):
        try:
            vol_out = subprocess.check_output(
                ["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"],
                text=True,
                timeout=2,
            ).strip()
            # Format: 'Volume: 1.00' or 'Volume: 1.00 [MUTED]'
            parts = vol_out.split()
            vol = float(parts[1]) if len(parts) > 1 else 1.0
            muted = "[MUTED]" in vol_out

            return {
                "available": True,
                "backend": "wireplumber",
                "volume": int(round(vol * 100)),
                "muted": muted,
                "sink_name": "Built-in Audio Analog Stereo",
            }
        except Exception as e:
            return {"available": False, "error": str(e)}
    elif shutil.which("pactl"):
        try:
            out = subprocess.check_output(["pactl", "get-sink-volume", "@DEFAULT_SINK@"], text=True, timeout=2)
            muted_out = subprocess.check_output(["pactl", "get-sink-mute", "@DEFAULT_SINK@"], text=True, timeout=2)
            muted = "yes" in muted_out.lower()
            # Parse percentage
            vol = 100
            for part in out.split():
                if part.endswith("%"):
                    vol = int(part[:-1])
                    break
            return {"available": True, "backend": "pulseaudio", "volume": vol, "muted": muted}
        except Exception as e:
            return {"available": False, "error": str(e)}
    return {"available": False, "reason": "Neither wpctl nor pactl found"}


def set_audio_volume(percent: int):
    """Set default audio sink volume (0-100%)."""
    percent = max(0, min(100, percent))
    vol_float = percent / 100.0

    if shutil.which("wpctl"):
        try:
            subprocess.check_call(
                ["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", f"{vol_float:.2f}"],
                timeout=2,
            )
            return {"success": True, "volume": percent}
        except Exception as e:
            return {"success": False, "error": str(e)}
    elif shutil.which("pactl"):
        try:
            subprocess.check_call(
                ["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{percent}%"],
                timeout=2,
            )
            return {"success": True, "volume": percent}
        except Exception as e:
            return {"success": False, "error": str(e)}
    return {"success": False, "error": "No audio controller found"}


def toggle_audio_mute():
    """Toggle mute for default audio sink."""
    if shutil.which("wpctl"):
        try:
            subprocess.check_call(
                ["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"],
                timeout=2,
            )
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    return {"success": False, "error": "wpctl not found"}


def get_battery_status():
    """Read battery percentage and charging status from Linux sysfs."""
    cap_path = Path("/sys/class/power_supply/BAT0/capacity")
    stat_path = Path("/sys/class/power_supply/BAT0/status")

    if cap_path.exists():
        try:
            cap = int(cap_path.read_text().strip())
            status = stat_path.read_text().strip() if stat_path.exists() else "Unknown"
            return {"available": True, "capacity": cap, "status": status}
        except Exception as e:
            return {"available": False, "error": str(e)}

    # Check for other battery supplies
    for bat in Path("/sys/class/power_supply").glob("BAT*"):
        try:
            cap = int((bat / "capacity").read_text().strip())
            status = (bat / "status").read_text().strip()
            return {"available": True, "capacity": cap, "status": status}
        except Exception:
            pass

    return {"available": False, "reason": "No battery detected (Desktop / AC system)"}


def get_kdeconnect_status():
    """Checks whether KDE Connect is installed and running."""
    cli = shutil.which("kdeconnect-cli")
    if not cli:
        return {
            "installed": False,
            "status": "not_installed",
            "message": "KDE Connect CLI (kdeconnect-cli) is not installed on this system.",
            "paired_devices": [],
        }

    try:
        out = subprocess.check_output(
            ["kdeconnect-cli", "-l"], text=True, timeout=3
        )
        devices = []
        for line in out.strip().split("\n"):
            if line:
                devices.append(line.strip())
        return {
            "installed": True,
            "status": "active",
            "devices": devices,
            "message": "KDE Connect daemon active",
        }
    except Exception as e:
        return {"installed": True, "status": "error", "message": str(e)}


def get_drop_files():
    """Lists actual files in ~/Downloads/OmachyDrop."""
    files = []
    if DROP_DIR.exists():
        for f in DROP_DIR.iterdir():
            if f.is_file():
                stat = f.stat()
                files.append(
                    {
                        "name": f.name,
                        "size": stat.st_size,
                        "modified": int(stat.st_mtime),
                        "path": str(f.resolve()),
                    }
                )
    return {"dir": str(DROP_DIR), "files": files}


def open_drop_folder():
    """Opens ~/Downloads/OmachyDrop in the default desktop file manager."""
    DROP_DIR.mkdir(parents=True, exist_ok=True)
    opener = shutil.which("xdg-open")
    if not opener:
        return {"success": False, "error": "xdg-open not available"}
    # Some Omarchy sessions set a forced GDK_BACKEND list for embedded GTK
    # windows. Don't pass that override to the separate file-manager process;
    # it can prevent Nautilus from initializing its Wayland display/portals.
    child_env = graphical_environment()
    child_env.pop("GDK_BACKEND", None)
    try:
        subprocess.Popen(
            [opener, str(DROP_DIR)],
            env=child_env,
            start_new_session=True,
            close_fds=True,
        )
        return {"success": True, "path": str(DROP_DIR)}
    except OSError as exc:
        return {"success": False, "error": f"Could not start the file manager: {exc}"}


def collect_system_summary():
    """Collects complete real system status for Control Center."""
    return {
        "wifi": get_wifi_status(),
        "bluetooth": get_bluetooth_status(),
        "audio": get_audio_status(),
        "battery": get_battery_status(),
        "kdeconnect": get_kdeconnect_status(),
        "drop_dir": str(DROP_DIR),
        "desktop": {
            "os": "Omarchy (Arch Linux)",
            "wm": os.environ.get("XDG_CURRENT_DESKTOP", "Hyprland"),
            "session": os.environ.get("XDG_SESSION_TYPE", "wayland"),
        },
    }
