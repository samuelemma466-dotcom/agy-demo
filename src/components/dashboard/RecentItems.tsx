import React from 'react';
import { History, FolderGit2, FileArchive, Terminal, Smartphone } from 'lucide-react';
import { MOCK_RECENT_ITEMS, RecentItem } from '../../mock/mockData';
import { NavigationTab } from '../../types/navigation';

interface RecentItemsProps {
  onNavigate: (tab: NavigationTab) => void;
  onSelectItem: (item: RecentItem) => void;
}

export const RecentItems: React.FC<RecentItemsProps> = ({
  onNavigate,
  onSelectItem,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'FolderGit2':
        return <FolderGit2 size={16} color="var(--accent-cyan)" />;
      case 'FileArchive':
        return <FileArchive size={16} color="var(--accent-amber)" />;
      case 'Terminal':
        return <Terminal size={16} color="var(--accent-purple)" />;
      case 'Smartphone':
        return <Smartphone size={16} color="var(--accent-emerald)" />;
      default:
        return <History size={16} />;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <History size={18} color="var(--text-secondary)" />
          <span>Recent Activity</span>
        </div>
        <button
          className="btn-ghost"
          style={{ fontSize: '12px' }}
          onClick={() => onNavigate('developer')}
        >
          View all
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {MOCK_RECENT_ITEMS.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectItem(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getIcon(item.iconName)}
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {item.detail}
                </div>
              </div>
            </div>

            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {item.timestamp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
