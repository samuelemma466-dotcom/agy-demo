/**
 * Omachy System API Client
 * Interfaces with the local Linux daemon (127.0.0.1:48123) for real system integrations.
 */

export interface SystemStatusResponse {
  wifi: {
    available: boolean;
    enabled?: boolean;
    active?: {
      ssid: string;
      signal: number;
      security: string;
      active: boolean;
    } | null;
    networks?: Array<{
      ssid: string;
      signal: number;
      security: string;
      active: boolean;
    }>;
    reason?: string;
  };
  bluetooth: {
    available: boolean;
    powered?: boolean;
    paired_devices?: Array<{
      mac: string;
      name: string;
    }>;
    reason?: string;
  };
  audio: {
    available: boolean;
    backend?: string;
    volume?: number;
    muted?: boolean;
    sink_name?: string;
    reason?: string;
  };
  battery: {
    available: boolean;
    capacity?: number;
    status?: string;
    reason?: string;
  };
  kdeconnect: {
    installed: boolean;
    status: string;
    message: string;
    devices?: string[];
  };
  drop_dir: string;
  desktop: {
    os: string;
    wm: string;
    session: string;
  };
}

export interface DropFile {
  name: string;
  size: number;
  modified: number;
  path: string;
}

export interface JarvisExecResult {
  success: boolean;
  returncode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

const API_BASE = 'http://127.0.0.1:48123';

export const systemApi = {
  async getStatus(): Promise<SystemStatusResponse> {
    const res = await fetch(`${API_BASE}/api/system/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async setVolume(volume: number): Promise<{ success: boolean; volume: number }> {
    const res = await fetch(`${API_BASE}/api/system/audio/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume }),
    });
    return res.json();
  },

  async toggleMute(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/system/audio/mute`, {
      method: 'POST',
    });
    return res.json();
  },

  async setBluetooth(powered: boolean): Promise<{ success: boolean; powered: boolean }> {
    const res = await fetch(`${API_BASE}/api/system/bluetooth/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ powered }),
    });
    return res.json();
  },

  async setWifiRadio(enabled: boolean): Promise<{ success: boolean; enabled: boolean }> {
    const res = await fetch(`${API_BASE}/api/system/wifi/radio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  },

  async scanWifi(): Promise<SystemStatusResponse['wifi']> {
    const res = await fetch(`${API_BASE}/api/system/wifi/scan`);
    return res.json();
  },

  async getDropFiles(): Promise<{ dir: string; files: DropFile[] }> {
    const res = await fetch(`${API_BASE}/api/drop/files`);
    return res.json();
  },

  async openDropFolder(): Promise<{ success: boolean; path?: string }> {
    const res = await fetch(`${API_BASE}/api/drop/open-folder`, { method: 'POST' });
    return res.json();
  },

  async stageDropFile(filename: string, content: string): Promise<{ success: boolean; path: string }> {
    const res = await fetch(`${API_BASE}/api/drop/stage-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
    });
    return res.json();
  },

  async executeJarvisCommand(command: string): Promise<JarvisExecResult> {
    const res = await fetch(`${API_BASE}/api/jarvis/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    return res.json();
  },

  async launchApp(app: string): Promise<{ success: boolean; launched: string }> {
    const res = await fetch(`${API_BASE}/api/app/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app }),
    });
    return res.json();
  },
};
