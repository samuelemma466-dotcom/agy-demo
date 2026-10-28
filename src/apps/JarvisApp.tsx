import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Play,
  Check,
  Copy,
  ShieldAlert,
} from 'lucide-react';
import { systemApi, JarvisExecResult } from '../services/systemApi';

interface JarvisMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  suggestedCommand?: string;
  executionResult?: JarvisExecResult;
  isExecuted?: boolean;
}

const INITIAL_MESSAGES: JarvisMessageItem[] = [
  {
    id: 'msg-1',
    role: 'system',
    text: 'Jarvis Desktop Companion Engine initialized. Commands are strictly proposed as suggestions and never executed automatically without your confirmation.',
    timestamp: 'Just now',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    text: 'Hello! I can recommend system inspection commands, check disk storage, or inspect network interfaces. What would you like to check?',
    timestamp: 'Just now',
  },
];

const PROMPT_CHIPS = [
  'Check system process status',
  'Show storage filesystem usage',
  'List active network interfaces',
  'View user systemd units',
];

export const JarvisApp: React.FC = () => {
  const [messages, setMessages] = useState<JarvisMessageItem[]>(INITIAL_MESSAGES);
  const [inputVal, setInputVal] = useState('');
  const [confirmCommand, setConfirmCommand] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    setInputVal('');
    const userMsg: JarvisMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let reply = "I've synthesized a recommendation for your task.";
    let suggestedCommand: string | undefined = undefined;

    const q = text.toLowerCase();
    if (q.includes('process') || q.includes('htop') || q.includes('cpu')) {
      reply = 'To inspect active system processes:';
      suggestedCommand = 'ps aux --sort=-%cpu | head -n 6';
    } else if (q.includes('storage') || q.includes('disk') || q.includes('usage')) {
      reply = 'To view disk partition utilization:';
      suggestedCommand = 'df -h /';
    } else if (q.includes('network') || q.includes('ip') || q.includes('interface')) {
      reply = 'To list active network links and IP addresses:';
      suggestedCommand = 'ip -br addr';
    } else if (q.includes('systemd') || q.includes('service')) {
      reply = 'To view running user systemd services:';
      suggestedCommand = 'systemctl --user list-units --type=service --state=running';
    }

    const assistantMsg: JarvisMessageItem = {
      id: `asst-${Date.now()}`,
      role: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedCommand,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handleConfirmExecution = async () => {
    if (!confirmCommand) return;
    const cmd = confirmCommand;
    setConfirmCommand(null);
    setExecuting(true);

    try {
      const result = await systemApi.executeJarvisCommand(cmd);

      setMessages((prev) => [
        ...prev,
        {
          id: `exec-${Date.now()}`,
          role: 'system',
          text: `Executed: $ ${cmd}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          executionResult: result,
          isExecuted: true,
        },
      ]);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Execution error';
      setMessages((prev) => [
        ...prev,
        {
          id: `exec-${Date.now()}`,
          role: 'system',
          text: `Execution failed for: $ ${cmd}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          executionResult: { success: false, error: errorMsg },
          isExecuted: true,
        },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 10% 10%, #151c2c 0%, #0a0d14 100%)',
        color: 'var(--text-primary)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Confirmation Modal */}
      {confirmCommand && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(5, 8, 15, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="animate-scale-in"
            style={{
              background: '#151c2c',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              maxWidth: '420px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={20} color="#fbbf24" />
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Confirm Command Execution</h3>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Jarvis will execute this command inside your local user shell. Commands with root/sudo
              elevation are disallowed.
            </p>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <code className="font-mono" style={{ color: 'var(--accent-cyan)', fontSize: '12px' }}>
                $ {confirmCommand}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmCommand(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmExecution}>
                <Play size={13} />
                <span>Run Command</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={20} color="var(--accent-cyan)" />
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 700 }}>Omachy Jarvis</h1>
            <p style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              Intelligent Shell Assistant
            </p>
          </div>
        </div>

        <span className="badge badge-primary" style={{ fontSize: '10px' }}>
          Safe Mode Active
        </span>
      </div>

      {/* Messages Scroll View */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingRight: '4px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderRadius:
                  msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background:
                  msg.role === 'user'
                    ? 'var(--accent-cyan)'
                    : msg.role === 'system'
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(255, 255, 255, 0.07)',
                color: msg.role === 'user' ? '#090d16' : 'var(--text-primary)',
                fontWeight: msg.role === 'user' ? 600 : 400,
                fontSize: '13px',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              {msg.text}

              {/* Proposed Command Box */}
              {msg.suggestedCommand && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    background: '#090d16',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      Suggestion
                    </span>
                    <code className="font-mono" style={{ color: 'var(--accent-cyan)', fontSize: '11.5px' }}>
                      $ {msg.suggestedCommand}
                    </code>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '3px 7px', fontSize: '11px' }}
                      onClick={() => handleCopy(msg.suggestedCommand!, msg.id)}
                      title="Copy command"
                    >
                      {copiedId === msg.id ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => setConfirmCommand(msg.suggestedCommand!)}
                      title="Request execution"
                    >
                      <Play size={11} />
                      <span>Run</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Real Command Output Result Box */}
              {msg.executionResult && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    background: '#05080f',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${
                      msg.executionResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'
                    }`,
                    fontSize: '11.5px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: msg.executionResult.success ? '#34d399' : '#f87171',
                      }}
                    >
                      {msg.executionResult.success ? 'Command Completed' : 'Command Error'}
                    </span>
                    <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                      Exit Code: {msg.executionResult.returncode ?? -1}
                    </span>
                  </div>

                  {msg.executionResult.stdout && (
                    <pre
                      className="font-mono"
                      style={{
                        whiteSpace: 'pre-wrap',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                      }}
                    >
                      {msg.executionResult.stdout}
                    </pre>
                  )}

                  {msg.executionResult.stderr && (
                    <pre
                      className="font-mono"
                      style={{ whiteSpace: 'pre-wrap', color: '#fca5a5', fontSize: '11px' }}
                    >
                      {msg.executionResult.stderr}
                    </pre>
                  )}

                  {msg.executionResult.error && (
                    <div style={{ color: '#fca5a5' }}>{msg.executionResult.error}</div>
                  )}
                </div>
              )}
            </div>

            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {msg.timestamp}
            </span>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {PROMPT_CHIPS.map((chip, i) => (
          <button
            key={i}
            className="btn-ghost"
            style={{
              fontSize: '10.5px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={() => handleSend(chip)}
          >
            <Sparkles size={10} color="var(--accent-cyan)" style={{ marginRight: 3 }} />
            {chip}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Ask Jarvis for Linux commands or diagnostics..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: '9px 12px',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        />
        <button className="btn btn-primary" onClick={() => handleSend()} disabled={!inputVal.trim() || executing}>
          <Send size={14} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
