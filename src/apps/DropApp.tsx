import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, FileDown, FileUp, FolderOpen, LoaderCircle, RefreshCw, Send, ShieldCheck, Square, X } from 'lucide-react';
import { PhoneSessionState, systemApi, TransferRecord } from '../services/systemApi';

const CHUNK_BYTES = 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024;

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

const terminal = new Set(['completed', 'rejected', 'canceled', 'failed']);

export const DropApp: React.FC = () => {
  const [session, setSession] = useState<PhoneSessionState>({ active: false, pending: [], devices: [] });
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canceled = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const [nextSession, nextTransfers] = await Promise.all([
        systemApi.getPhoneSession(), systemApi.getTransfers(),
      ]);
      setError('');
      setSession(nextSession);
      setTransfers(nextTransfers.transfers);
      setSelectedDevice((current) => nextSession.devices.some((device) => device.name === current)
        ? current
        : nextSession.devices[0]?.name || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read transfer state.');
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 900);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const beginSending = async (files: FileList | File[]) => {
    if (!files.length) return;
    if (!session.active || !session.devices.length) {
      setError('Start Omachy Connect and pair a phone before sending files.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('Preparing file transfer…');
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} exceeds the 10 GiB transfer limit.`);
        continue;
      }
      let transferId = '';
      try {
        const created = await systemApi.createDesktopTransfer(file.name, file.size, selectedDevice || session.devices[0].name);
        transferId = created.id;
        for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
          if (canceled.current.has(transferId)) throw new Error('Transfer canceled.');
          const chunk = file.slice(offset, Math.min(offset + CHUNK_BYTES, file.size));
          const record = await systemApi.uploadDesktopSourceChunk(transferId, offset, file.size, chunk);
          setMessage(`Preparing ${file.name}: ${humanBytes(record.source_bytes ?? offset + chunk.size)} / ${humanBytes(file.size)}`);
        }
        setMessage(`${file.name} is ready. Waiting for the phone to accept it.`);
      } catch (err) {
        if (transferId && !canceled.current.has(transferId)) {
          try { await systemApi.cancelTransfer(transferId); } catch { /* session may have expired */ }
        }
        setError(err instanceof Error ? err.message : `Could not prepare ${file.name}.`);
      }
    }
    canceled.current.clear();
    setBusy(false);
    await refresh();
  };

  const decide = async (id: string, accepted: boolean) => {
    try {
      await systemApi.decideTransfer(id, accepted);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update the offer.'); }
  };

  const cancel = async (id: string) => {
    canceled.current.add(id);
    try { await systemApi.cancelTransfer(id); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel the transfer.'); }
  };

  const openFolder = async () => {
    try { await systemApi.openDropFolder(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not open ~/Downloads/OmachyDrop.'); }
  };

  const titleFor = (item: TransferRecord) => {
    if (item.status === 'source_uploading') return 'Preparing on this computer';
    if (item.status === 'offered') return item.direction === 'phone_to_desktop' ? 'Waiting for your approval' : 'Waiting for phone approval';
    if (item.status === 'accepted') return 'Approved · waiting for transfer';
    if (item.status === 'transferring') return 'Transferring';
    if (item.status === 'awaiting_verification') return 'Checking phone integrity result';
    if (item.status === 'completed') return 'Verified and complete';
    if (item.status === 'rejected') return 'Rejected';
    if (item.status === 'canceled') return 'Canceled';
    return item.error || 'Transfer failed';
  };

  const incomingPending = transfers.filter((item) => item.direction === 'phone_to_desktop' && item.status === 'offered');

  return (
    <main style={{ minHeight: '100vh', padding: 22, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary)', background: 'linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))', overflowY: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Send size={21} color="var(--accent-emerald)" />
          <div><h1 style={{ fontSize: 17, margin: 0 }}>Omachy Drop</h1><small style={{ color: 'var(--text-muted)' }}>Direct local transfers · no cloud</small></div>
        </div>
        <button className="btn btn-secondary" onClick={openFolder} style={{ fontSize: 11 }}><FolderOpen size={14} /> Received files</button>
      </header>

      {!session.active && <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>Start a secure session in Omachy Connect to send or receive files. The listener is not running.</div>}
      {session.active && !session.devices.length && <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>Session active on {session.address}; pair and approve a phone in Omachy Connect before transferring.</div>}
      {error && <div role="alert" style={{ display: 'flex', gap: 8, border: '1px solid color-mix(in srgb, var(--accent-amber) 45%, transparent)', borderRadius: 10, padding: 12, color: 'var(--accent-amber)', fontSize: 12 }}><CircleAlert size={15} />{error}</div>}
      {message && <div role="status" style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 10, fontSize: 12, color: 'var(--text-secondary)' }}>{message}</div>}

      <section style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 650, display: 'flex', alignItems: 'center', gap: 8 }}><FileUp size={16} color="var(--accent-cyan)" /> Send files to phone</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {session.devices.length > 1 && <select value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)} style={{ flex: 1, padding: 9, borderRadius: 8, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            {session.devices.map((device) => <option key={device.name} value={device.name}>{device.name}</option>)}
          </select>}
          <input ref={fileInput} type="file" multiple hidden onChange={(event) => { if (event.target.files) void beginSending(event.target.files); event.currentTarget.value = ''; }} />
          <button className="btn btn-primary" onClick={() => fileInput.current?.click()} disabled={busy || !session.devices.length}><FileUp size={14} /> Choose files</button>
        </div>
        <small style={{ color: 'var(--text-muted)' }}>Files are staged in bounded 1 MiB chunks. The phone must accept each offer and confirm its SHA-256 after receiving the bytes. Limit: 10 GiB per file.</small>
      </section>

      <section style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 650, display: 'flex', alignItems: 'center', gap: 8 }}><FileDown size={16} color="var(--accent-emerald)" /> Incoming offers</div>
        {incomingPending.length === 0 ? <small style={{ color: 'var(--text-muted)' }}>No phone file offers are waiting for approval.</small> : incomingPending.map((item) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: 11, borderRadius: 9, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
          <div><b style={{ fontSize: 12 }}>{item.name}</b><div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{item.device_name} · {humanBytes(item.size)}</div></div>
          <div style={{ display: 'flex', gap: 6 }}><button className="btn btn-primary" onClick={() => decide(item.id, true)}><Check size={14} /> Accept</button><button className="btn btn-secondary" onClick={() => decide(item.id, false)}><X size={14} /> Reject</button></div>
        </div>)}
      </section>

      <section style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 650 }}><span>Transfers and history ({transfers.length})</span><button className="btn-ghost" onClick={() => void refresh()} aria-label="Refresh transfers"><RefreshCw size={13} /></button></div>
        {transfers.length === 0 ? <small style={{ color: 'var(--text-muted)' }}>No transfers in this connection session yet.</small> : transfers.map((item) => {
          const progress = item.status === 'source_uploading' ? (item.source_bytes ?? 0) : item.bytes_transferred;
          const showProgress = item.status === 'source_uploading' || item.status === 'transferring';
          return <div key={item.id} style={{ padding: 10, borderRadius: 9, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}><b style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{item.name}</b><div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{item.direction === 'phone_to_desktop' ? 'Phone → computer' : 'Computer → phone'} · {humanBytes(item.size)} · {item.device_name}</div><div style={{ fontSize: 10, marginTop: 4, color: item.status === 'completed' ? 'var(--status-online)' : item.error ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>{titleFor(item)}{item.saved_path ? ` · ${item.saved_path}` : ''}</div></div>
              {!terminal.has(item.status) && <button className="btn-ghost" onClick={() => void cancel(item.id)} aria-label={`Cancel ${item.name}`}><Square size={13} /></button>}
            </div>
            {showProgress && <div style={{ marginTop: 8 }}><div style={{ height: 5, borderRadius: 5, background: 'var(--border-subtle)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, item.size ? progress / item.size * 100 : 100)}%`, height: '100%', background: 'var(--accent-cyan)', transition: 'width 120ms linear' }} /></div><small style={{ color: 'var(--text-muted)' }}>{humanBytes(progress)} / {humanBytes(item.size)}</small></div>}
            {item.status === 'awaiting_verification' && <small style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', marginTop: 6 }}><LoaderCircle size={12} /> Waiting for receiver digest confirmation</small>}
            {item.status === 'completed' && <small style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--status-online)', marginTop: 6 }}><ShieldCheck size={12} /> SHA-256 verified</small>}
          </div>;
        })}
      </section>
    </main>
  );
};
