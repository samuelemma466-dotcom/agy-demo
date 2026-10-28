import React, { useState, useEffect } from 'react';
import { Search, Command, Clock, Smartphone, Sparkles } from 'lucide-react';
import { NavigationTab } from '../../types/navigation';

interface HeaderProps {
  currentTab: NavigationTab;
  onOpenCommandPalette: () => void;
  phoneConnected: boolean;
}

const TAB_TITLES: Record<NavigationTab, string> = {
  home: 'Dashboard Overview',
  files: 'My Files & Transfers',
  phone: 'Phone Companion',
  jarvis: 'Jarvis AI Assistant',
  developer: 'Developer Tools & Shell',
  settings: 'System & UI Settings',
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenCommandPalette,
  phoneConnected,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setDateStr(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="companion-header">
      <div className="header-left">
        <h1 className="page-title">{TAB_TITLES[currentTab]}</h1>
      </div>

      <div className="header-right">
        {/* Global Search Palette trigger button */}
        <button
          className="search-trigger-btn"
          onClick={onOpenCommandPalette}
          title="Open Command Palette (Ctrl+K)"
        >
          <Search size={14} />
          <span>Search or command...</span>
          <kbd className="kbd-shortcut">
            <Command size={10} style={{ display: 'inline', marginRight: 2 }} />
            K
          </kbd>
        </button>

        {/* Phone Connectivity status chip */}
        <div
          className={`badge ${phoneConnected ? 'badge-online' : 'badge-demo'}`}
          title={phoneConnected ? 'Connected via KDE Connect' : 'Phone disconnected (Demo mode)'}
        >
          <Smartphone size={12} />
          <span>{phoneConnected ? 'Phone Paired' : 'Phone: Demo Ready'}</span>
        </div>

        {/* Jarvis Status chip */}
        <div className="badge badge-primary" title="Jarvis Assistant Active">
          <Sparkles size={12} />
          <span>Jarvis Online</span>
        </div>

        {/* Live Clock / Date Pill */}
        <div className="header-time-badge">
          <Clock size={13} />
          <span>{timeStr}</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--text-muted)' }}>{dateStr}</span>
        </div>
      </div>
    </header>
  );
};
