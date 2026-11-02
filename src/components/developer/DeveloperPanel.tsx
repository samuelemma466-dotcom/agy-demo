import React, { useState } from 'react';
import {
  Terminal,
  FolderGit2,
  GitBranch,
  Copy,
  Check,
  Code,
  Monitor,
} from 'lucide-react';
import { MOCK_PROJECTS, MOCK_TERMINAL_PRESETS } from '../../mock/mockData';
import { DevProject, TerminalCommandPreset } from '../../types/developer';

interface DeveloperPanelProps {
  onShowNotification: (msg: string) => void;
  onOpenQuickTerminal: () => void;
  onOpenCodeEditor: () => void;
}

export const DeveloperPanel: React.FC<DeveloperPanelProps> = ({
  onShowNotification,
  onOpenQuickTerminal,
  onOpenCodeEditor,
}) => {
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', 'Git', 'System', 'Containers'];

  const filteredPresets = activeCategory === 'All'
    ? MOCK_TERMINAL_PRESETS
    : MOCK_TERMINAL_PRESETS.filter((p) => p.category === activeCategory);

  const handleCopyCommand = (preset: TerminalCommandPreset) => {
    navigator.clipboard.writeText(preset.command);
    setCopiedCmdId(preset.id);
    onShowNotification(`Copied to clipboard: "${preset.command}"`);
    setTimeout(() => setCopiedCmdId(null), 2000);
  };

  const handleCopyPath = (project: DevProject) => {
    navigator.clipboard.writeText(project.path);
    setCopiedPathId(project.id);
    onShowNotification(`Copied path: ${project.path}`);
    setTimeout(() => setCopiedPathId(null), 2000);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Environment Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-secondary) 100%)',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'color-mix(in srgb, var(--accent-active) 15%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Monitor size={22} color="var(--accent-cyan)" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px' }}>Omarchy Linux Development Environment</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Arch-based Companion • Wayland Desktop Session • Node v26.8.2
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onOpenCodeEditor}>
              <Code size={14} />
              <span>VS Code / Cursor</span>
            </button>
            <button className="btn btn-primary" onClick={onOpenQuickTerminal}>
              <Terminal size={14} />
              <span>Quick Terminal</span>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Workspace Projects (7 cols) */}
        <div className="col-7">
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <div className="card-title">
                <FolderGit2 size={18} color="var(--accent-cyan)" />
                <span>Local Projects & Repositories</span>
              </div>
              <span className="badge badge-primary">{MOCK_PROJECTS.length} Registered</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {MOCK_PROJECTS.map((proj) => (
                <div
                  key={proj.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{proj.name}</span>
                      <span
                        className="badge"
                        style={{
                          background:
                            proj.status === 'clean'
                              ? 'color-mix(in srgb, var(--status-online) 15%, transparent)'
                              : 'color-mix(in srgb, var(--accent-amber) 15%, transparent)',
                          color: proj.status === 'clean' ? 'var(--status-online)' : 'var(--accent-amber)',
                          fontSize: '10px',
                        }}
                      >
                        {proj.status === 'clean' ? 'Git: Clean' : 'Git: Changes'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <GitBranch size={13} />
                      <span className="font-mono">{proj.branch}</span>
                    </div>
                  </div>

                  {/* Path with copy */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11.5px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {proj.path}
                    </span>
                    <button
                      className="btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => handleCopyPath(proj)}
                      title="Copy directory path"
                    >
                      {copiedPathId === proj.id ? <Check size={12} color="var(--status-online)" /> : <Copy size={12} />}
                    </button>
                  </div>

                  {/* Tech stack tags & actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {proj.techStack.map((tech) => (
                        <span
                          key={tech}
                          style={{
                            fontSize: '10.5px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => {
                        onShowNotification(`Opened ${proj.name} terminal session`);
                      }}
                    >
                      <Terminal size={12} />
                      <span>Launch Shell</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Terminal Shortcuts & Command Presets (5 cols) */}
        <div className="col-5">
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <div className="card-title">
                <Terminal size={18} color="var(--accent-purple)" />
                <span>Terminal Shortcuts</span>
              </div>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`btn-ghost ${activeCategory === cat ? 'active' : ''}`}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background:
                      activeCategory === cat ? 'color-mix(in srgb, var(--accent-active) 15%, transparent)' : 'rgba(255, 255, 255, 0.04)',
                    color: activeCategory === cat ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Presets List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px' }}>{preset.title}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {preset.category}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <code
                      className="font-mono"
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--accent-cyan)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      $ {preset.command}
                    </code>

                    <button
                      className="btn-ghost"
                      style={{ padding: '2px 6px' }}
                      onClick={() => handleCopyCommand(preset)}
                      title="Copy command to clipboard"
                    >
                      {copiedCmdId === preset.id ? (
                        <Check size={12} color="var(--status-online)" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
