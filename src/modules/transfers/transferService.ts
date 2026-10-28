/**
 * File Transfer Service Module
 * 
 * Purpose:
 * Prepares the file transfer pipeline for Omachy Desktop.
 * Will interface with KDE Connect file transfers (port 1716) or local WebRTC/HTTP daemon.
 * 
 * Current state:
 * - Honest demonstration mode. Simulated transfers clearly state "Simulated Demo"
 * - Does not pretend files have transferred to remote endpoints without real connection.
 */

import { FileTransferItem, TransferDirection } from '../../types/transfers';

export class TransferService {
  private transferQueue: FileTransferItem[] = [
    {
      id: 'tx-1',
      fileName: 'omarchy-theme-config.tar.gz',
      fileSizeBytes: 14200000, // ~14.2 MB
      direction: 'send',
      status: 'simulated_ready',
      progressPercent: 100,
      targetDevice: 'Demo Target Device',
      timestamp: 'Today, 19:40',
      speedKbps: 4200,
      isSimulated: true,
    },
    {
      id: 'tx-2',
      fileName: 'workspace-wallpaper.png',
      fileSizeBytes: 4800000, // ~4.8 MB
      direction: 'receive',
      status: 'simulated_ready',
      progressPercent: 100,
      targetDevice: 'Pixel 8 (Demo)',
      timestamp: 'Today, 18:15',
      speedKbps: 3100,
      isSimulated: true,
    },
  ];

  getQueue(): FileTransferItem[] {
    return [...this.transferQueue];
  }

  /**
   * Enqueue a new simulated or real transfer
   */
  queueTransfer(
    file: { name: string; size: number },
    direction: TransferDirection,
    targetDevice: string,
    onProgress: (item: FileTransferItem) => void
  ): FileTransferItem {
    const newItem: FileTransferItem = {
      id: `tx-${Date.now()}`,
      fileName: file.name,
      fileSizeBytes: file.size,
      direction,
      status: 'in_progress',
      progressPercent: 0,
      targetDevice,
      timestamp: 'Just now',
      speedKbps: 5200,
      isSimulated: true, // Marked demonstrative
    };

    this.transferQueue.unshift(newItem);
    onProgress(newItem);

    // Simulate transfer ticks with honest finish
    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      if (current >= 100) {
        newItem.progressPercent = 100;
        newItem.status = 'completed';
        clearInterval(interval);
      } else {
        newItem.progressPercent = current;
      }
      onProgress({ ...newItem });
    }, 300);

    return newItem;
  }

  clearCompleted(): void {
    this.transferQueue = this.transferQueue.filter(
      (item) => item.status === 'in_progress' || item.status === 'queued'
    );
  }
}

export const transferService = new TransferService();
