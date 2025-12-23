import * as vscode from 'vscode';

import { ScanState } from '../../../common/security_scans/scan_event_bus';
import { FileScanStatusItem } from './filescan_status_item';

describe('FileScanStatusItem', () => {
  let scanState: ScanState;
  let mockItem: FileScanStatusItem;

  beforeEach(() => {
    scanState = {
      isRunning: false,
      fileNames: new Set(),
      lastScan: undefined,
    };
    mockItem = new FileScanStatusItem(scanState);
  });
  it('shows default state', () => {
    expect(mockItem.label).toBe('Last scan');
    expect(mockItem.iconPath).toStrictEqual(new vscode.ThemeIcon('info'));
    expect(mockItem.description).toBe('Unavailable');
  });

  describe('shows scan in progress', () => {
    it('with single file', async () => {
      const fileName = 'test.ts';
      const scanInProgressState = {
        isRunning: true,
        fileNames: new Set([fileName]),
      };
      mockItem.updateState(scanInProgressState);
      expect(mockItem.label).toBe('Scanning');
      expect(mockItem.iconPath).toStrictEqual(new vscode.ThemeIcon('loading~spin'));
      expect(mockItem.description).toBe(fileName);

      // No action on loading
      expect(mockItem.command).not.toBeDefined();
    });

    it('with multiple files', async () => {
      const fileName = 'test.ts';
      const filename2 = 'test2.ts';
      const scanInProgressState = {
        isRunning: true,
        fileNames: new Set([fileName, filename2]),
      };
      mockItem.updateState(scanInProgressState);
      expect(mockItem.label).toBe('Scanning');
      expect(mockItem.iconPath).toStrictEqual(new vscode.ThemeIcon('loading~spin'));
      expect(mockItem.description).toBe(`${fileName}, ${filename2}`);

      // No action on loading
      expect(mockItem.command).not.toBeDefined();
    });

    it('with previously completed file', async () => {
      const scanningFile = 'scanning.ts';
      const completedFile = 'completed.ts';
      const updatedState: ScanState = {
        isRunning: true,
        fileNames: new Set([scanningFile]),
        lastScan: {
          fileName: completedFile,
          status: 'success',
        },
      };
      mockItem.updateState(updatedState);
      expect(mockItem.label).toBe('Scanning');
      expect(mockItem.iconPath).toStrictEqual(new vscode.ThemeIcon('loading~spin'));
      expect(mockItem.description).toBe(scanningFile);

      // No action on loading
      expect(mockItem.command).not.toBeDefined();
    });
  });

  it('shows scan completed successfully', async () => {
    const completedState: ScanState = {
      isRunning: false,
      fileNames: new Set(),
      lastScan: {
        fileName: 'test.ts',
        status: 'success',
      },
    };
    mockItem.updateState(completedState);

    expect(mockItem.label).toBe('Last scan');
    expect(mockItem.iconPath).toStrictEqual(new vscode.ThemeIcon('check'));
    expect(mockItem.description).toBe(completedState.lastScan?.fileName);

    // No action on successful scan
    expect(mockItem.command).not.toBeDefined();
  });

  it('shows scan with error', async () => {
    const errorState: ScanState = {
      isRunning: false,
      fileNames: new Set(),
      lastScan: {
        fileName: 'test.ts',
        status: 'error',
        error: 'Unexpected error',
      },
    };
    mockItem.updateState(errorState);
    expect(mockItem.label).toBe('Last scan');
    expect(mockItem.iconPath).toStrictEqual(new vscode.ThemeIcon('error'));
    expect(mockItem.description).toBe(errorState.lastScan?.fileName);

    // Shows error message on error on click
    expect(mockItem.command).toStrictEqual({
      command: 'gl.showErrorMessage',
      title: 'Error',
      arguments: [`GitLab Remote Scan (SAST): ${errorState.lastScan?.error}`],
    });
  });
});
