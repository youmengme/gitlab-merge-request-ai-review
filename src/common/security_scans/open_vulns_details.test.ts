import { Vulnerability } from '@gitlab-org/gitlab-lsp';
import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { SECURITY_VULNS_WEBVIEW_ID } from '../constants';
import { COMMAND_CREATE_VULNS_DETAILS, openRemoteSecurityVulnsDetails } from './open_vulns_details';

describe('openRemoteSecurityVulnsDetails', () => {
  let client: BaseLanguageClient;
  let mockOpenVulnsDetails: ReturnType<typeof openRemoteSecurityVulnsDetails>;

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
  const mockTimestamp = 'Just now';

  beforeEach(() => {
    client = createFakePartial<BaseLanguageClient>({
      sendNotification: jest.fn(),
    });
    mockOpenVulnsDetails = openRemoteSecurityVulnsDetails(client);
  });

  it('should create panel', async () => {
    await mockOpenVulnsDetails(mockVulnerability, mockFilePath, mockTimestamp);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(COMMAND_CREATE_VULNS_DETAILS);
    expect(client.sendNotification).toHaveBeenCalledWith('$/gitlab/plugin/notification', {
      pluginId: SECURITY_VULNS_WEBVIEW_ID,
      type: 'updateDetails',
      payload: {
        vulnerability: mockVulnerability,
        filePath: mockFilePath,
        timestamp: mockTimestamp,
      },
    });
  });
  it('should re-use existing panel', async () => {
    await mockOpenVulnsDetails(mockVulnerability, mockFilePath, mockTimestamp);
    await mockOpenVulnsDetails(mockVulnerability, mockFilePath, mockTimestamp);
    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(1, COMMAND_CREATE_VULNS_DETAILS);
    expect(client.sendNotification).toHaveBeenNthCalledWith(2, '$/gitlab/plugin/notification', {
      pluginId: SECURITY_VULNS_WEBVIEW_ID,
      type: 'updateDetails',
      payload: {
        vulnerability: mockVulnerability,
        filePath: mockFilePath,
        timestamp: mockTimestamp,
      },
    });
  });
});
