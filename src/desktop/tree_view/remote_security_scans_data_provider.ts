import path from 'path';
import * as vscode from 'vscode';
import { SecurityScanClientResponse, Vulnerability } from '@gitlab-org/gitlab-lsp';
import { ScanState, securityScanEventBus } from '../../common/security_scans/scan_event_bus';
import { ItemModel } from './items/item_model';
import { onSidebarViewStateChange } from './sidebar_view_state';
import { FileScanResultItem, FileScanResultItemParam } from './items/filescan_result_item';
import { FileScanStatusItem } from './items/filescan_status_item';
import { FileScanVulnerabilityItem } from './items/filescan_vuln_item';
import { Severity } from './items/security/severity_to_icon';

const REFRESH_INTERVAL_MS = 300_000; // 5 minutes

// details on the severity level can be found from https://docs.gitlab.com/user/application_security/vulnerabilities/severities/
const SeverityLevelsMapping: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
  UNKNOWN: 0,
};
export class RemoteSecurityScansDataProvider
  implements vscode.TreeDataProvider<ItemModel | vscode.TreeItem>, vscode.Disposable
{
  #eventEmitter = new vscode.EventEmitter<void>();

  onDidChangeTreeData = this.#eventEmitter.event;

  getScanState: () => ScanState = () => this.#scanState;

  #results: Map<string, FileScanResultItemParam> = new Map();

  #scanState: ScanState = {
    isRunning: false,
    fileNames: new Set(),
  };

  #statusItem: FileScanStatusItem;

  #refreshIntervalId: NodeJS.Timeout;

  constructor() {
    this.#statusItem = new FileScanStatusItem(this.#scanState);
    this.#initializeEventListeners();
    // refresh to update the relative timestamp (eg. "5 minutes ago")
    this.#refreshIntervalId = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
  }

  async getChildren(item: ItemModel | undefined): Promise<(ItemModel | vscode.TreeItem)[]> {
    if (!item) {
      const items: (ItemModel | vscode.TreeItem)[] = [this.#statusItem];
      items.push(...this.#createScanResultItems(this.#results));
      return items;
    }

    if (item instanceof FileScanResultItem) {
      return item.vulnerabilities.map(
        v => new FileScanVulnerabilityItem(v, this.#extractFileName(item.filePath), item.timestamp),
      );
    }

    return [];
  }

  getTreeItem(item: ItemModel | vscode.TreeItem) {
    if (item instanceof ItemModel) return item.getTreeItem();
    return item;
  }

  refresh() {
    this.#eventEmitter.fire();
  }

  #updateScanResults(res: SecurityScanClientResponse) {
    if (!res.results) return;

    if (res.results.length === 0) {
      this.#results.delete(res.filePath);
    } else {
      this.#results.set(res.filePath, {
        filePath: res.filePath,
        vulnerabilities: this.#sortBySeverity(res.results),
        timestamp: res.timestamp,
      });
    }
  }

  #createScanResultItems(results: Map<string, FileScanResultItemParam>) {
    return Array.from(results)
      .sort(([, result1], [, result2]) => result2.timestamp - result1.timestamp)
      .map(([, param]) => new FileScanResultItem(param));
  }

  #sortBySeverity(vulns: Vulnerability[]) {
    return vulns.sort(
      (a, b) =>
        SeverityLevelsMapping[b.severity.toUpperCase() as Severity] -
        SeverityLevelsMapping[a.severity.toUpperCase() as Severity],
    );
  }

  #extractFileName(filePath: string) {
    const filePathParts = filePath.split(path.sep);
    return filePathParts[filePathParts.length - 1];
  }

  #initializeEventListeners(): void {
    onSidebarViewStateChange(() => this.refresh(), this);

    securityScanEventBus.onScanInitiated((filePath: string) => {
      this.#scanState.isRunning = true;
      this.#scanState.fileNames.add(this.#extractFileName(filePath));
      this.#statusItem.updateState(this.#scanState);
      this.refresh();
    });

    securityScanEventBus.onScanResultUpdated(res => {
      const fileName = this.#extractFileName(res.filePath);
      this.#scanState.fileNames.delete(fileName);

      if (this.#scanState.fileNames.size === 0) this.#scanState.isRunning = false;

      this.#scanState.lastScan = {
        fileName,
        status: res.status === 200 ? 'success' : 'error',
        error: res.error,
      };
      this.#updateScanResults(res);
      this.#statusItem.updateState(this.#scanState);
      this.refresh();
    });
  }

  dispose() {
    if (this.#refreshIntervalId) {
      clearInterval(this.#refreshIntervalId);
    }
  }
}
