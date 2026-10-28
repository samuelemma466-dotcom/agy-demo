import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  FolderOpen,
  File,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { systemApi, DropFile } from '../services/systemApi';

export const DropApp: React.FC = () => {
  const [files, setFiles] = useState<DropFile[]>([]);
  const [dropDir, setDropDir] = useState<string>('~/Downloads/OmachyDrop');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
      const res = await systemApi.getDropFiles();
      setFiles(res.files);
      setDropDir(res.dir);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadFiles();
    const timer = setInterval(loadFiles, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenFolder = async () => {
    await systemApi.openDropFolder();
  };

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const file = selectedFiles[0];

    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      await systemApi.stageDropFile(file.name, content || 'Omachy Drop transfer');
      setUploadMessage(`Saved real file "${file.name}" to ${dropDir}`);
      loadFiles();
      setTimeout(() => setUploadMessage(null), 3000);
    };
    reader.readAsText(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 10% 10%, #151c2c 0%, #0a0d14 100%)',
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
          <Send size={22} color="var(--accent-emerald)" />
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700 }}>Omachy Drop</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Real File Sharing & Transfer Center
            </p>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={handleOpenFolder} style={{ fontSize: '12px' }}>
          <FolderOpen size={13} />
          <span>Open Folder</span>
        </button>
      </div>

      {/* Toast Notification */}
      {uploadMessage && (
        <div
          className="animate-fade-in"
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '12.5px',
            color: '#6ee7b7',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{uploadMessage}</span>
        </div>
      )}

      {/* Real Drop Directory Location Banner */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <HardDrive size={14} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)' }}>Target Directory:</span>
          <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
            {dropDir}
          </span>
        </div>
        <span className="badge badge-online">Ready</span>
      </div>

      {/* Send Dropzone */}
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
          border: `2px dashed ${isDragOver ? 'var(--accent-emerald)' : 'var(--border-medium)'}`,
          borderRadius: 'var(--radius-lg)',
          background: isDragOver ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <UploadCloud size={32} color={isDragOver ? 'var(--accent-emerald)' : 'var(--text-muted)'} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '13.5px' }}>
            Drop files here to stage transfer
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Files are saved to your real <code className="font-mono">~/Downloads/OmachyDrop</code>
          </div>
        </div>
      </div>

      {/* Files List in Directory */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            Files in Drop Folder ({files.length})
          </span>
          <button className="btn-ghost" onClick={loadFiles} style={{ padding: '2px 6px', fontSize: '11px' }}>
            <RefreshCw size={11} style={{ marginRight: 4 }} /> Refresh
          </button>
        </div>

        {files.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            No files staged in OmachyDrop yet. Drop any file above to test real file writing.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map((file, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <File size={16} color="var(--accent-cyan)" />
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 500 }}>{file.name}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {formatBytes(file.size)}
                    </div>
                  </div>
                </div>

                <button
                  className="btn-ghost"
                  style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}
                  onClick={handleOpenFolder}
                >
                  Locate
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
