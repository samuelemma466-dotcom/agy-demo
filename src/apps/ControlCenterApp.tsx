import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Bluetooth,
  Volume2,
  VolumeX,
  Battery,
  BatteryCharging,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Bell,
  BellOff,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { systemApi, SystemStatusResponse } from '../services/systemApi';

export const ControlCenterApp: React.FC = () => {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [wifiExpanded, setWifiExpanded] = useState(false);
  const [btExpanded, setBtExpanded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [volume, setVolume] = useState<number>(100);
  const [muted, setMuted] = useState<boolean>(false);
  const [dndActive, setDndActive] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const data = await systemApi.getStatus();
      setStatus(data);
      if (data.audio.volume !== undefined) setVolume(data.audio.volume);
      if (data.audio.muted !== undefined) setMuted(data.audio.muted);
    } catch (e) {
      console.error('Failed to query system status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleVolumeChange = async (newVol: number) => {
    setVolume(newVol);
    await systemApi.setVolume(newVol);
  };

  const handleToggleMute = async () => {
    setMuted(!muted);
    await systemApi.toggleMute();
    fetchStatus();
  };

  const handleToggleBluetooth = async () => {
    if (!status?.bluetooth.available) return;
    const next = !status.bluetooth.powered;
    await systemApi.setBluetooth(next);
    fetchStatus();
  };

  const handleToggleWifi = async () => {
    if (!status?.wifi.available) return;
    const next = !status.wifi.enabled;
    await systemApi.setWifiRadio(next);
    fetchStatus();
  };

  const handleScanWifi = async () => {
    setIsScanning(true);
    try {
      const wifiData = await systemApi.scanWifi();
      if (status) {
        setStatus({ ...status, wifi: wifiData });
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleLaunchApp = (app: string) => {
    systemApi.launchApp(app);
  };

  if (loading && !status) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontSize: '13px',
        }}
      >
        <RefreshCw size={18} className="animate-pulse-glow" style={{ marginRight: 8 }} />
        <span>Reading Linux system status...</span>
      </div>
    );
  }

  const wifi = status?.wifi;
  const bluetooth = status?.bluetooth;
  const audio = status?.audio;
  const battery = status?.battery;

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
        overflowY: 'auto',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/omachy-icon.svg" width={20} height={20} alt="Omachy" />
          <h2 style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Control Center
          </h2>
        </div>

        {/* Battery chip */}
        {battery?.available ? (
          <div
            className="badge badge-online"
            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {battery.status === 'Charging' ? (
              <BatteryCharging size={13} />
            ) : (
              <Battery size={13} />
            )}
            <span>{battery.capacity}%</span>
          </div>
        ) : (
          <span className="badge badge-demo" style={{ fontSize: '10px' }}>
            AC Power
          </span>
        )}
      </div>

      {/* 2x2 Primary Toggles Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Wi-Fi Card */}
        <div
          style={{
            background: wifi?.enabled ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${wifi?.enabled ? 'var(--border-active)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '84px',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => setWifiExpanded(!wifiExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: wifi?.enabled ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: wifi?.enabled ? '#090d16' : 'var(--text-muted)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleWifi();
              }}
              title="Click to toggle Wi-Fi radio"
            >
              {wifi?.enabled ? <Wifi size={17} /> : <WifiOff size={17} />}
            </div>
            {wifiExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>Wi-Fi</div>
            <div
              style={{
                fontSize: '11px',
                color: wifi?.active ? 'var(--accent-cyan)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {wifi?.active ? wifi.active.ssid : wifi?.enabled ? 'Scanning...' : 'Disabled'}
            </div>
          </div>
        </div>

        {/* Bluetooth Card */}
        <div
          style={{
            background: bluetooth?.powered
              ? 'rgba(99, 102, 241, 0.12)'
              : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${
              bluetooth?.powered ? 'rgba(99, 102, 241, 0.35)' : 'var(--border-subtle)'
            }`,
            borderRadius: 'var(--radius-lg)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '84px',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => setBtExpanded(!btExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: bluetooth?.powered ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: bluetooth?.powered ? '#ffffff' : 'var(--text-muted)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleBluetooth();
              }}
              title="Click to toggle Bluetooth power"
            >
              <Bluetooth size={17} />
            </div>
            {btExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>Bluetooth</div>
            <div
              style={{
                fontSize: '11px',
                color: bluetooth?.powered ? '#818cf8' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {bluetooth?.powered
                ? `${bluetooth.paired_devices?.length || 0} Paired Devices`
                : 'Turned Off'}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Wi-Fi Network Drawer */}
      {wifiExpanded && (
        <div
          className="animate-scale-in"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
              AVAILABLE WI-FI NETWORKS
            </span>
            <button
              className="btn-ghost"
              style={{ padding: '2px 6px', fontSize: '11px' }}
              onClick={handleScanWifi}
              disabled={isScanning}
            >
              <RefreshCw
                size={11}
                className={isScanning ? 'animate-pulse-glow' : ''}
                style={{ marginRight: 4 }}
              />
              Rescan
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {wifi?.networks && wifi.networks.length > 0 ? (
              wifi.networks.map((net, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: net.active
                      ? 'rgba(56, 189, 248, 0.15)'
                      : 'rgba(255, 255, 255, 0.02)',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ fontWeight: net.active ? 600 : 400 }}>{net.ssid}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {net.signal}%
                    </span>
                    {net.active && (
                      <span className="badge badge-online" style={{ fontSize: '9px', padding: '1px 5px' }}>
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No networks discovered</span>
            )}
          </div>
        </div>
      )}

      {/* Expanded Bluetooth Paired Drawer */}
      {btExpanded && (
        <div
          className="animate-scale-in"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            PAIRED BLUETOOTH DEVICES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {bluetooth?.paired_devices && bluetooth.paired_devices.length > 0 ? (
              bluetooth.paired_devices.map((dev, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    fontSize: '12px',
                  }}
                >
                  <span>{dev.name}</span>
                  <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {dev.mac}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No paired devices</span>
            )}
          </div>
        </div>
      )}

      {/* Audio Output Slider (Real PipeWire / WirePlumber) */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '12.5px' }}>Sound Output</span>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              ({audio?.backend || 'PipeWire'})
            </span>
          </div>
          <button
            className="btn-ghost"
            style={{ padding: '2px 6px' }}
            onClick={handleToggleMute}
            title="Toggle Mute"
          >
            {muted ? <VolumeX size={15} color="#f43f5e" /> : <Volume2 size={15} />}
          </button>
        </div>

        {/* Volume range slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="range"
            min="0"
            max="100"
            value={muted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: '11px',
              minWidth: '32px',
              textAlign: 'right',
              color: muted ? '#f43f5e' : 'var(--text-secondary)',
            }}
          >
            {muted ? 'MUTE' : `${volume}%`}
          </span>
        </div>
      </div>

      {/* Quick Action Shortcuts Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setDndActive(!dndActive)}
          style={{
            flexDirection: 'column',
            padding: '10px 6px',
            gap: '6px',
            background: dndActive ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            borderColor: dndActive ? 'rgba(244, 63, 94, 0.35)' : 'var(--border-subtle)',
          }}
        >
          {dndActive ? <BellOff size={16} color="#f43f5e" /> : <Bell size={16} />}
          <span style={{ fontSize: '10.5px' }}>{dndActive ? 'DND On' : 'Do Not Disturb'}</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => handleLaunchApp('jarvis')}
          style={{ flexDirection: 'column', padding: '10px 6px', gap: '6px' }}
          title="Open Jarvis AI Assistant Window"
        >
          <Terminal size={16} color="var(--accent-cyan)" />
          <span style={{ fontSize: '10.5px' }}>Jarvis AI</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => handleLaunchApp('drop')}
          style={{ flexDirection: 'column', padding: '10px 6px', gap: '6px' }}
          title="Open Omachy Drop File Beam Window"
        >
          <ExternalLink size={16} color="var(--accent-emerald)" />
          <span style={{ fontSize: '10.5px' }}>Omachy Drop</span>
        </button>
      </div>

      {/* Footer Info */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10.5px',
          color: 'var(--text-muted)',
        }}
      >
        <span>Omarchy Linux • Wayland Session</span>
        <button
          className="btn-ghost"
          style={{ fontSize: '10.5px', color: 'var(--accent-cyan)' }}
          onClick={() => handleLaunchApp('suite')}
        >
          Open Full Suite ↗
        </button>
      </div>
    </div>
  );
};
