import { SecurityScanClientResponse } from '@gitlab-org/gitlab-lsp';
import vscode from 'vscode';

export type ScanState = {
  isRunning: boolean;
  // list of files being scanned
  fileNames: Set<string>;
  lastScan?: {
    fileName: string;
    status: 'success' | 'error';
    error?: unknown;
  };
};

class SecurityScanEventBus {
  #onScanResultUpdated = new vscode.EventEmitter<SecurityScanClientResponse>();

  #onScanInitiated = new vscode.EventEmitter<string>();

  readonly onScanResultUpdated = this.#onScanResultUpdated.event;

  readonly onScanInitiated = this.#onScanInitiated.event;

  updateScanResults(results: SecurityScanClientResponse) {
    this.#onScanResultUpdated.fire(results);
  }

  initiateScan(fileName: string) {
    this.#onScanInitiated.fire(fileName);
  }
}

export const securityScanEventBus = new SecurityScanEventBus();
