/**
 * System Telemetry Service Module
 * 
 * Purpose:
 * Prepares system metrics monitoring (CPU, RAM, Disk, Network) for Linux desktop.
 * 
 * Future implementation:
 * - Read /proc/stat, /proc/meminfo, /proc/net/dev, statvfs via local daemon or Tauri/Electron bridge.
 * 
 * Current state:
 * - Local simulated metrics that realistically fluctuate, clearly flagged as isRealTelemetry: false.
 */

import { SystemTelemetry } from '../../types/system';

export class SystemService {
  private currentTelemetry: SystemTelemetry = {
    cpuUsagePercent: 24,
    memoryUsedGb: 6.8,
    memoryTotalGb: 16.0,
    memoryPercent: 42.5,
    diskUsedGb: 184,
    diskTotalGb: 512,
    diskPercent: 35.9,
    networkUpKbps: 120,
    networkDownKbps: 840,
    uptimeHours: 38,
    hostname: 'arch-companion',
    osName: 'Linux (Omarchy / Arch-based)',
    kernelVersion: '6.12.1-arch1-1',
    isRealTelemetry: false, // Honest demo indicator
  };

  getTelemetry(): SystemTelemetry {
    // Generate realistic micro-fluctuations for prototype vibrancy
    const cpuJitter = Math.floor(Math.random() * 7) - 3;
    const netJitter = Math.floor(Math.random() * 80) - 40;

    return {
      ...this.currentTelemetry,
      cpuUsagePercent: Math.max(5, Math.min(95, this.currentTelemetry.cpuUsagePercent + cpuJitter)),
      networkDownKbps: Math.max(50, this.currentTelemetry.networkDownKbps + netJitter),
    };
  }
}

export const systemService = new SystemService();
