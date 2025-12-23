import { Vulnerability } from '@gitlab-org/gitlab-lsp';
import * as vscode from 'vscode';
import { COMMAND_SHOW_VULNS_DETAILS } from '../../../common/security_scans/open_vulns_details';
import { FileScanVulnerabilityItem } from './filescan_vuln_item';

describe('FileScanVulnerabilityItem', () => {
  let fileScanVulnerabilityItem: FileScanVulnerabilityItem;

  const mockVulnerability: Vulnerability = {
    name: 'Test vulnerability',
    severity: 'High',
    description: 'This is mock vulnerability',
    location: {
      start_line: 1,
      end_line: 1,
      start_column: 0,
      end_column: 0,
    },
  };
  const mockFilePath = '/path/to/file.ts';
  const mockTimestamp = '2023-05-15T12:00:00Z';

  beforeEach(() => {
    fileScanVulnerabilityItem = new FileScanVulnerabilityItem(
      mockVulnerability,
      mockFilePath,
      mockTimestamp,
    );
  });

  it('should create a FileScanVulnerabilityItem with correct properties', () => {
    expect(fileScanVulnerabilityItem.label).toBe('[High] This is mock vulnerability');
    expect(fileScanVulnerabilityItem.severity).toBe('High');
  });

  it('should have a command with correct properties', async () => {
    if (!fileScanVulnerabilityItem.command) fail('command should be defined');
    expect(fileScanVulnerabilityItem.command.command).toBe(COMMAND_SHOW_VULNS_DETAILS);
    expect(fileScanVulnerabilityItem.command.title).toBe('Show details');
    expect(fileScanVulnerabilityItem.command.arguments).toEqual([
      mockVulnerability,
      mockFilePath,
      mockTimestamp,
    ]);

    await vscode.commands.executeCommand(
      fileScanVulnerabilityItem.command?.command,
      fileScanVulnerabilityItem.command?.arguments,
    );
  });
});
