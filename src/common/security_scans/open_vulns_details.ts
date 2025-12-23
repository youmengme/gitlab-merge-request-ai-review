import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { Vulnerability } from '@gitlab-org/gitlab-lsp';
import { SECURITY_VULNS_WEBVIEW_ID } from '../constants';

export const COMMAND_SHOW_VULNS_DETAILS = 'gl.webview.securityVulnDetails';
export const COMMAND_CREATE_VULNS_DETAILS = 'gl.webview.securityVulnDetails.show';

let webviewPanel: vscode.WebviewPanel | undefined;

export const openRemoteSecurityVulnsDetails =
  (client: BaseLanguageClient) =>
  async (vuln: Vulnerability, filePath: string, timestamp: string) => {
    if (!webviewPanel) {
      webviewPanel = await vscode.commands.executeCommand(COMMAND_CREATE_VULNS_DETAILS);
      webviewPanel?.onDidDispose(() => {
        webviewPanel = undefined;
      });
    }
    await client.sendNotification('$/gitlab/plugin/notification', {
      pluginId: SECURITY_VULNS_WEBVIEW_ID,
      type: 'updateDetails',
      payload: {
        vulnerability: vuln,
        filePath,
        timestamp,
      },
    });
  };
