import React from 'react';
import { ClockWidget } from './ClockWidget';
import { SystemStatusCard } from './SystemStatusCard';
import { QuickActions } from './QuickActions';
import { RecentItems } from './RecentItems';
import { Smartphone, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { NavigationTab } from '../../types/navigation';
import { RecentItem } from '../../mock/mockData';

interface HomeDashboardProps {
  onNavigate: (tab: NavigationTab) => void;
  phoneConnected: boolean;
  onShowNotification: (msg: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  phoneConnected,
  onShowNotification,
}) => {
  return (
    <div className="dashboard-grid animate-fade-in">
      {/* Top Welcome / Clock Banner */}
      <div className="col-12">
        <ClockWidget />
      </div>

      {/* System Telemetry Monitor */}
      <div className="col-12">
        <SystemStatusCard />
      </div>

      {/* Quick Actions (Left 7 cols) */}
      <div className="col-7">
        <QuickActions
          onNavigate={onNavigate}
          onShowNotification={onShowNotification}
        />
      </div>

      {/* Phone Quick Status Card (Right 5 cols) */}
      <div className="col-5">
        <div className="card" style={{ height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <div className="card-title">
                <Smartphone size={18} color="var(--accent-cyan)" />
                <span>Phone Companion</span>
              </div>
              <span className={`badge ${phoneConnected ? 'badge-online' : 'badge-demo'}`}>
                {phoneConnected ? 'Connected' : 'Ready to Pair'}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {phoneConnected
                ? 'Your device is linked via KDE Connect protocol. Clipboard sync and file beam are enabled.'
                : 'Connect your mobile device using the KDE Connect protocol for notifications, SMS, and rapid file beam.'}
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Discovery Protocol:</span>
                <span className="font-mono">KDE Connect D-Bus</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Local Port:</span>
                <span className="font-mono">1716 UDP/TCP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span style={{ color: phoneConnected ? '#34d399' : '#fbbf24' }}>
                  {phoneConnected ? 'Paired (Simulated)' : 'Standby / Discovery'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '18px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => onNavigate('phone')}
            >
              <span>{phoneConnected ? 'Manage Phone' : 'Open Pairing Hub'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Items Activity Feed */}
      <div className="col-12">
        <RecentItems
          onNavigate={onNavigate}
          onSelectItem={(item: RecentItem) => {
            if (item.category === 'command') onNavigate('developer');
            else if (item.category === 'file') onNavigate('files');
            else if (item.category === 'project') onNavigate('developer');
          }}
        />
      </div>

      {/* Safety & Architecture Footer Info */}
      <div className="col-12">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>
              <strong>Safe Companion Mode:</strong> Running with zero root elevation. No system services or daemons auto-started.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={14} />
            <span>Press <kbd className="kbd-shortcut">Ctrl+K</kbd> anywhere to search</span>
          </div>
        </div>
      </div>
    </div>
  );
};
