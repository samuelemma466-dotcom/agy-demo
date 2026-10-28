import React, { useState } from 'react';
import {
  Palette,
  ShieldCheck,
  Info,
  Check,
  Lock,
} from 'lucide-react';

interface SettingsPanelProps {
  onShowNotification: (msg: string) => void;
}

interface AccentOption {
  name: string;
  color: string;
  rgb: string;
}

const ACCENT_OPTIONS: AccentOption[] = [
  { name: 'Neon Cyan', color: '#38bdf8', rgb: '56, 189, 248' },
  { name: 'Electric Blue', color: '#3b82f6', rgb: '59, 130, 246' },
  { name: 'Hyper Indigo', color: '#6366f1', rgb: '99, 102, 241' },
  { name: 'Vibrant Purple', color: '#a855f7', rgb: '168, 85, 247' },
  { name: 'Emerald Mint', color: '#10b981', rgb: '16, 185, 129' },
  { name: 'Solar Amber', color: '#f59e0b', rgb: '245, 158, 11' },
  { name: 'Rose Coral', color: '#f43f5e', rgb: '244, 63, 94' },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onShowNotification }) => {
  const [selectedAccent, setSelectedAccent] = useState<string>('#38bdf8');
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [glassTransparency, setGlassTransparency] = useState(72);

  const handleAccentChange = (accent: AccentOption) => {
    setSelectedAccent(accent.color);
    document.documentElement.style.setProperty('--accent-cyan', accent.color);
    document.documentElement.style.setProperty('--accent-active', accent.color);
    document.documentElement.style.setProperty('--accent-active-rgb', accent.rgb);
    onShowNotification(`Theme accent updated to ${accent.name}`);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="dashboard-grid">
        {/* Appearance Settings (6 cols) */}
        <div className="col-6">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Palette size={18} color="var(--accent-active)" />
                <span>Appearance & Glass Theme</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Accent Color Picker */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                  Accent Highlight Color
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {ACCENT_OPTIONS.map((accent) => {
                    const isSelected = selectedAccent === accent.color;
                    return (
                      <button
                        key={accent.name}
                        onClick={() => handleAccentChange(accent)}
                        title={accent.name}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: accent.color,
                          border: isSelected ? '3px solid #ffffff' : '2px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isSelected ? `0 0 12px ${accent.color}` : 'none',
                          cursor: 'pointer',
                          transition: 'transform var(--transition-fast)',
                        }}
                      >
                        {isSelected && <Check size={14} color="#000000" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Glass Transparency Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500 }}>Acrylic Glass Opacity</label>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{glassTransparency}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="95"
                  value={glassTransparency}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setGlassTransparency(val);
                    document.documentElement.style.setProperty(
                      '--bg-glass',
                      `rgba(18, 24, 38, ${val / 100})`
                    );
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-active)' }}
                />
              </div>

              {/* Smooth Animations */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Smooth Dock & Panel Transitions</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Enable subtle hover magnification and fade effects
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableAnimations}
                  onChange={(e) => setEnableAnimations(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* System & Safety Controls (6 cols) */}
        <div className="col-6">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <ShieldCheck size={18} color="#10b981" />
                <span>Companion Safety & Shortcuts</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Hotkey preview */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Global Command Palette</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Trigger search and quick actions from anywhere
                  </div>
                </div>
                <kbd className="kbd-shortcut" style={{ fontSize: '12px', padding: '4px 8px' }}>
                  Ctrl + K
                </kbd>
              </div>

              {/* Auto-start (Locked per safety rule) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(244, 63, 94, 0.05)',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={13} />
                    <span>Auto-Start on Boot (Disabled)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#f87171' }}>
                    Disabled by safety guidelines. No background daemons auto-registered.
                  </div>
                </div>
                <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fca5a5' }}>
                  Locked
                </span>
              </div>

              {/* Root elevation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#6ee7b7' }}>
                    Non-Root Execution
                  </div>
                  <div style={{ fontSize: '11px', color: '#a7f3d0' }}>
                    Application runs completely within regular user permissions.
                  </div>
                </div>
                <span className="badge badge-online">Compliant</span>
              </div>
            </div>
          </div>
        </div>

        {/* About Omachy Desktop (12 cols) */}
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Info size={18} color="var(--accent-cyan)" />
                <span>About Omachy Desktop Companion</span>
              </div>
              <span className="badge badge-primary">Version 0.1.0-prototype</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: '10px' }}>
                Omachy Desktop is a modern, open-source Linux companion hub built from scratch with React,
                TypeScript, Vite, and custom CSS. It embraces a clean, macOS-inspired floating aesthetic while
                maintaining complete architectural independence—utilizing open standards like the KDE Connect
                protocol, custom glassmorphism styles, and zero Apple proprietary assets or code.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                <span>License: MIT Open Source</span>
                <span>•</span>
                <span>OS: Linux (Omarchy / Arch-based)</span>
                <span>•</span>
                <span>Directory: /home/biggiesam/agy-demo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
