import React from 'react';
import {
  LayoutDashboard,
  Files,
  Smartphone,
  Bot,
  Terminal,
  Settings,
  ShieldCheck,
  LucideIcon,
} from 'lucide-react';
import { NavigationTab } from '../../types/navigation';

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  phoneConnected: boolean;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'files', label: 'My Files', icon: Files, badge: '2' },
  { id: 'phone', label: 'Phone', icon: Smartphone, badge: 'KDE' },
  { id: 'jarvis', label: 'Jarvis', icon: Bot, badge: 'AI' },
  { id: 'developer', label: 'Developer Tools', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  phoneConnected,
}) => {
  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="app-brand-logo">
          <img
            src="/omachy-icon.svg"
            alt="Omachy Icon"
            width={34}
            height={34}
            style={{ borderRadius: '10px' }}
          />
        </div>
        <div className="brand-text">
          <h2>
            Omachy <span>Desktop</span>
          </h2>
          <p>Linux Companion</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <div className="sidebar-item-left">
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className="badge"
                  style={{
                    background:
                      item.id === 'phone' && phoneConnected
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(255, 255, 255, 0.08)',
                    color:
                      item.id === 'phone' && phoneConnected
                        ? '#34d399'
                        : 'var(--text-secondary)',
                    fontSize: '10px',
                    padding: '2px 6px',
                  }}
                >
                  {item.id === 'phone' && phoneConnected ? 'Online' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer with System Guard Status */}
      <div className="sidebar-footer">
        <div className="system-status-indicator">
          <div className="status-dot online" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Omarchy Environment
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Wayland Session • Safe Sandbox
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            padding: '2px 8px',
          }}
        >
          <ShieldCheck size={13} color="#10b981" />
          <span>No root elevation required</span>
        </div>
      </div>
    </aside>
  );
};
