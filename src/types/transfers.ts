export type TransferDirection = 'send' | 'receive';
export type TransferStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'simulated_ready';

export interface FileTransferItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  direction: TransferDirection;
  status: TransferStatus;
  progressPercent: number;
  targetDevice: string;
  timestamp: string;
  speedKbps?: number;
  isSimulated: boolean;
}
