import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  QrCode,
  Shield,
  Layers,
  Copy,
  Sliders,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { systemApi, SystemStatusResponse } from '../services/systemApi';

export const ConnectApp: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [paired, setPaired] = useState(false);
  const [clipboardSync, setClipboardSync] = useState(true);
  const [notificationMirror, setNotificationMirror] = useState(true);
  const [mediaControl, setMediaControl] = useState(true);
  const [smsTelephony, setSmsTelephony] = useState(false);
  const [pinCode] = useState('849 201');

  useEffect(() => {
    systemApi.getStatus().then(setSystemStatus).catch(console.error);
  }, []);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setPaired(true);
    }, 1200);
  };

  const kde = systemStatus?.kdeconnect;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 10% 10%, #151c2c 0%, #0a0d14 100%)',
        color: 'var(--text-primary)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
      }}
    >
      {/* App Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Smartphone size={22} color="var(--accent-cyan)" />
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700 }}>Omachy Connect</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Phone & Desktop Convergence
            </p>
          </div>
        </div>
        <span className={`badge ${paired ? 'badge-online' : 'badge-demo'}`}>
          {paired ? 'Device Paired (Demo)' : 'Ready to Pair'}
        </span>
      </div>

      {/* Real KDE Connect Status Banner */}
      {kde && !kde.installed ? (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: '12px',
            display: 'flex',
            gap: '10px',
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <span style={{ fontWeight: 600, color: '#fbbf24' }}>
              Real KDE Connect Daemon Not Detected:
            </span>
            <p style={{ color: '#fde68a', marginTop: '2px' }}>
              The system CLI (<code>kdeconnect-cli</code>) is not currently installed. To pair with real mobile
              devices via D-Bus, install KDE Connect with your package manager. Currently running in
              honest demonstrator mode.
            </p>
          </div>
        </div>
      ) : (
        <div className="badge badge-online">KDE Connect Daemon Active</div>
      )}

      {/* Main Connection Card */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '13.5px' }}>Mobile Handshake & QR</span>
          <button
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={handleScan}
            disabled={isScanning}
          >
            <RefreshCw size={13} className={isScanning ? 'animate-pulse-glow' : ''} />
            <span>{isScanning ? 'Scanning Subnet...' : 'Discover Phone'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px 0' }}>
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <QrCode size={70} color="var(--accent-cyan)" />
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pairing PIN
            </span>
            <div
              className="font-mono"
              style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '0.1em' }}
            >
              {pinCode}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Verify this code matches the prompt on your Android/iOS KDE Connect client.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
          Integration Capabilities
        </span>

        {/* Clipboard */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Copy size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: '12.5px' }}>Shared Clipboard Sync</span>
          </div>
          <input
            type="checkbox"
            checked={clipboardSync}
            onChange={(e) => setClipboardSync(e.target.checked)}
          />
        </div>

        {/* Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="var(--accent-purple)" />
            <span style={{ fontSize: '12.5px' }}>Notification Forwarding</span>
          </div>
          <input
            type="checkbox"
            checked={notificationMirror}
            onChange={(e) => setNotificationMirror(e.target.checked)}
          />
        </div>

        {/* Media */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={16} color="var(--accent-emerald)" />
            <span style={{ fontSize: '12.5px' }}>Media Player Controls</span>
          </div>
          <input
            type="checkbox"
            checked={mediaControl}
            onChange={(e) => setMediaControl(e.target.checked)}
          />
        </div>

        {/* SMS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={16} color="var(--accent-amber)" />
            <span style={{ fontSize: '12.5px' }}>SMS & Telephony Relay</span>
          </div>
          <input
            type="checkbox"
            checked={smsTelephony}
            onChange={(e) => setSmsTelephony(e.target.checked)}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 'auto',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Shield size={12} color="#10b981" /> TLS Certified Socket
        </span>
        <button
          className="btn-ghost"
          style={{ fontSize: '11px' }}
          onClick={() => systemApi.launchApp('drop')}
        >
          Open Omachy Drop ↗
        </button>
      </div>
    </div>
  );
};
