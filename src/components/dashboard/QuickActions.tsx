import React, { useState } from 'react';
import {
  BellOff,
  Bell,
  Copy,
  Check,
  Camera,
  Terminal,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';
import { NavigationTab } from '../../types/navigation';

interface QuickActionsProps {
  onNavigate: (tab: NavigationTab) => void;
  onShowNotification: (msg: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNavigate,
  onShowNotification,
}) => {
  const [dndActive, setDndActive] = useState<boolean>(false);
  const [copiedIp, setCopiedIp] = useState<boolean>(false);

  const handleToggleDnd = () => {
    const next = !dndActive;
    setDndActive(next);
    onShowNotification(next ? 'Do Not Disturb Enabled' : 'Do Not Disturb Disabled');
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText('192.168.1.105');
    setCopiedIp(true);
    onShowNotification('Copied local IP (192.168.1.105) to clipboard');
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handleScreenshot = () => {
    onShowNotification('Screenshot captured: ~/Pictures/Screenshot_2026-10-28.png (simulated)');
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Zap size={18} color="var(--accent-amber)" />
          <span>Quick Actions</span>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Desktop Controls
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
        }}
      >
        {/* Do Not Disturb */}
        <button
          className="btn btn-secondary"
          onClick={handleToggleDnd}
          style={{
            flexDirection: 'column',
            padding: '12px 10px',
            gap: '8px',
            background: dndActive ? 'color-mix(in srgb, var(--status-busy) 15%, transparent)' : 'rgba(255, 255, 255, 0.03)',
            borderColor: dndActive ? 'color-mix(in srgb, var(--status-busy) 35%, transparent)' : 'var(--border-subtle)',
          }}
        >
          {dndActive ? <BellOff size={20} color="var(--status-busy)" /> : <Bell size={20} />}
          <span style={{ fontSize: '12px', fontWeight: 500 }}>
            {dndActive ? 'DND Active' : 'Do Not Disturb'}
          </span>
        </button>

        {/* Copy Local IP */}
        <button
          className="btn btn-secondary"
          onClick={handleCopyIp}
          style={{ flexDirection: 'column', padding: '12px 10px', gap: '8px' }}
        >
          {copiedIp ? <Check size={20} color="var(--status-online)" /> : <Copy size={20} />}
          <span style={{ fontSize: '12px', fontWeight: 500 }}>
            {copiedIp ? 'IP Copied' : 'Copy Local IP'}
          </span>
        </button>

        {/* Screenshot action */}
        <button
          className="btn btn-secondary"
          onClick={handleScreenshot}
          style={{ flexDirection: 'column', padding: '12px 10px', gap: '8px' }}
        >
          <Camera size={20} color="var(--accent-cyan)" />
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Capture Screen</span>
        </button>

        {/* Terminal Shortcut */}
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate('developer')}
          style={{ flexDirection: 'column', padding: '12px 10px', gap: '8px' }}
        >
          <Terminal size={20} color="var(--accent-purple)" />
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Terminal Tools</span>
        </button>

        {/* File Transfer */}
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate('files')}
          style={{ flexDirection: 'column', padding: '12px 10px', gap: '8px' }}
        >
          <Send size={20} color="var(--accent-emerald)" />
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Transfer Files</span>
        </button>

        {/* Ask Jarvis */}
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate('jarvis')}
          style={{ flexDirection: 'column', padding: '12px 10px', gap: '8px' }}
        >
          <Sparkles size={20} color="var(--accent-active)" />
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Ask Jarvis AI</span>
        </button>
      </div>
    </div>
  );
};
