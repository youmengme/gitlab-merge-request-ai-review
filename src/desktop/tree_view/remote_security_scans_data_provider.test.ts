import { SecurityScanClientResponse } from '@gitlab-org/gitlab-lsp';
import { securityScanEventBus } from '../../common/security_scans/scan_event_bus';
import { RemoteSecurityScansDataProvider } from './remote_security_scans_data_provider';
import { FileScanStatusItem } from './items/filescan_status_item';

describe('RemoteSecurityScansDataProvider', () => {
  let scanDataprovider: RemoteSecurityScansDataProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    scanDataprovider = new RemoteSecurityScansDataProvider();
  });

  afterEach(() => {
    scanDataprovider.dispose();
  });

  describe('inititial render', () => {
    it('only status item is visible', async () => {
      await scanDataprovider.refresh();
      const children = await scanDataprovider.getChildren(undefined);
      expect(children.length).toBe(1); // Initially only status item
      expect(children[0]).toBeInstanceOf(FileScanStatusItem);
    });
  });

  describe('event listeners update state when', () => {
    beforeEach(() => {
      jest.spyOn(scanDataprovider, 'refresh');
    });
    it('scan initiated', async () => {
      securityScanEventBus.initiateScan('./test.js');
      const scanState = scanDataprovider.getScanState();
      expect(scanState.isRunning).toBe(true);
      const expectFileNames = new Set(['test.js']);
      expect(scanState.fileNames).toEqual(expectFileNames);
      expect(scanDataprovider.refresh).toHaveBeenCalled();
    });

    it('scan completed', async () => {
      const mockResult: SecurityScanClientResponse = {
        filePath: './test.js',
        status: 200,
        results: [
          {
            description: 'Vulnerability description',
            severity: 'High',
            name: 'Vulnerability name',
            location: {
              start_line: 1,
              end_line: 1,
              start_column: 1,
              end_column: 1,
            },
          },
        ],
        timestamp: 1731552844336,
      };

      securityScanEventBus.initiateScan('./test.js');
      expect(scanDataprovider.getScanState().isRunning).toBe(true);

      securityScanEventBus.updateScanResults(mockResult);

      const scanState = scanDataprovider.getScanState();
      expect(scanState.isRunning).toBe(false);
      expect(scanState.fileNames).toEqual(new Set());
      expect(scanState.lastScan).toEqual({
        fileName: 'test.js',
        status: 'success',
      });
      expect(scanDataprovider.refresh).toHaveBeenCalled();
    });

    it('scan failed', async () => {
      const errorResult: SecurityScanClientResponse = {
        filePath: './test.js',
        status: 500,
        error: 'unknown error',
        timestamp: 1731552844336,
      };
      securityScanEventBus.updateScanResults(errorResult);
      const scanState = scanDataprovider.getScanState();

      expect(scanState.isRunning).toBe(false);
      expect(scanState.fileNames).toEqual(new Set());
      expect(scanState.lastScan).toEqual({
        fileName: 'test.js',
        status: 'error',
        error: 'unknown error',
      });

      const children = await scanDataprovider.getChildren(undefined);
      expect(children.length).toBe(1); // only error status item displayed
      expect(children[0]).toBeInstanceOf(FileScanStatusItem);
    });
  });
});
