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

export interface PhoneSessionState {
  active: boolean;
  address?: string;
  port?: number;
  protocol?: number;
  fingerprint_sha256?: string;
  pairing_token?: string | null;
  qr_png_base64?: string;
  persistent?: boolean;
  expires_at?: number;
  pending: Array<{ id: string; device_name: string }>;
  devices: Array<{ name: string; connected_at: number; auto_accept?: boolean }>;
  transfers?: TransferRecord[];
}

export interface TransferRecord {
  id: string;
  name: string;
  size: number;
  direction: 'phone_to_desktop' | 'desktop_to_phone';
  status: 'offered' | 'accepted' | 'source_uploading' | 'transferring' | 'awaiting_verification' | 'completed' | 'rejected' | 'canceled' | 'failed';
  bytes_transferred: number;
  source_bytes?: number;
  progress: number;
  sha256?: string | null;
  created_at: number;
  mtime?: number | null;
  device_name: string;
  error?: string | null;
  saved_path?: string;
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

  async getPhoneInterfaces(): Promise<{ interfaces: Array<{ interface: string; address: string; wireless?: boolean }>; error?: string }> {
    const res = await fetch(`${API_BASE}/api/connect/interfaces`);
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async getPhoneSession(): Promise<PhoneSessionState> {
    const res = await fetch(`${API_BASE}/api/connect/session`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async getTransfers(): Promise<{ transfers: TransferRecord[] }> {
    const res = await fetch(`${API_BASE}/api/drop/transfers`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  },

  async createDesktopTransfer(name: string, size: number, deviceName: string): Promise<TransferRecord> {
    const res = await fetch(`${API_BASE}/api/drop/transfers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, size, device_name: deviceName }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async uploadDesktopSourceChunk(id: string, start: number, total: number, chunk: Blob): Promise<TransferRecord> {
    const res = await fetch(`${API_BASE}/api/drop/transfers/${encodeURIComponent(id)}/source`, {
      method: 'POST', headers: {
        'Content-Type': 'application/octet-stream',
        'X-Omachy-Chunk-Start': String(start),
        'X-Omachy-File-Size': String(total),
      }, body: chunk,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async decideTransfer(id: string, accepted: boolean): Promise<TransferRecord> {
    const res = await fetch(`${API_BASE}/api/drop/transfers/${encodeURIComponent(id)}/decision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async cancelTransfer(id: string): Promise<TransferRecord> {
    const res = await fetch(`${API_BASE}/api/drop/transfers/${encodeURIComponent(id)}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async startPhoneSession(address: string, persistent = true): Promise<PhoneSessionState> {
    const res = await fetch(`${API_BASE}/api/connect/session/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, persistent }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async stopPhoneSession(): Promise<PhoneSessionState> {
    const res = await fetch(`${API_BASE}/api/connect/session/stop`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async decidePhonePairing(requestId: string, approved: boolean): Promise<PhoneSessionState> {
    const res = await fetch(`${API_BASE}/api/connect/pairing/decision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, approved }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async forgetDevice(name: string): Promise<PhoneSessionState> {
    const res = await fetch(`${API_BASE}/api/connect/devices/forget`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async setDeviceAutoAccept(name: string, autoAccept: boolean): Promise<Array<{ name: string; auto_accept?: boolean }>> {
    const res = await fetch(`${API_BASE}/api/connect/devices/auto-accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, auto_accept: autoAccept }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result.devices ?? [];
  },

  async listDevices(): Promise<Array<{ name: string }>> {
    const res = await fetch(`${API_BASE}/api/connect/devices`, { method: 'GET' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
    return result.devices ?? [];
  },

  async openDropFolder(): Promise<{ success: boolean; path?: string }> {
    const res = await fetch(`${API_BASE}/api/drop/open-folder`, { method: 'POST' });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || `HTTP error ${res.status}`);
    return result;
  },

  async stageDropFile(filename: string, content: string): Promise<{ success: boolean; path: string }> {
    const res = await fetch(`${API_BASE}/api/drop/stage-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
    });
    return res.json();
  },

  async runAllowedAction(action: string): Promise<JarvisExecResult> {
    const res = await fetch(`${API_BASE}/api/actions/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
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
