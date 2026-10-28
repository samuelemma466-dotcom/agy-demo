import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dock } from './components/layout/Dock';
import { CommandPalette } from './components/command-palette/CommandPalette';
import { HomeDashboard } from './components/dashboard/HomeDashboard';
import { PhonePanel } from './components/phone/PhonePanel';
import { TransferPanel } from './components/transfers/TransferPanel';
import { JarvisPanel } from './components/jarvis/JarvisPanel';
import { DeveloperPanel } from './components/developer/DeveloperPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { NavigationTab, CommandPaletteItem } from './types/navigation';
import { CheckCircle2 } from 'lucide-react';
import './styles/index.css';
import './styles/components.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [phoneConnected, setPhoneConnected] = useState<boolean>(false);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => clearInterval(timer);
  }, [toastMessage]);

  // Global Keyboard Shortcuts (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen]);

  // Command palette registry
  const commandPaletteItems: CommandPaletteItem[] = [
    // Navigation
    {
      id: 'nav-home',
      title: 'Go to Home Dashboard',
      description: 'System overview, live clock, and quick actions',
      category: 'Navigation',
      iconName: 'home',
      action: () => setActiveTab('home'),
      keywords: ['dashboard', 'overview', 'clock', 'home'],
    },
    {
      id: 'nav-files',
      title: 'Go to My Files & Transfers',
      description: 'Beam files wirelessly and manage transfer queue',
      category: 'Navigation',
      iconName: 'files',
      action: () => setActiveTab('files'),
      keywords: ['transfer', 'send', 'receive', 'download', 'upload'],
    },
    {
      id: 'nav-phone',
      title: 'Go to Phone Companion',
      description: 'KDE Connect mobile pairing and notification sync',
      category: 'Navigation',
      iconName: 'phone',
      action: () => setActiveTab('phone'),
      keywords: ['mobile', 'android', 'ios', 'kde', 'pair', 'sms'],
    },
    {
      id: 'nav-jarvis',
      title: 'Go to Jarvis AI Assistant',
      description: 'Interactive companion for system tasks & prompts',
      category: 'Navigation',
      iconName: 'jarvis',
      action: () => setActiveTab('jarvis'),
      keywords: ['ai', 'assistant', 'chat', 'ollama', 'llm'],
    },
    {
      id: 'nav-developer',
      title: 'Go to Developer Tools',
      description: 'Workspace repositories and terminal presets',
      category: 'Navigation',
      iconName: 'developer',
      action: () => setActiveTab('developer'),
      keywords: ['git', 'shell', 'bash', 'projects', 'htop'],
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      description: 'Accent colors, glass opacity, and companion preferences',
      category: 'Navigation',
      iconName: 'settings',
      action: () => setActiveTab('settings'),
      keywords: ['theme', 'appearance', 'hotkeys', 'privacy'],
    },

    // Actions
    {
      id: 'act-copy-ip',
      title: 'Copy Local IP Address',
      description: 'Copy 192.168.1.105 to clipboard',
      category: 'Actions',
      iconName: 'action',
      action: () => {
        navigator.clipboard.writeText('192.168.1.105');
        showNotification('Copied local IP address to clipboard');
      },
      keywords: ['network', 'ip', 'lan', 'wifi'],
    },
    {
      id: 'act-screenshot',
      title: 'Capture Desktop Screenshot',
      description: 'Take a snapshot of current companion view',
      category: 'Actions',
      iconName: 'action',
      action: () => {
        showNotification('Screenshot saved to ~/Pictures/ (Simulated)');
      },
      keywords: ['capture', 'screenshot', 'photo', 'screen'],
    },
    {
      id: 'act-term-htop',
      title: 'Run Process Viewer (htop)',
      description: 'Open interactive process monitor preset',
      category: 'Developer',
      iconName: 'developer',
      action: () => {
        setActiveTab('developer');
        navigator.clipboard.writeText('htop');
        showNotification('Switched to Developer tools & copied "htop"');
      },
      keywords: ['htop', 'process', 'cpu', 'memory'],
    },
    {
      id: 'act-term-git',
      title: 'Git Status Summary',
      description: 'Copy "git status -sb" to clipboard',
      category: 'Developer',
      iconName: 'developer',
      action: () => {
        navigator.clipboard.writeText('git status -sb');
        showNotification('Copied "git status -sb" to clipboard');
      },
      keywords: ['git', 'repo', 'status'],
    },
    {
      id: 'act-pair-phone',
      title: 'Scan for Mobile Device',
      description: 'Initiate KDE Connect discovery broadcast',
      category: 'Actions',
      iconName: 'phone',
      action: () => {
        setActiveTab('phone');
        showNotification('Navigated to Phone pairing');
      },
      keywords: ['kde', 'connect', 'phone', 'pair', 'device'],
    },
  ];

  const handleOpenQuickTerminal = () => {
    setActiveTab('developer');
    showNotification('Switched to Developer Tools for terminal presets');
  };

  const handleOpenCodeEditor = () => {
    navigator.clipboard.writeText('code /home/biggiesam/agy-demo');
    showNotification('Copied "code /home/biggiesam/agy-demo" to clipboard');
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 999,
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid var(--border-active)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 16px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            color: 'var(--text-primary)',
          }}
        >
          <CheckCircle2 size={16} color="var(--accent-cyan)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandPaletteItems}
      />

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        phoneConnected={phoneConnected}
      />

      {/* Main Companion Layout */}
      <div className="main-area">
        {/* Top Header */}
        <Header
          currentTab={activeTab}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          phoneConnected={phoneConnected}
        />

        {/* Content Body View Switcher */}
        <main className="content-body">
          {activeTab === 'home' && (
            <HomeDashboard
              onNavigate={(tab) => setActiveTab(tab)}
              phoneConnected={phoneConnected}
              onShowNotification={showNotification}
            />
          )}

          {activeTab === 'files' && (
            <TransferPanel
              phoneConnected={phoneConnected}
              onShowNotification={showNotification}
            />
          )}

          {activeTab === 'phone' && (
            <PhonePanel
              phoneConnected={phoneConnected}
              onSetPhoneConnected={setPhoneConnected}
              onShowNotification={showNotification}
            />
          )}

          {activeTab === 'jarvis' && (
            <JarvisPanel
              onShowNotification={showNotification}
              onExecuteTerminalPreset={(cmd) => {
                navigator.clipboard.writeText(cmd);
                showNotification(`Copied: ${cmd}`);
              }}
            />
          )}

          {activeTab === 'developer' && (
            <DeveloperPanel
              onShowNotification={showNotification}
              onOpenQuickTerminal={handleOpenQuickTerminal}
              onOpenCodeEditor={handleOpenCodeEditor}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel onShowNotification={showNotification} />
          )}
        </main>

        {/* Bottom macOS-Inspired Floating Dock */}
        <Dock
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onOpenQuickTerminal={handleOpenQuickTerminal}
          onOpenCodeEditor={handleOpenCodeEditor}
        />
      </div>
    </div>
  );
};
