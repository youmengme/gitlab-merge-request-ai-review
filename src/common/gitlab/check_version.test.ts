/* eslint-disable @typescript-eslint/no-dynamic-delete */
import * as vscode from 'vscode';
import { DO_NOT_SHOW_VERSION_WARNING } from '../constants';
import { log } from '../log';
import { createExtensionContext, gitlabPlatformForProject } from '../test_utils/entities';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { ApiRequest } from '../platform/web_ide';
import { setupVersionCheck, instanceUrlsWithShownWarnings } from './check_version';
import SpyInstance = jest.SpyInstance;

describe('Check GitLab instance version', () => {
  let context: vscode.ExtensionContext;
  let getVersionMock: SpyInstance<Promise<unknown>, [request: ApiRequest<unknown>], unknown>;
  let accountChangeListener: () => void;

  const platformManager = createFakePartial<GitLabPlatformManager>({
    onAccountChange: jest.fn().mockImplementation(listener => {
      accountChangeListener = listener;

      return {
        dispose: () => {},
      };
    }),
    getForActiveAccount: jest.fn().mockReturnValue(gitlabPlatformForProject),
  });

  beforeEach(async () => {
    context = createExtensionContext();

    getVersionMock = jest.spyOn(gitlabPlatformForProject, 'fetchFromApi').mockResolvedValue({});

    jest.spyOn(log, 'warn');
    vscode.window.showErrorMessage = jest.fn();
    await setupVersionCheck(platformManager, context);
  });

  it.each`
    version
    ${'16.6.0'}
    ${'16.7.3'}
    ${'16.7.0-pre'}
    ${'16.7.0-pre-1'}
    ${'16.12.4'}
    ${'17.0.0'}
    ${'abc16.6def'}
  `('does not show error notification when version is $version', async ({ version }) => {
    getVersionMock.mockResolvedValue({ version });
    await accountChangeListener();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it(`shows error message when version is below 16.1`, async () => {
    getVersionMock.mockResolvedValue({ version: '15.5.2' });
    await accountChangeListener();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('stores user preference for not showing the warning', async () => {
    delete instanceUrlsWithShownWarnings[gitlabPlatformForProject.account.instanceUrl];
    getVersionMock.mockResolvedValue({ version: '13.4.0' });

    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Do not show again');

    await accountChangeListener();
    expect(context.workspaceState.get(DO_NOT_SHOW_VERSION_WARNING)).toStrictEqual({
      [gitlabPlatformForProject.account.instanceUrl]: true,
    });
  });

  it('does not show warning if user said they do not want to see it', async () => {
    delete instanceUrlsWithShownWarnings[gitlabPlatformForProject.account.instanceUrl];
    getVersionMock.mockResolvedValue({ version: '13.4.0' });
    await context.globalState.update(DO_NOT_SHOW_VERSION_WARNING, {
      [gitlabPlatformForProject.account.instanceUrl]: true,
    });
    await accountChangeListener();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });
});
