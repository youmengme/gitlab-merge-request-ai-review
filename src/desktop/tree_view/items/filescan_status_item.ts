import * as vscode from 'vscode';
import { ScanState } from '../../../common/security_scans/scan_event_bus';
import { PROGRAMMATIC_COMMANDS } from '../../command_names';
import { createRemoteScanMessage } from '../../../common/security_scans/utils';

export class FileScanStatusItem extends vscode.TreeItem {
  #currentState: ScanState = {
    isRunning: false,
    fileNames: new Set(),
  };

  constructor(state: ScanState) {
    super('Last scan');
    this.#currentState = state;
    this.iconPath = new vscode.ThemeIcon('info');
    this.description = 'Unavailable';
  }

  updateState(newState: ScanState) {
    this.#currentState = newState;
    if (this.#currentState.lastScan?.error) {
      this.command = {
        command: PROGRAMMATIC_COMMANDS.SHOW_ERROR_MESSAGE,
        title: 'Error',
        arguments: [createRemoteScanMessage(this.#currentState.lastScan?.error)],
      };
    }
    this.label = this.#getLabel();
    this.iconPath = this.#getIcon();
    this.description = this.#getDescription();
  }

  #getLabel() {
    return this.#currentState.isRunning ? 'Scanning' : 'Last scan';
  }

  #getIcon() {
    if (this.#currentState.isRunning) {
      return new vscode.ThemeIcon('loading~spin');
    }

    return this.#currentState.lastScan?.status === 'success'
      ? new vscode.ThemeIcon('check')
      : new vscode.ThemeIcon('error');
  }

  #getDescription() {
    return this.#currentState.isRunning
      ? Array.from(this.#currentState.fileNames).join(', ')
      : this.#currentState.lastScan?.fileName;
  }
}
