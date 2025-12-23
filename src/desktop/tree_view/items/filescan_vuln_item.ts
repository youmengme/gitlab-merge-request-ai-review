import { TreeItem } from 'vscode';
import { Vulnerability } from '@gitlab-org/gitlab-lsp';
import { COMMAND_SHOW_VULNS_DETAILS } from '../../../common/security_scans/open_vulns_details';

export class FileScanVulnerabilityItem extends TreeItem {
  severity: string;

  constructor(v: Vulnerability, filePath: string, timestamp: string) {
    super(`[${v.severity}] ${v.description}`);
    this.command = {
      command: COMMAND_SHOW_VULNS_DETAILS,
      title: 'Show details',
      arguments: [v, filePath, timestamp],
    };
    this.severity = v.severity;
  }
}
