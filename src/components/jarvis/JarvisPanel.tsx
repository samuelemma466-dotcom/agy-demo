import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Copy,
  Check,
  Info,
  Terminal,
} from 'lucide-react';
import { jarvisService } from '../../modules/jarvis/jarvisService';
import { JarvisMessage } from '../../types/jarvis';

interface JarvisPanelProps {
  onShowNotification: (msg: string) => void;
  onExecuteTerminalPreset: (cmd: string) => void;
}

const PROMPT_CHIPS = [
  'Check system resource health',
  'Show git branch status',
  'How to check disk usage?',
  'Scan for mobile devices',
  'Clean Linux temp cache',
];

export const JarvisPanel: React.FC<JarvisPanelProps> = ({
  onShowNotification,
  onExecuteTerminalPreset,
}) => {
  const [messages, setMessages] = useState<JarvisMessage[]>(jarvisService.getHistory());
  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isProcessing) return;

    setInputVal('');
    const userMsg: JarvisMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSimulatedEngine: false,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await jarvisService.processQuery(text);
      setMessages((prev) => [...prev, response]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    onShowNotification(`Copied command to clipboard: ${cmd}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Honest Demo State Banner */}
      <div className="disclaimer-banner">
        <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p>
            <strong>Jarvis AI Module Notice:</strong> This assistant demonstrates desktop assistant integration
            and command synthesis. Real local LLM generation (Ollama / Local Sidecar) is separated in{' '}
            <code>src/modules/jarvis/jarvisService.ts</code>. No cloud API keys or passwords are stored in this app.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Main Conversation Container (8 cols) */}
        <div className="col-8">
          <div
            className="card"
            style={{
              height: '560px',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bot size={20} color="var(--accent-active)" />
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Jarvis Desktop Intelligence</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Linux Companion AI • Local Prompt Engine
                  </p>
                </div>
              </div>

              <span className="badge badge-primary">Model: Demo Orchestrator</span>
            </div>

            {/* Messages Scroll Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius:
                        msg.role === 'user'
                          ? '16px 16px 2px 16px'
                          : '16px 16px 16px 2px',
                      background:
                        msg.role === 'user'
                          ? 'var(--accent-active)'
                          : msg.role === 'system'
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(255, 255, 255, 0.08)',
                      color:
                        msg.role === 'user'
                          ? 'var(--text-inverse)'
                          : 'var(--text-primary)',
                      fontWeight: msg.role === 'user' ? 600 : 400,
                      fontSize: '13.5px',
                      lineHeight: 1.5,
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {msg.text}

                    {/* Suggested Command Box */}
                    {msg.suggestedCommand && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(10, 13, 20, 0.85)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-medium)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <code
                          className="font-mono"
                          style={{
                            color: '#38bdf8',
                            fontSize: '12.5px',
                            wordBreak: 'break-all',
                          }}
                        >
                          $ {msg.suggestedCommand}
                        </code>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => onExecuteTerminalPreset(msg.suggestedCommand!)}
                            title="Run in terminal presets"
                          >
                            <Terminal size={12} />
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => handleCopyCommand(msg.suggestedCommand!, msg.id)}
                            title="Copy command to clipboard"
                          >
                            {copiedId === msg.id ? (
                              <Check size={12} color="#10b981" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Chips bar */}
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              {PROMPT_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  className="btn-ghost"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  onClick={() => handleSend(chip)}
                >
                  <Sparkles size={11} color="var(--accent-cyan)" style={{ marginRight: '4px' }} />
                  {chip}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '10px',
                background: 'var(--bg-secondary)',
              }}
            >
              <input
                type="text"
                placeholder="Ask Jarvis or request a system task..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  outline: 'none',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleSend()}
                disabled={isProcessing || !inputVal.trim()}
              >
                <Send size={15} />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>

        {/* Assistant Capabilities & Configuration Guide (4 cols) */}
        <div className="col-4">
          <div className="card" style={{ height: '560px', overflowY: 'auto' }}>
            <div className="card-header">
              <div className="card-title">
                <Sparkles size={18} color="var(--accent-cyan)" />
                <span>Companion Capabilities</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  System Command Synthesis
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Jarvis translates conversational requests into safe Linux terminal commands with one-click copy.
                </p>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Ollama / Local LLM Ready
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Designed to bind directly to a local Ollama server running <code>qwen2.5-coder</code> or{' '}
                  <code>llama3</code> on your Linux machine with zero cloud telemetry.
                </p>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Safety & Privacy First
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Commands that require root/sudo are never auto-executed. You always inspect and run them in your own shell.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
