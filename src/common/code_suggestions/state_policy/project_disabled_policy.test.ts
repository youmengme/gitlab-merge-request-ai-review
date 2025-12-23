import * as vscode from 'vscode';
import { GitLabPlatformForProject } from '../../platform/gitlab_platform';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { GitLabPlatformManagerForCodeSuggestions } from '../gitlab_platform_manager_for_code_suggestions';
import { CS_DISABLED_PROJECT_CHECK_INTERVAL } from '../constants';
import { getProjectCodeSuggestionsEnabled } from '../api/get_project_code_suggestions_enabled';
import { createFakeFetchFromApi } from '../../test_utils/create_fake_fetch_from_api';
import {
  extensionConfigurationService,
  ExtensionConfiguration,
} from '../../utils/extension_configuration_service';
import { ProjectDisabledPolicy } from './project_disabled_policy';

jest.mock('../../utils/extension_configuration');

const executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand');

describe('ProjectDisabledPolicy', () => {
  let manager: GitLabPlatformManagerForCodeSuggestions;
  let policy: ProjectDisabledPolicy;
  let platform: GitLabPlatformForProject | undefined;
  const te = createFakePartial<vscode.TextEditor>({ document: { languageId: 'javascript' } });

  function stubDuoEnabled(enabled: boolean) {
    if (platform) {
      platform.fetchFromApi = jest.fn(
        createFakeFetchFromApi({
          request: getProjectCodeSuggestionsEnabled('test'),
          response: { project: { duoFeaturesEnabled: enabled } },
        }),
      );
    }
  }

  beforeEach(() => {
    platform = createFakePartial<GitLabPlatformForProject>({
      project: { namespaceWithPath: 'test' },
    });

    stubDuoEnabled(false);

    manager = createFakePartial<GitLabPlatformManagerForCodeSuggestions>({
      getGitLabPlatform: async () => platform,
      onAccountChange: jest.fn(),
    });
    policy = new ProjectDisabledPolicy(manager);
    vscode.window.activeTextEditor = te;
  });

  describe("when license check can't be performed", () => {
    describe.each`
      enabledWithoutGitLabProject | shouldBeEngaged
      ${true}                     | ${false}
      ${false}                    | ${true}
    `(
      'engaged is $shouldBeEngaged when the enabledWithoutGitLabProject setting is $enabledWithoutGitLabProject',
      ({ enabledWithoutGitLabProject, shouldBeEngaged }) => {
        beforeEach(() => {
          jest.spyOn(extensionConfigurationService, 'getConfiguration').mockReturnValue(
            createFakePartial<ExtensionConfiguration>({
              duo: { enabledWithoutGitLabProject },
            }),
          );
        });

        it('is not engaged when platform is missing', async () => {
          platform = undefined;

          await policy.init();

          expect(policy.engaged).toBe(shouldBeEngaged);
          expect(executeCommandSpy).toHaveBeenCalledTimes(1);
          expect(executeCommandSpy).toHaveBeenCalledWith(
            'setContext',
            'gitlab:chatAvailableForProject',
            !shouldBeEngaged,
          );
        });

        it('is not engaged when there is no active text editor', async () => {
          vscode.window.activeTextEditor = undefined;

          await policy.init();

          expect(policy.engaged).toBe(shouldBeEngaged);
          expect(executeCommandSpy).toHaveBeenCalledTimes(1);
          expect(executeCommandSpy).toHaveBeenCalledWith(
            'setContext',
            'gitlab:chatAvailableForProject',
            !shouldBeEngaged,
          );
        });

        it('handles GraphQL errors gracefully', async () => {
          if (platform) {
            platform.fetchFromApi = jest.fn(() => {
              throw new Error('GraphQL error');
            });
          }

          await policy.init();

          expect(policy.engaged).toBe(shouldBeEngaged);

          expect(executeCommandSpy).toHaveBeenCalledTimes(1);
          expect(executeCommandSpy).toHaveBeenLastCalledWith(
            'setContext',
            'gitlab:chatAvailableForProject',
            !shouldBeEngaged,
          );
        });
      },
    );
  });

  it('is engaged if the API responded false', async () => {
    await policy.init();

    expect(policy.engaged).toBe(true);
    expect(executeCommandSpy).toHaveBeenCalledTimes(1);
    expect(executeCommandSpy).toHaveBeenCalledWith(
      'setContext',
      'gitlab:chatAvailableForProject',
      false,
    );
  });

  it('will cache the disabled status', async () => {
    await policy.init();

    stubDuoEnabled(true);

    await policy.init();

    // this would have been false without caching
    expect(policy.engaged).toBe(true);

    // API was not called the second time
    expect(platform?.fetchFromApi).toHaveBeenCalledTimes(0);

    expect(executeCommandSpy).toHaveBeenCalledTimes(2);
    expect(executeCommandSpy).toHaveBeenLastCalledWith(
      'setContext',
      'gitlab:chatAvailableForProject',
      false,
    );
  });

  it('fires event when changed', async () => {
    const listener = jest.fn();
    policy.onEngagedChange(listener);

    stubDuoEnabled(false);

    await policy.init();

    expect(listener).toHaveBeenCalledWith(true);
    expect(executeCommandSpy).toHaveBeenCalledTimes(1);
    expect(executeCommandSpy).toHaveBeenLastCalledWith(
      'setContext',
      'gitlab:chatAvailableForProject',
      false,
    );
  });

  it('listens on platform changes', async () => {
    jest.useFakeTimers();

    await policy.init();

    stubDuoEnabled(true);

    // make sure the cache won't give us old value
    jest.advanceTimersByTime(CS_DISABLED_PROJECT_CHECK_INTERVAL + 1);

    const listener = jest.fn();
    policy.onEngagedChange(listener);

    // simulate platform change
    await jest.mocked(manager.onAccountChange).mock.calls[0][0](platform);

    expect(listener).toHaveBeenCalledWith(false);

    expect(executeCommandSpy).toHaveBeenCalledTimes(2);
    expect(executeCommandSpy).toHaveBeenLastCalledWith(
      'setContext',
      'gitlab:chatAvailableForProject',
      true,
    );
  });

  it('listens on text editor changes', async () => {
    jest.useFakeTimers();

    await policy.init();

    stubDuoEnabled(true);

    // make sure the cache won't give us old value
    jest.advanceTimersByTime(CS_DISABLED_PROJECT_CHECK_INTERVAL + 1);

    const listener = jest.fn();
    policy.onEngagedChange(listener);

    // simulate text editor change change
    await jest.mocked(vscode.window.onDidChangeActiveTextEditor).mock.calls[0][0](te);

    expect(listener).toHaveBeenCalledWith(false);

    expect(executeCommandSpy).toHaveBeenCalledTimes(2);
    expect(executeCommandSpy).toHaveBeenLastCalledWith(
      'setContext',
      'gitlab:chatAvailableForProject',
      true,
    );
  });
});
