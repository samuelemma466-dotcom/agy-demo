import React from 'react';
import { Info, Smartphone, ExternalLink } from 'lucide-react';
import { systemApi } from '../../services/systemApi';

interface PhonePanelProps {
  phoneConnected: boolean;
  onSetPhoneConnected: (connected: boolean) => void;
  onShowNotification: (msg: string) => void;
}

export const PhonePanel: React.FC<PhonePanelProps> = ({ onShowNotification }) => (
  <section className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div className="disclaimer-banner">
      <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <p><strong>Omachy connection status:</strong> The standalone Connect window can start an expiring, TLS-protected desktop pairing listener with explicit approval. The Android client and phone-side pairing are not available yet.</p>
    </div>
    <div className="card">
      <div className="card-header">
        <div className="card-title"><Smartphone size={18} color="var(--accent-cyan)" /><span>Phone connection</span></div>
        <span className="badge badge-demo">Not paired</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        No device is reported connected. Start the real session in Omachy Connect to display its short-lived QR code and approve a pairing request.
      </p>
      <button className="btn btn-primary" onClick={async () => {
        try { await systemApi.launchApp('connect'); }
        catch { onShowNotification('Could not open Omachy Connect.'); }
      }}><ExternalLink size={14} /> Open Omachy Connect</button>
    </div>
  </section>
);
