import React from 'react';
import {
  Home,
  FolderSync,
  Terminal,
  Code2,
  Bot,
  Smartphone,
  Activity,
  Sliders,
} from 'lucide-react';
import { NavigationTab } from '../../types/navigation';

interface DockProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenQuickTerminal: () => void;
  onOpenCodeEditor: () => void;
}

export const Dock: React.FC<DockProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickTerminal,
  onOpenCodeEditor,
}) => {
  return (
    <div className="dock-container">
      <div className="dock" role="toolbar" aria-label="Application Dock">
        {/* Home */}
        <button
          className={`dock-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onSelectTab('home')}
          aria-label="Home Dashboard"
        >
          <Home size={20} />
          {activeTab === 'home' && <span className="dock-active-dot" />}
          <span className="dock-tooltip">Home Dashboard</span>
        </button>

        {/* My Files */}
        <button
          className={`dock-item ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => onSelectTab('files')}
          aria-label="Files and Transfers"
        >
          <FolderSync size={20} />
          {activeTab === 'files' && <span className="dock-active-dot" />}
          <span className="dock-tooltip">Files & Transfers</span>
        </button>

        {/* Jarvis Assistant */}
        <button
          className={`dock-item ${activeTab === 'jarvis' ? 'active' : ''}`}
          onClick={() => onSelectTab('jarvis')}
          aria-label="Jarvis AI Assistant"
        >
          <Bot size={20} />
          {activeTab === 'jarvis' && <span className="dock-active-dot" />}
          <span className="dock-tooltip">Jarvis AI</span>
        </button>

        {/* Phone Companion */}
        <button
          className={`dock-item ${activeTab === 'phone' ? 'active' : ''}`}
          onClick={() => onSelectTab('phone')}
          aria-label="Phone Companion"
        >
          <Smartphone size={20} />
          {activeTab === 'phone' && <span className="dock-active-dot" />}
          <span className="dock-tooltip">Phone Companion</span>
        </button>

        {/* Divider */}
        <div className="dock-divider" />

        {/* External / Developer Shortcuts */}
        <button
          className={`dock-item ${activeTab === 'developer' ? 'active' : ''}`}
          onClick={() => onSelectTab('developer')}
          aria-label="Developer Tools"
        >
          <Activity size={20} />
          {activeTab === 'developer' && <span className="dock-active-dot" />}
          <span className="dock-tooltip">Developer Hub</span>
        </button>

        <button
          className="dock-item"
          onClick={onOpenQuickTerminal}
          aria-label="Terminal Shortcut"
        >
          <Terminal size={20} />
          <span className="dock-tooltip">Terminal Command</span>
        </button>

        <button
          className="dock-item"
          onClick={onOpenCodeEditor}
          aria-label="Open Code Editor"
        >
          <Code2 size={20} />
          <span className="dock-tooltip">Code Workspace</span>
        </button>

        {/* Divider */}
        <div className="dock-divider" />

        {/* Settings */}
        <button
          className={`dock-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          aria-label="Companion Settings"
        >
          <Sliders size={20} />
          {activeTab === 'settings' && <span className="dock-active-dot" />}
          <span className="dock-tooltip">Settings</span>
        </button>
      </div>
    </div>
  );
};
