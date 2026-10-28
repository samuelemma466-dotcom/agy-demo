import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Activity, Wifi, Info } from 'lucide-react';
import { systemService } from '../../modules/system/systemService';
import { SystemTelemetry } from '../../types/system';

export const SystemStatusCard: React.FC = () => {
  const [telemetry, setTelemetry] = useState<SystemTelemetry>(systemService.getTelemetry());

  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry(systemService.getTelemetry());
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Activity size={18} color="var(--accent-cyan)" />
          <span>System Resource Telemetry</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-demo" title="Mocked local data until native sysfs daemon is active">
            <Info size={11} />
            Demo Telemetry
          </span>
        </div>
      </div>

      <div className="metrics-row">
        {/* CPU Box */}
        <div className="metric-box">
          <div className="metric-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Cpu size={14} /> CPU
            </span>
            <span>{telemetry.cpuUsagePercent}%</span>
          </div>
          <div className="metric-val">{telemetry.cpuUsagePercent}%</div>
          <div className="metric-bar-bg">
            <div
              className="metric-bar-fill"
              style={{
                width: `${telemetry.cpuUsagePercent}%`,
                background: telemetry.cpuUsagePercent > 80 ? 'var(--status-busy)' : 'var(--accent-cyan)',
              }}
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {telemetry.kernelVersion}
          </span>
        </div>

        {/* Memory Box */}
        <div className="metric-box">
          <div className="metric-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Activity size={14} /> RAM
            </span>
            <span>{telemetry.memoryPercent}%</span>
          </div>
          <div className="metric-val">
            {telemetry.memoryUsedGb} <span style={{ fontSize: '11px', fontWeight: 500 }}>/ {telemetry.memoryTotalGb} GB</span>
          </div>
          <div className="metric-bar-bg">
            <div
              className="metric-bar-fill"
              style={{ width: `${telemetry.memoryPercent}%`, background: 'var(--accent-purple)' }}
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            DDR5 System RAM
          </span>
        </div>

        {/* Disk Box */}
        <div className="metric-box">
          <div className="metric-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <HardDrive size={14} /> Storage
            </span>
            <span>{telemetry.diskPercent}%</span>
          </div>
          <div className="metric-val">
            {telemetry.diskUsedGb} <span style={{ fontSize: '11px', fontWeight: 500 }}>/ {telemetry.diskTotalGb} GB</span>
          </div>
          <div className="metric-bar-bg">
            <div
              className="metric-bar-fill"
              style={{ width: `${telemetry.diskPercent}%`, background: 'var(--accent-emerald)' }}
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Root (/) Partition
          </span>
        </div>

        {/* Network Box */}
        <div className="metric-box">
          <div className="metric-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Wifi size={14} /> Network
            </span>
            <span>Active</span>
          </div>
          <div className="metric-val">
            {telemetry.networkDownKbps} <span style={{ fontSize: '11px', fontWeight: 500 }}>KB/s</span>
          </div>
          <div className="metric-bar-bg">
            <div
              className="metric-bar-fill"
              style={{ width: '45%', background: 'var(--accent-amber)' }}
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            ↑ {telemetry.networkUpKbps} KB/s • ↓ {telemetry.networkDownKbps} KB/s
          </span>
        </div>
      </div>
    </div>
  );
};
