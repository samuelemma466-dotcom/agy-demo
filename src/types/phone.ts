export type PhoneConnectionStatus = 'disconnected' | 'discovering' | 'pairing' | 'connected';

export interface PhoneDevice {
  id: string;
  name: string;
  model: string;
  batteryPercent: number;
  isCharging: boolean;
  ipAddress: string;
  lastSeen: string;
}

export interface PhoneFeatures {
  clipboardSync: boolean;
  notificationMirroring: boolean;
  mediaControls: boolean;
  smsTelephony: boolean;
}
