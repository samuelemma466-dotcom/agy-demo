import React from 'react';
import { Info, Send, ExternalLink } from 'lucide-react';
import { systemApi } from '../../services/systemApi';

interface TransferPanelProps {
  onShowNotification: (msg: string) => void;
  phoneConnected: boolean;
}

export const TransferPanel: React.FC<TransferPanelProps> = ({ onShowNotification }) => (
  <section className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div className="disclaimer-banner">
      <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <p><strong>Use Omachy Connect and Omachy Drop together.</strong> Start and approve the phone connection in Connect, then review file offers and transfer progress in Drop. This older overview does not show live transfer history.</p>
    </div>
    <div className="card">
      <div className="card-header">
        <div className="card-title"><Send size={18} color="var(--accent-cyan)" /><span>Omachy Drop</span></div>
        <span className="badge badge-online">Open Drop for live transfers</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        Omachy Drop is the shared transfer inbox for the active Connect session. It handles both phone-to-computer and computer-to-phone transfers with approval and SHA-256 verification.
      </p>
      <button className="btn btn-secondary" onClick={async () => {
        try { await systemApi.launchApp('drop'); }
        catch { onShowNotification('Could not open Omachy Drop.'); }
      }}><ExternalLink size={14} /> Open Omachy Drop</button>
    </div>
  </section>
);
