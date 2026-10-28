export interface SystemTelemetry {
  cpuUsagePercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  memoryPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  diskPercent: number;
  networkUpKbps: number;
  networkDownKbps: number;
  uptimeHours: number;
  hostname: string;
  osName: string;
  kernelVersion: string;
  isRealTelemetry: boolean;
}
