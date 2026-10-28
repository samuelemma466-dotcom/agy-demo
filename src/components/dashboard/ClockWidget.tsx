import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export const ClockWidget: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [greeting, setGreeting] = useState<string>('Welcome');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
      setDateStr(
        now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      );

      const hour = now.getHours();
      if (hour < 12) setGreeting('Good morning');
      else if (hour < 18) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span
            style={{
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent-cyan)',
              fontWeight: 600,
            }}
          >
            {greeting}, Omarchy User
          </span>
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: '4px',
              marginBottom: '8px',
              letterSpacing: '-0.03em',
              fontFeatureSettings: '"tnum"',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeStr}
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
            }}
          >
            <Calendar size={14} />
            <span>{dateStr}</span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span className="badge badge-primary">Omachy Desktop v0.1</span>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '8px',
              maxWidth: '170px',
            }}
          >
            Your Linux companion hub with zero Apple proprietary code
          </p>
        </div>
      </div>
    </div>
  );
};
