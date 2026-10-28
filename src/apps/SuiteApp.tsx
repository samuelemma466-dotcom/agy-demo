import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Smartphone,
  Send,
  Bot,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { systemApi, SystemStatusResponse } from '../services/systemApi';

interface SuiteAppProps {
  onOpenReferenceCompanion: () => void;
}

export const SuiteApp: React.FC<SuiteAppProps> = ({ onOpenReferenceCompanion }) => {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);

  useEffect(() => {
    systemApi.getStatus().then(setStatus).catch(console.error);
  }, []);

  const applications = [
    {
      id: 'control-center',
      title: 'Omachy Control Center',
      description: 'Compact utility window for Wi-Fi, Bluetooth, Audio, and Battery controls',
      icon: Sliders,
      accent: 'var(--accent-cyan)',
      shortcut: 'Quick Settings',
    },
    {
      id: 'connect',
      title: 'Omachy Connect',
      description: 'Phone integration with KDE Connect detection, pairing, and sync toggles',
      icon: Smartphone,
      accent: 'var(--accent-purple)',
      shortcut: 'Phone Companion',
    },
    {
      id: 'drop',
      title: 'Omachy Drop',
      description: 'Actual file transfers and staged file sharing into ~/Downloads/OmachyDrop',
      icon: Send,
      accent: 'var(--accent-emerald)',
      shortcut: 'File Beam',
    },
    {
      id: 'jarvis',
      title: 'Omachy Jarvis',
      description: 'AI assistant distinguishing suggestions from confirmed shell executions',
      icon: Bot,
      accent: 'var(--accent-amber)',
      shortcut: 'Shell Assistant',
    },
    {
      id: 'developer',
      title: 'Omachy Developer Tools',
      description: 'Workspace project repositories, Git branch status, and terminal presets',
      icon: Terminal,
      accent: 'var(--accent-rose)',
      shortcut: 'Dev Hub',
    },
  ];

  const handleLaunch = (appId: string) => {
    systemApi.launchApp(appId);
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 10% 20%, rgba(30, 41, 59, 0.4) 0%, rgba(10, 13, 20, 1) 90%)',
        color: 'var(--text-primary)',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/omachy-icon.svg" width={42} height={42} alt="Omachy" />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Omachy Desktop Suite
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Native Linux Desktop Applications • Arch-based Omarchy Environment
            </p>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={onOpenReferenceCompanion}>
          <Layers size={14} />
          <span>Open Reference Companion</span>
        </button>
      </div>

      {/* Real System Telemetry Pill Banner */}
      {status && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Active Wi-Fi:</span>
            <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', marginTop: 2 }}>
              {status.wifi.active ? status.wifi.active.ssid : 'Disconnected'}
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Audio Volume:</span>
            <div style={{ fontWeight: 600, marginTop: 2 }}>
              {status.audio.muted ? 'Muted' : `${status.audio.volume}% (PipeWire)`}
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Battery Status:</span>
            <div style={{ fontWeight: 600, color: '#34d399', marginTop: 2 }}>
              {status.battery.available ? `${status.battery.capacity}% (${status.battery.status})` : 'AC Power'}
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Desktop Session:</span>
            <div style={{ fontWeight: 600, color: 'var(--accent-purple)', marginTop: 2 }}>
              {status.desktop.wm} ({status.desktop.session})
            </div>
          </div>
        </div>
      )}

      {/* Grid of Independent Applications */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
          STANDALONE UTILITIES (LAUNCH INDEPENDENT WINDOWS)
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {applications.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={22} color={app.accent} />
                  </div>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' }}>
                    {app.shortcut}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{app.title}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                    {app.description}
                  </p>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 'auto' }}
                  onClick={() => handleLaunch(app.id)}
                >
                  <ExternalLink size={14} />
                  <span>Launch Independent Window</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architecture & Safety Note */}
      <div
        style={{
          marginTop: 'auto',
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} color="#10b981" />
          <span>
            Every application runs in regular user space with zero root permissions. Launchable via CLI:
            <code className="font-mono" style={{ color: 'var(--accent-cyan)', marginLeft: 6 }}>
              ./bin/omachy [app-name]
            </code>
          </span>
        </div>
      </div>
    </div>
  );
};
