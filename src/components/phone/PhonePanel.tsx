import React, { useState } from 'react';
import {
  Smartphone,
  RefreshCw,
  QrCode,
  Shield,
  Layers,
  Info,
  BatteryCharging,
  Copy,
  Sliders,
  MessageSquare,
} from 'lucide-react';
import { kdeConnectClient } from '../../modules/kdeconnect/kdeConnectClient';
import { PhoneDevice } from '../../types/phone';

interface PhonePanelProps {
  phoneConnected: boolean;
  onSetPhoneConnected: (connected: boolean) => void;
  onShowNotification: (msg: string) => void;
}

export const PhonePanel: React.FC<PhonePanelProps> = ({
  phoneConnected,
  onSetPhoneConnected,
  onShowNotification,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<PhoneDevice[]>([]);
  const pinCode = '849 201';
  const [isPairing, setIsPairing] = useState(false);

  // Features state
  const [clipboardSync, setClipboardSync] = useState(true);
  const [notificationMirror, setNotificationMirror] = useState(true);
  const [mediaControl, setMediaControl] = useState(true);
  const [smsTelephony, setSmsTelephony] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    onShowNotification('Scanning local subnet (255.255.255.255:1716 UDP broadcast)...');
    try {
      const devices = await kdeConnectClient.scanForDevices();
      setDiscoveredDevices(devices);
      onShowNotification('Discovered 1 device ready for pairing');
    } finally {
      setIsScanning(false);
    }
  };

  const handlePair = async (device: PhoneDevice) => {
    setIsPairing(true);
    setTimeout(() => {
      kdeConnectClient.pairDevice(device, '849201');
      onSetPhoneConnected(true);
      setIsPairing(false);
      onShowNotification(`Successfully paired with ${device.name} (Simulation)`);
    }, 1000);
  };

  const handleDisconnect = () => {
    kdeConnectClient.disconnectDevice();
    onSetPhoneConnected(false);
    onShowNotification('Phone disconnected');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Honest Demo State Banner */}
      <div className="disclaimer-banner">
        <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p>
            <strong>Honest Connectivity Notice:</strong> This panel provides a live demonstrator of the
            KDE Connect pairing protocol. Real socket synchronization requires the KDE Connect daemon
            (<code>kdeconnectd</code>) and D-Bus integration at <code>src/modules/kdeconnect/kdeConnectClient.ts</code>.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Connection Status & Pairing Card (7 cols) */}
        <div className="col-7">
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <div className="card-title">
                <Smartphone size={18} color="var(--accent-cyan)" />
                <span>Device Connection Hub</span>
              </div>
              <span className={`badge ${phoneConnected ? 'badge-online' : 'badge-demo'}`}>
                {phoneConnected ? 'Device Paired (Demo)' : 'Ready to Pair'}
              </span>
            </div>

            {phoneConnected ? (
              /* Connected Device View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid var(--border-active)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(56, 189, 248, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Smartphone size={24} color="var(--accent-cyan)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px' }}>Pixel 8 — Android 15</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        IP: 192.168.1.142 • KDE Protocol v7.2
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      className="badge badge-online"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <BatteryCharging size={12} />
                      <span>84% Charging</span>
                    </div>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Active Integration Capabilities
                  </h4>

                  {/* Clipboard */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Copy size={16} color="var(--accent-cyan)" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>Clipboard Sync</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Share copied text between phone & desktop
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={clipboardSync}
                      onChange={(e) => setClipboardSync(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>

                  {/* Notification Mirroring */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Layers size={16} color="var(--accent-purple)" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>Notification Forwarding</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Display mobile app notifications on Linux desktop
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationMirror}
                      onChange={(e) => setNotificationMirror(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>

                  {/* Media Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Sliders size={16} color="var(--accent-emerald)" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>Media Remote</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Control phone music and volume from desktop
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={mediaControl}
                      onChange={(e) => setMediaControl(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>

                  {/* SMS / Telephony */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <MessageSquare size={16} color="var(--accent-amber)" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>SMS & Telephony Relay</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Compose SMS messages directly from desktop
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={smsTelephony}
                      onChange={(e) => setSmsTelephony(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <button className="btn btn-secondary" onClick={handleDisconnect}>
                    Disconnect Phone
                  </button>
                </div>
              </div>
            ) : (
              /* Disconnected / Pairing View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Omachy Desktop uses the open KDE Connect protocol to communicate with Android and iOS devices.
                  Both devices must be on the same local Wi-Fi network.
                </p>

                {/* Scan Button & Action */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleScan}
                    disabled={isScanning}
                  >
                    <RefreshCw size={14} className={isScanning ? 'animate-pulse-glow' : ''} />
                    <span>{isScanning ? 'Broadcasting UDP discovery...' : 'Scan for Mobile Devices'}</span>
                  </button>
                </div>

                {/* Discovered devices list */}
                {discoveredDevices.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Discovered Nearby Devices
                    </h4>

                    {discoveredDevices.map((dev) => (
                      <div
                        key={dev.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-medium)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Smartphone size={20} color="var(--accent-cyan)" />
                          <div>
                            <div style={{ fontWeight: 600 }}>{dev.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {dev.model} • {dev.ipAddress}
                            </div>
                          </div>
                        </div>

                        <button
                          className="btn btn-primary"
                          onClick={() => handlePair(dev)}
                          disabled={isPairing}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          {isPairing ? 'Pairing...' : 'Pair Device'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pairing Verification Code & QR (5 cols) */}
        <div className="col-5">
          <div className="card" style={{ height: '100%', alignItems: 'center', textAlign: 'center' }}>
            <div className="card-header" style={{ width: '100%' }}>
              <div className="card-title">
                <QrCode size={18} color="var(--accent-purple)" />
                <span>Pairing Security PIN</span>
              </div>
            </div>

            <div
              style={{
                width: '140px',
                height: '140px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                marginTop: '12px',
              }}
            >
              <QrCode size={100} color="var(--accent-cyan)" />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Confirmation PIN
              </span>
              <div
                className="font-mono"
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: 'var(--text-primary)',
                  marginTop: '4px',
                }}
              >
                {pinCode}
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '280px' }}>
              Verify this code matches the prompt on your KDE Connect mobile app before accepting.
            </p>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '16px',
                width: '100%',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Shield size={13} color="#10b981" />
              <span>TLS Certificate Encrypted Handshake</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
