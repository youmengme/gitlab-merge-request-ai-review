import * as vscode from 'vscode';
import { log } from '../../log';
import { createExtensionContext, gitlabPlatformForProject } from '../../test_utils/entities';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import {
  DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING,
  MINIMUM_CODE_SUGGESTIONS_VERSION,
} from '../../constants';
import { createConfigurationChangeTrigger } from '../../test_utils/vscode_fakes';
import { createFakeFetchFromApi } from '../../test_utils/create_fake_fetch_from_api';
import { StatePolicy } from './state_policy';
import {
  MinimumGitLabVersionPolicy,
  UNSUPPORTED_GITLAB_VERSION,
  versionRequest,
} from './minimal_gitlab_version_policy';

describe('MinimumGitLabVersionPolicy', () => {
  let policy: MinimumGitLabVersionPolicy;
  let context: vscode.ExtensionContext;
  const userDisabledPolicy = createFakePartial<StatePolicy>({
    engaged: false,
  });

  const triggerSettingsRefresh = createConfigurationChangeTrigger();

  const suggestionsPlatformManager = createFakePartial<GitLabPlatformManagerForCodeSuggestions>({
    getGitLabPlatform: jest.fn().mockResolvedValue(gitlabPlatformForProject),
    onAccountChange: jest.fn(),
  });

  beforeEach(async () => {
    context = createExtensionContext();
    gitlabPlatformForProject.fetchFromApi = createFakeFetchFromApi({
      request: versionRequest,
      response: { version: MINIMUM_CODE_SUGGESTIONS_VERSION },
    });

    jest.spyOn(log, 'warn');
    vscode.window.showWarningMessage = jest.fn();

    policy = new MinimumGitLabVersionPolicy(
      suggestionsPlatformManager,
      context,
      userDisabledPolicy,
    );
  });

  it('is not engaged when the code suggestions are disabled by user ', async () => {
    userDisabledPolicy.engaged = true;
    await triggerSettingsRefresh();
    expect(suggestionsPlatformManager.getGitLabPlatform).not.toHaveBeenCalled();
    expect(policy.engaged).toBe(false);
  });

  describe('when code suggestions are not disabled by user', () => {
    beforeEach(() => {
      userDisabledPolicy.engaged = false;
    });

    it.each`
      version
      ${'16.8.0'}
      ${'16.9.3'}
      ${'16.9.0-pre'}
      ${'16.9.0-pre-1'}
      ${'16.12.4'}
      ${'20.0.0'}
      ${'abc16.8def'}
    `(
      'is not engaged and does not show error notification when version is $version',
      async ({ version }) => {
        gitlabPlatformForProject.fetchFromApi = createFakeFetchFromApi({
          request: versionRequest,
          response: { version },
        });
        await triggerSettingsRefresh();
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(policy.engaged).toBe(false);
      },
    );

    it(`is engaged and shows error notification when version is below 16.8`, async () => {
      gitlabPlatformForProject.fetchFromApi = createFakeFetchFromApi({
        request: versionRequest,
        response: { version: '16.7.1' },
      });

      await triggerSettingsRefresh();
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(policy.engaged).toBe(true);
      expect(policy.state).toBe(UNSUPPORTED_GITLAB_VERSION);
    });

    it('stores user preference for not showing the warning', async () => {
      gitlabPlatformForProject.fetchFromApi = createFakeFetchFromApi({
        request: versionRequest,
        response: { version: '16.7.1' },
      });
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Do not show again');

      await triggerSettingsRefresh();

      expect(context.globalState.get(DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING)).toStrictEqual({
        [gitlabPlatformForProject.account.instanceUrl]: true,
      });
    });

    it('does not show the warning if user said they do not want to see it but disabled code suggestions', async () => {
      gitlabPlatformForProject.fetchFromApi = createFakeFetchFromApi({
        request: versionRequest,
        response: { version: '16.7.1' },
      });
      await context.globalState.update(DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING, {
        [gitlabPlatformForProject.account.instanceUrl]: true,
      });

      await triggerSettingsRefresh();

      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
      expect(policy.engaged).toBe(true);
    });

    it('fires onEngagedChange event when the engaged changes', async () => {
      const listener = jest.fn();
      policy.onEngagedChange(listener);

      expect(listener).not.toHaveBeenCalled();

      gitlabPlatformForProject.fetchFromApi = createFakeFetchFromApi({
        request: versionRequest,
        response: { version: '16.7.1' },
      });

      await triggerSettingsRefresh();

      expect(listener).toHaveBeenCalledWith(true);
      listener.mockReset();

      gitlabPlatformForProject.fetchFromApi = createFakeFetchFromApi({
        request: versionRequest,
        response: { version: '16.8.1' },
      });

      await triggerSettingsRefresh();

      expect(listener).toHaveBeenCalledWith(false);
    });
  });
});
