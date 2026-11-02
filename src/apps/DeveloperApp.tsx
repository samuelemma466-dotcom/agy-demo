import React, { useState } from 'react';
import {
  Terminal,
  GitBranch,
  Copy,
  Check,
  Play,
  Monitor,
} from 'lucide-react';
import { MOCK_PROJECTS, MOCK_TERMINAL_PRESETS } from '../mock/mockData';
import { systemApi } from '../services/systemApi';

export const DeveloperApp: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [executionOutput, setExecutionOutput] = useState<{ cmd: string; output: string } | null>(null);
  const [running, setRunning] = useState(false);

  const categories = ['All', 'Git', 'System', 'Containers'];

  const filteredPresets =
    activeCategory === 'All'
      ? MOCK_TERMINAL_PRESETS
      : MOCK_TERMINAL_PRESETS.filter((p) => p.category === activeCategory);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunPreset = async (actionId: string, label: string) => {
    setRunning(true);
    setExecutionOutput({ cmd: label, output: 'Running permitted read-only action...' });
    try {
      const res = await systemApi.runAllowedAction(actionId);
      setExecutionOutput({
        cmd: label,
        output: res.stdout || res.stderr || (res.success ? 'Success (no output)' : 'Failed to execute'),
      });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Error running permitted action';
      setExecutionOutput({ cmd: label, output: errorMsg });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
        color: 'var(--text-primary)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={22} color="var(--accent-purple)" />
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700 }}>Omachy Developer Tools</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Projects Manager & Terminal Presets
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Monitor size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Omarchy Linux • Wayland
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        {/* Left: Registered Projects */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: '13.5px' }}>Workspace Projects</span>
            <span className="badge badge-primary">{MOCK_PROJECTS.length} Active</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {MOCK_PROJECTS.map((proj) => (
              <div
                key={proj.id}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '13.5px' }}>{proj.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    <GitBranch size={12} />
                    <span className="font-mono">{proj.branch}</span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                  }}
                >
                  <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                    {proj.path}
                  </span>
                  <button
                    className="btn-ghost"
                    style={{ padding: '2px 5px', fontSize: '10.5px' }}
                    onClick={() => handleCopy(proj.path, proj.id)}
                    title="Copy path"
                  >
                    {copiedId === proj.id ? <Check size={11} color="var(--status-online)" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Terminal Command Presets */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: '13.5px' }}>Read-only System Checks</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className="btn-ghost"
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    background: activeCategory === cat ? 'color-mix(in srgb, var(--accent-active) 15%, transparent)' : 'transparent',
                    color: activeCategory === cat ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPresets.map((preset) => (
              <div
                key={preset.id}
                style={{
                  padding: '9px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 500 }}>{preset.title}</div>
                  <code className="font-mono" style={{ fontSize: '10.5px', color: 'var(--accent-cyan)' }}>
                    $ {preset.command}
                  </code>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 6px', fontSize: '11px' }}
                    onClick={() => handleCopy(preset.command, preset.id)}
                    title="Copy command"
                  >
                    {copiedId === preset.id ? <Check size={11} color="var(--status-online)" /> : <Copy size={11} />}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => handleRunPreset(preset.actionId, preset.title)}
                    disabled={running}
                    title="Run permitted check"
                  >
                    <Play size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Execution Output Box */}
          {executionOutput && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Output of: <code style={{ color: 'var(--accent-cyan)' }}>{executionOutput.cmd}</code>
              </div>
              <pre
                className="font-mono"
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {executionOutput.output}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
