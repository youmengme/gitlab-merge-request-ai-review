import path from 'path';
import * as vscode from 'vscode';
import { Vulnerability } from '@gitlab-org/gitlab-lsp';
import { truncateFromStart } from '../../utils/truncate_from_start';

const MAX_PATH_LENGTH = 15;

export type FileScanResultItemParam = {
  filePath: string;
  vulnerabilities: Vulnerability[];
  timestamp: number;
};
export class FileScanResultItem extends vscode.TreeItem {
  vulnerabilities: Vulnerability[];

  filePath: string;

  timestamp: string;

  constructor({ filePath, vulnerabilities, timestamp }: FileScanResultItemParam) {
    const filePathParts = filePath.split(path.sep);
    const fileName = filePathParts[filePathParts.length - 1];

    super(fileName, vscode.TreeItemCollapsibleState.Expanded);

    this.vulnerabilities = vulnerabilities;
    this.filePath = filePath;
    this.timestamp = this.#getRelativeTimestamp(timestamp);
    this.description = this.#createDescription(filePath, timestamp);
  }

  #createDescription(filePath: string, timestamp: number) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    let displayedFilePath = workspaceFolder
      ? path.relative(workspaceFolder?.uri.fsPath, filePath)
      : filePath;

    displayedFilePath = truncateFromStart(filePath, MAX_PATH_LENGTH);
    return `${this.#getRelativeTimestamp(timestamp)} [${displayedFilePath}]`;
  }

  #getRelativeTimestamp(timestamp: number) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago `;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago `;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago `;
    }
    return `Just now`;
  }
}
