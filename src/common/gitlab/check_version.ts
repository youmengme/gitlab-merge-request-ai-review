import * as vscode from 'vscode';
import { DO_NOT_SHOW_VERSION_WARNING, MINIMUM_VERSION } from '../constants';
import { log } from '../log';
import { ifVersionGte } from '../utils/if_version_gte';
import { GitLabPlatformForAccount, GitLabPlatformManager } from '../platform/gitlab_platform';
import { GetRequest, fetchFromApi } from '../platform/web_ide';

export type GitLabVersionResponse = {
  version: string;
  enterprise?: boolean;
};
export const versionRequest: GetRequest<GitLabVersionResponse> = {
  type: 'rest',
  method: 'GET',
  path: '/version',
};

export const instanceUrlsWithShownWarnings: Record<string, boolean> = {};

const DO_NOT_SHOW_AGAIN_TEXT = 'Do not show again';

type VersionValidationResult = { valid: true } | { valid: false; current: string; minimum: string };

export const validateGitLabVersion = async (fetcher: {
  fetchFromApi: fetchFromApi;
}): Promise<VersionValidationResult> => {
  const { version } = await fetcher.fetchFromApi(versionRequest);
  return ifVersionGte<VersionValidationResult>(
    version,
    MINIMUM_VERSION,
    () => ({ valid: true }),
    () => ({ valid: false, current: version, minimum: MINIMUM_VERSION }),
  );
};

// FIXME: Custom messages like these are deprecated in favour of the
// src/common/user_message.ts component
const checkVersion = async (
  platform: GitLabPlatformForAccount,
  context: vscode.ExtensionContext,
): Promise<void> => {
  const { instanceUrl } = platform.account;

  if (instanceUrl in instanceUrlsWithShownWarnings) return;

  const validationResult = await validateGitLabVersion(platform);
  if (!validationResult.valid) {
    const warningMessage = `
        This extension requires GitLab version ${validationResult.minimum} or later, but ${instanceUrl} is using ${validationResult.current}.
      `;

    log.warn(warningMessage);

    const versionWarningRecords = context.globalState.get<Record<string, boolean>>(
      DO_NOT_SHOW_VERSION_WARNING,
    );

    if (versionWarningRecords?.[instanceUrl]) return;

    instanceUrlsWithShownWarnings[instanceUrl] = true;

    const action = await vscode.window.showErrorMessage(warningMessage, DO_NOT_SHOW_AGAIN_TEXT);

    if (action === DO_NOT_SHOW_AGAIN_TEXT)
      await context.workspaceState.update(DO_NOT_SHOW_VERSION_WARNING, {
        ...versionWarningRecords,
        [instanceUrl]: true,
      });
  }
};

export const setupVersionCheck = (
  platformManager: GitLabPlatformManager,
  context: vscode.ExtensionContext,
) => {
  const subscriptions: vscode.Disposable[] = [];
  subscriptions.push(
    platformManager.onAccountChange(async () => {
      const platform = await platformManager.getForActiveAccount(false);
      if (!platform) return;
      await checkVersion(platform, context);
    }),
  );

  return {
    dispose: () => subscriptions.forEach(s => s.dispose()),
  };
};
