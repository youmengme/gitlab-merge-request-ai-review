import vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import {
  RemoteSecurityScanNotificationParam,
  RemoteSecurityScanNotificationType,
} from '@gitlab-org/gitlab-lsp';
import {
  getLocalFeatureFlagService,
  LocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  getSecurityScannerConfiguration,
  SecurityScannerConfiguration,
} from '../utils/extension_configuration';
import { GitLabPlatformForAccount, GitLabPlatformManager } from '../platform/gitlab_platform';
import { Account } from '../platform/gitlab_account';
import { runSecurityScan } from './run_security_scan';
import { securityScanEventBus } from './scan_event_bus';

jest.mock('../utils/extension_configuration');
jest.mock('../feature_flags/local_feature_flag_service');
jest.mock('./scan_event_bus');

const mockAccount = createFakePartial<GitLabPlatformForAccount>({
  account: createFakePartial<Account>({}),
});

describe('runSecurityScan command', () => {
  let showInformationMessage: jest.Mock;
  let client: BaseLanguageClient;
  let doRunSecurityScan: (source: RemoteSecurityScanNotificationParam['source']) => Promise<void>;
  let mockGitLabPlatformManager: GitLabPlatformManager;
  beforeEach(async () => {
    client = createFakePartial<BaseLanguageClient>({
      sendNotification: jest.fn(),
      onNotification: jest.fn(),
    });
    mockGitLabPlatformManager = createFakePartial<GitLabPlatformManager>({
      getForActiveAccount: jest.fn(async () => mockAccount),
    });
    doRunSecurityScan = source => runSecurityScan(client, mockGitLabPlatformManager, source)();

    showInformationMessage = jest.fn(() => Promise.resolve());
    (vscode.window.showInformationMessage as jest.Mock).mockImplementation(showInformationMessage);
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  const mockConfigEnabled = ({
    enabled,
    scanFileOnSave,
  }: {
    enabled: boolean;
    scanFileOnSave: boolean;
  }) => {
    jest
      .mocked(getSecurityScannerConfiguration)
      .mockReturnValue(
        createFakePartial<SecurityScannerConfiguration>({ enabled, scanFileOnSave }),
      );
  };

  const simulateDocumentSave = async () => {
    if (getSecurityScannerConfiguration().scanFileOnSave) await doRunSecurityScan('save');
  };

  describe('when disabled', () => {
    it('with feature flag does nothing', async () => {
      jest
        .mocked(getLocalFeatureFlagService)
        .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => false }));
      mockConfigEnabled({ enabled: true, scanFileOnSave: true });
      await doRunSecurityScan('command');
      expect(showInformationMessage).not.toHaveBeenCalled();
      expect(client.sendNotification).not.toHaveBeenCalled();
    });

    it('with configuration does nothing', async () => {
      jest
        .mocked(getLocalFeatureFlagService)
        .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => true }));
      mockConfigEnabled({ enabled: false, scanFileOnSave: true });
      await doRunSecurityScan('command');
      expect(showInformationMessage).not.toHaveBeenCalled();
      expect(client.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('when enabled', () => {
    beforeEach(async () => {
      jest
        .mocked(getLocalFeatureFlagService)
        .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => true }));
      mockConfigEnabled({ enabled: true, scanFileOnSave: true });
    });

    it('when there is no active editor shows a message', async () => {
      vscode.window.activeTextEditor = undefined;
      await doRunSecurityScan('command');
      expect(showInformationMessage).toHaveBeenCalledWith(
        'GitLab Remote Scan (SAST): No open file.',
      );
    });

    it('with no active account does nothing', async () => {
      jest.mocked(mockGitLabPlatformManager.getForActiveAccount).mockResolvedValue(undefined);
      await doRunSecurityScan('command');
      expect(showInformationMessage).not.toHaveBeenCalled();
      expect(client.sendNotification).not.toHaveBeenCalled();
    });

    describe('when there is active editor', () => {
      const mockUri = vscode.Uri.file('file.txt');

      beforeEach(() => {
        vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
          document: createFakePartial<vscode.TextDocument>({
            uri: mockUri,
            languageId: 'text',
            version: 1,
            getText: jest.fn().mockReturnValue('content'),
          }),
        });
      });

      it('initiates security scan for active editor', async () => {
        await doRunSecurityScan('save');
        expect(client.sendNotification).toHaveBeenCalledWith(RemoteSecurityScanNotificationType, {
          documentUri: mockUri.toString(),
          source: 'save',
        });
        expect(securityScanEventBus.initiateScan).toHaveBeenCalledWith(mockUri.toString());
      });
    });
  });

  describe('Scan File on Save', () => {
    beforeEach(async () => {
      jest
        .mocked(getLocalFeatureFlagService)
        .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => true }));
    });

    const mockUri = vscode.Uri.file('file.txt');
    vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
      document: createFakePartial<vscode.TextDocument>({
        uri: mockUri,
        languageId: 'text',
        version: 1,
        getText: jest.fn().mockReturnValue('content'),
      }),
    });

    it('is enabled', async () => {
      mockConfigEnabled({ enabled: true, scanFileOnSave: true });
      await simulateDocumentSave();
      expect(client.sendNotification).toHaveBeenCalled();
    });

    it.each`
      enabled  | scanFileOnSave
      ${true}  | ${false}
      ${false} | ${true}
      ${false} | ${false}
    `(
      'is disabled with enabled=$enabled and scanFileOnSave=$scanFileOnSave',
      async ({ enabled, scanFileOnSave }) => {
        mockConfigEnabled({ enabled, scanFileOnSave });
        await simulateDocumentSave();
        expect(client.sendNotification).not.toHaveBeenCalled();
      },
    );
  });
});
