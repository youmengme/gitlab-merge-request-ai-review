import { BaseLanguageClient } from 'vscode-languageclient';
import vscode from 'vscode';
import {
  RemoteSecurityResponseScanNotificationType,
  RemoteSecurityScanNotificationType,
} from '@gitlab-org/gitlab-lsp';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { getSecurityScannerConfiguration } from '../utils/extension_configuration';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { securityScanEventBus } from './scan_event_bus';
import { createRemoteScanMessage } from './utils';

/**
 * Used for command palette
 */
export const COMMAND_RUN_SECURITY_SCAN = 'gl.runSecurityScan';
/**
 * Used for tree view action button
 * Separated from COMMAND_RUN_SECURITY_SCAN to provide a distinct display title
 */
export const COMMAND_RUN_SECURITY_SCAN_VIEW_TITLE = 'gl.runSecurityScanViewAction';

export const runSecurityScan =
  (
    client: BaseLanguageClient,
    gitLabPlatformManager: GitLabPlatformManager,
    source: 'save' | 'command',
  ) =>
  async () => {
    if (
      !(
        getLocalFeatureFlagService().isEnabled(FeatureFlag.RemoteSecurityScans) &&
        getSecurityScannerConfiguration().enabled
      )
    ) {
      return;
    }

    const platformForActiveAccount = await gitLabPlatformManager.getForActiveAccount(false);
    if (!platformForActiveAccount) {
      return;
    }

    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      // To avoid showing the message when the user didn't trigger the save.
      // ex: when the user updates the settings through the UI, settings.json is saved.
      if (source !== 'save')
        await vscode.window.showInformationMessage(createRemoteScanMessage('No open file.'));
      return;
    }

    const fileUri = editor.document.uri;

    await client.sendNotification(RemoteSecurityScanNotificationType, {
      documentUri: fileUri.toString(),
      source,
    });
    securityScanEventBus.initiateScan(fileUri.toString());

    await client.onNotification(RemoteSecurityResponseScanNotificationType, res => {
      securityScanEventBus.updateScanResults(res);
    });
  };
