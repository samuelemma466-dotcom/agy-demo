import React, { useState, useRef } from 'react';
import {
  Send,
  Download,
  UploadCloud,
  Info,
  Clock,
  Trash2,
} from 'lucide-react';
import { transferService } from '../../modules/transfers/transferService';
import { FileTransferItem } from '../../types/transfers';

interface TransferPanelProps {
  onShowNotification: (msg: string) => void;
  phoneConnected: boolean;
}

export const TransferPanel: React.FC<TransferPanelProps> = ({
  onShowNotification,
  phoneConnected,
}) => {
  const [transfers, setTransfers] = useState<FileTransferItem[]>(transferService.getQueue());
  const [selectedTarget, setSelectedTarget] = useState<string>('Android Phone (Pixel 8)');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    onShowNotification(`Starting simulated transfer for "${file.name}"...`);

    transferService.queueTransfer(
      file,
      'send',
      selectedTarget,
      (updatedItem) => {
        setTransfers(transferService.getQueue());
        if (updatedItem.status === 'completed') {
          onShowNotification(`Simulated transfer completed: ${file.name}`);
        }
      }
    );
  };

  const handleSimulateReceive = () => {
    const mockFile = {
      name: 'received_photo_2026.jpg',
      size: 2450000,
    };

    onShowNotification('Incoming transfer received from Pixel 8 (Simulated)...');

    transferService.queueTransfer(
      mockFile,
      'receive',
      'Local Desktop (~/Downloads)',
      (updatedItem) => {
        setTransfers(transferService.getQueue());
        if (updatedItem.status === 'completed') {
          onShowNotification('File placed in ~/Downloads (Simulated)');
        }
      }
    );
  };

  const handleClear = () => {
    transferService.clearCompleted();
    setTransfers(transferService.getQueue());
    onShowNotification('Cleared completed transfers');
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Honest Demo State Banner */}
      <div className="disclaimer-banner">
        <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p>
            <strong>Honest File Transfer Notice:</strong> File transfers in this prototype demonstrate the
            user interface and queue management. Real transfer over KDE Connect protocol or local sockets
            is separated in <code>src/modules/transfers/transferService.ts</code>. No files will actually be transmitted to remote devices.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* SEND ACTION PANEL (6 cols) */}
        <div className="col-6">
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <div className="card-title">
                <Send size={18} color="var(--accent-cyan)" />
                <span>Send Files to Devices</span>
              </div>
              <span className="badge badge-primary">Send Action</span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Select a target device and beam files wirelessly using the local network.
            </p>

            {/* Target device selector */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Destination Device:
                </label>
                <span style={{ fontSize: '11px', color: phoneConnected ? '#34d399' : 'var(--text-muted)' }}>
                  {phoneConnected ? '● Pixel 8 Paired' : '○ Phone Demo Target'}
                </span>
              </div>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-medium)',
                  outline: 'none',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="Android Phone (Pixel 8)" style={{ background: '#0f172a' }}>
                  Android Phone (Pixel 8) — KDE Connect
                </option>
                <option value="Local Home Server" style={{ background: '#0f172a' }}>
                  Local Home Server — SFTP / SSH
                </option>
                <option value="Nearby Omachy Peer" style={{ background: '#0f172a' }}>
                  Nearby Omachy Peer (mDNS)
                </option>
              </select>
            </div>

            {/* Dropzone */}
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                handleFileSelect(e.dataTransfer.files);
              }}
              style={{
                flex: 1,
                minHeight: '160px',
                border: `2px dashed ${isDragOver ? 'var(--accent-cyan)' : 'var(--border-medium)'}`,
                borderRadius: 'var(--radius-lg)',
                background: isDragOver ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                padding: '20px',
              }}
            >
              <UploadCloud size={32} color={isDragOver ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>
                  Drag & Drop files here, or click to browse
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supports documents, photos, audio, and archives
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RECEIVE ACTION PANEL (6 cols) */}
        <div className="col-6">
          <div className="card" style={{ height: '100%', justifyContent: 'space-between' }}>
            <div>
              <div className="card-header">
                <div className="card-title">
                  <Download size={18} color="var(--accent-emerald)" />
                  <span>Receive Files</span>
                </div>
                <span className="badge badge-online">Listening</span>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Omachy Desktop listens on the local subnet for incoming file beams from paired mobile phones
                or peer desktop companions.
              </p>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Default Download Path:</span>
                  <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                    ~/Downloads/Omachy/
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Daemon Protocol:</span>
                  <span className="font-mono">KDE Connect 1716/tcp</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Auto-Accept Policy:</span>
                  <span>Paired Devices Only</span>
                </div>
              </div>
            </div>

            <div>
              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={handleSimulateReceive}
              >
                <Download size={15} />
                <span>Simulate Incoming Receive Action</span>
              </button>
            </div>
          </div>
        </div>

        {/* TRANSFER QUEUE & HISTORY (12 cols) */}
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Clock size={18} color="var(--text-secondary)" />
                <span>Transfer Queue & History</span>
              </div>
              <button className="btn-ghost" onClick={handleClear} style={{ fontSize: '12px' }}>
                <Trash2 size={13} style={{ marginRight: '4px' }} />
                Clear Completed
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transfers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No active or past transfers in queue.
                </div>
              ) : (
                transfers.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.direction === 'send' ? (
                          <Send size={16} color="var(--accent-cyan)" />
                        ) : (
                          <Download size={16} color="var(--accent-emerald)" />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{item.fileName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatBytes(item.fileSizeBytes)} • {item.targetDevice} • {item.timestamp}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.isSimulated && (
                          <span className="badge badge-demo" style={{ fontSize: '10px' }}>
                            Demo State
                          </span>
                        )}
                        <span
                          className={`badge ${
                            item.status === 'completed' || item.status === 'simulated_ready'
                              ? 'badge-online'
                              : 'badge-primary'
                          }`}
                        >
                          {item.status === 'completed' || item.status === 'simulated_ready'
                            ? 'Complete'
                            : `${item.progressPercent}%`}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="metric-bar-bg" style={{ height: '4px' }}>
                      <div
                        className="metric-bar-fill"
                        style={{
                          width: `${item.progressPercent}%`,
                          background:
                            item.status === 'completed' || item.status === 'simulated_ready'
                              ? 'var(--status-online)'
                              : 'var(--accent-cyan)',
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
