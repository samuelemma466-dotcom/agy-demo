import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone, ShieldCheck, RefreshCw, Square, Wifi, Check, X, ExternalLink } from 'lucide-react';
import { PhoneSessionState, systemApi } from '../services/systemApi';

type InterfaceAddress = { interface: string; address: string; wireless?: boolean };

export const ConnectApp: React.FC = () => {
  const [interfaces, setInterfaces] = useState<InterfaceAddress[]>([]);
  const [address, setAddress] = useState('');
  const [session, setSession] = useState<PhoneSessionState>({ active: false, pending: [], devices: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await systemApi.getPhoneSession();
      setSession(next);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the connection service state.');
    }
  }, []);

  useEffect(() => {
    systemApi.getPhoneInterfaces().then(({ interfaces: found }) => {
      const ordered = [...found].sort((a, b) => Number(Boolean(b.wireless)) - Number(Boolean(a.wireless)));
      setInterfaces(ordered);
      setAddress((current) => current || ordered.find((item) => item.wireless)?.address || ordered[0]?.address || '');
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not inspect network interfaces.'));
    refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const start = async () => {
    setBusy(true);
    setError('');
    try { setSession(await systemApi.startPhoneSession(address)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not start the secure session.'); }
    finally { setBusy(false); }
  };

  const stop = async () => {
    setBusy(true);
    try {
      setSession(await systemApi.stopPhoneSession());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop the secure session.');
    }
    finally { setBusy(false); }
  };

  const decide = async (id: string, approved: boolean) => {
    try {
      setSession(await systemApi.decidePhonePairing(id, approved));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the pairing request.');
    }
  };

  const toggleAutoAccept = async (name: string, autoAccept: boolean) => {
    try {
      const devices = await systemApi.setDeviceAutoAccept(name, autoAccept);
      setSession((current) => ({
        ...current,
        devices: current.devices.map((device) => ({
          ...device,
          auto_accept: devices.find((item) => item.name === device.name)?.auto_accept ?? false,
        })),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the auto-accept setting.');
    }
  };

  const forget = async (name: string) => {
    try {
      setSession(await systemApi.forgetDevice(name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not forget the paired device.');
    }
  };

  const expires = session.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : '';

  return (
    <main style={{ minHeight: '100vh', padding: 22, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary)', background: 'linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))', overflowY: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
          <Smartphone size={22} color="var(--accent-cyan)" />
          <div><h1 style={{ fontSize: 17, margin: 0 }}>Omachy Connect</h1><small style={{ color: 'var(--text-muted)' }}>Direct local phone pairing</small></div>
        </div>
        <span className={`badge ${session.active ? 'badge-online' : 'badge-demo'}`}>{session.active ? 'Session active' : 'Session stopped'}</span>
      </header>

      {error && <div role="alert" style={{ border: '1px solid color-mix(in srgb, var(--accent-amber) 45%, transparent)', borderRadius: 10, padding: 12, color: 'var(--accent-amber)', fontSize: 12 }}>{error}</div>}

      <section style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 650 }}><Wifi size={16} color="var(--accent-cyan)" /> {session.active ? (session.persistent ? 'Always-on secure session' : 'Temporary secure session') : 'Always-on secure session'}</div>
        {!session.active ? <>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>Connect the computer to your phone hotspot first. Select the computer’s Wi-Fi address below; the phone must reach this exact address. The QR securely provides the address and one-time trust code. Pairing still requires your approval.</p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            Network interface and address
            <select value={address} onChange={(event) => setAddress(event.target.value)} disabled={busy || !interfaces.length} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}>
              {interfaces.map((item) => <option key={`${item.interface}-${item.address}`} value={item.address}>{item.interface}{item.wireless ? ' (Wi-Fi)' : ''} · {item.address}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={start} disabled={busy || !address}><RefreshCw size={14} /> {busy ? 'Starting…' : 'Connect Phone'}</button>
        </> : <>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span><b>{session.address}:{session.port}</b> · Wi-Fi transfer port</span>
            <span style={{ color: 'var(--text-muted)' }}>{session.persistent ? 'Always-on · stays connected while the hotspot is on' : `Expires ${expires}`}</span>
          </div>
          {session.devices.map((device) => (
            <div key={device.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--status-online)' }}>
              <span><ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Paired device: {device.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={Boolean(device.auto_accept)} onChange={(event) => void toggleAutoAccept(device.name, event.target.checked)} />
                  Auto-accept files
                </label>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => forget(device.name)}>Forget</button>
              </span>
            </div>
          ))}
          {session.qr_png_base64 && session.pairing_token && <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <img alt="Temporary Omachy secure pairing QR code" width={176} height={176} style={{ background: 'white', borderRadius: 8, padding: 6 }} src={`data:image/png;base64,${session.qr_png_base64}`} />
            <div style={{ minWidth: 190, flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>TLS certificate SHA-256 fingerprint</div>
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 11, lineHeight: 1.5 }}>{session.fingerprint_sha256}</code>
              <div style={{ fontSize: 10, marginTop: 12, color: 'var(--text-muted)' }}>Only approve a device you initiated. The QR credential is temporary and invalidates after pairing.</div>
            </div>
          </div>}
          {session.pending.map((request) => <div key={request.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 11, borderRadius: 9, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12 }}><b>{request.device_name}</b> requests pairing</span>
            <span style={{ display: 'flex', gap: 6 }}><button className="btn btn-primary" onClick={() => decide(request.id, true)} aria-label={`Approve ${request.device_name}`}><Check size={14} /> Approve</button><button className="btn btn-secondary" onClick={() => decide(request.id, false)} aria-label={`Reject ${request.device_name}`}><X size={14} /> Reject</button></span>
          </div>)}
          <button className="btn btn-secondary" onClick={stop} disabled={busy} style={{ alignSelf: 'flex-start' }}><Square size={13} /> Stop session</button>
        </>}
      </section>

      <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 13, fontSize: 11, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        <b style={{ color: 'var(--text-primary)' }}>On Android:</b> Approve the pairing here. Once the phone says it is connected, tap <b>Choose a file to send to computer</b> in the Android app; Android will then open its file picker. Approve the incoming offer in Omachy Drop.
      </section>
      <button className="btn-ghost" onClick={() => systemApi.launchApp('drop')} style={{ alignSelf: 'flex-start', fontSize: 11 }}><ExternalLink size={13} /> Open Omachy Drop</button>
    </main>
  );
};
