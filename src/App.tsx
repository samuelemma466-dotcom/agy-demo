import React, { useState, useEffect } from 'react';
import { ControlCenterApp } from './apps/ControlCenterApp';
import { ConnectApp } from './apps/ConnectApp';
import { DropApp } from './apps/DropApp';
import { JarvisApp } from './apps/JarvisApp';
import { DeveloperApp } from './apps/DeveloperApp';
import { SuiteApp } from './apps/SuiteApp';

// Preserved reference components from initial prototype
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
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import './styles/index.css';
import './styles/components.css';

export const App: React.FC = () => {
  // Determine application mode from URL parameter (?app=control-center etc.)
  const queryParams = new URLSearchParams(window.location.search);
  const initialApp = queryParams.get('app') || 'suite';
  const [appMode, setAppMode] = useState<string>(initialApp);

  // Reference companion state
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

  // If specific standalone window is requested, render that standalone app directly:
  if (appMode === 'control-center') {
    return <ControlCenterApp />;
  }

  if (appMode === 'connect') {
    return <ConnectApp />;
  }

  if (appMode === 'drop') {
    return <DropApp />;
  }

  if (appMode === 'jarvis') {
    return <JarvisApp />;
  }

  if (appMode === 'developer') {
    return <DeveloperApp />;
  }

  if (appMode === 'suite') {
    return <SuiteApp onOpenReferenceCompanion={() => setAppMode('reference')} />;
  }

  // Reference Companion View (Preserved initial prototype)
  const commandPaletteItems: CommandPaletteItem[] = [
    {
      id: 'nav-home',
      title: 'Go to Home Dashboard',
      description: 'System overview, live clock, and quick actions',
      category: 'Navigation',
      iconName: 'home',
      action: () => setActiveTab('home'),
    },
    {
      id: 'nav-files',
      title: 'Go to My Files & Transfers',
      description: 'Beam files wirelessly and manage transfer queue',
      category: 'Navigation',
      iconName: 'files',
      action: () => setActiveTab('files'),
    },
    {
      id: 'nav-phone',
      title: 'Go to Phone Companion',
      description: 'KDE Connect mobile pairing and notification sync',
      category: 'Navigation',
      iconName: 'phone',
      action: () => setActiveTab('phone'),
    },
    {
      id: 'nav-jarvis',
      title: 'Go to Jarvis AI Assistant',
      description: 'Interactive companion for system tasks & prompts',
      category: 'Navigation',
      iconName: 'jarvis',
      action: () => setActiveTab('jarvis'),
    },
    {
      id: 'nav-developer',
      title: 'Go to Developer Tools',
      description: 'Workspace repositories and terminal presets',
      category: 'Navigation',
      iconName: 'developer',
      action: () => setActiveTab('developer'),
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      description: 'Accent colors, glass opacity, and companion preferences',
      category: 'Navigation',
      iconName: 'settings',
      action: () => setActiveTab('settings'),
    },
  ];

  return (
    <div className="app-container">
      {/* Return to Suite Banner */}
      <div
        style={{
          position: 'fixed',
          top: '12px',
          left: '260px',
          zIndex: 50,
        }}
      >
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '11px', backdropFilter: 'blur(10px)' }}
          onClick={() => setAppMode('suite')}
        >
          <ArrowLeft size={12} />
          <span>Back to App Suite Launcher</span>
        </button>
      </div>

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

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandPaletteItems}
      />

      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        phoneConnected={phoneConnected}
      />

      <div className="main-area">
        <Header
          currentTab={activeTab}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          phoneConnected={phoneConnected}
        />

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
              onOpenQuickTerminal={() => setActiveTab('developer')}
              onOpenCodeEditor={() => {
                navigator.clipboard.writeText('code /home/biggiesam/agy-demo');
                showNotification('Copied code command to clipboard');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel onShowNotification={showNotification} />
          )}
        </main>

        <Dock
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onOpenQuickTerminal={() => setActiveTab('developer')}
          onOpenCodeEditor={() => {
            navigator.clipboard.writeText('code /home/biggiesam/agy-demo');
            showNotification('Copied code command to clipboard');
          }}
        />
      </div>
    </div>
  );
};
