import * as vscode from 'vscode';
import {
  createConfigurationChangeTrigger,
  createFakeWorkspaceConfiguration,
} from '../test_utils/vscode_fakes';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { createExtensionContext, gitlabPlatformForProject } from '../test_utils/entities';
import { waitForMs } from '../utils/wait_for_ms';
import { LanguageServerFeatureStateProvider } from '../language_server/language_server_feature_state_provider';
import {
  CodeSuggestionsStateManager,
  VisibleCodeSuggestionsState,
} from './code_suggestions_state_manager';
import { GitLabPlatformManagerForCodeSuggestionsImpl } from './gitlab_platform_manager_for_code_suggestions';
import { disabledForSessionPolicy } from './state_policy/disabled_for_session_policy';
import { MinimumGitLabVersionPolicy } from './state_policy/minimal_gitlab_version_policy';
import { StatePolicy } from './state_policy/state_policy';
import { createFakePolicy } from './state_policy/test_utils/create_fake_policy';
import { LicenseStatusPolicy } from './state_policy/license_status_policy';
import { ProjectDisabledPolicy } from './state_policy/project_disabled_policy';
import { MissingAccountPolicy } from './state_policy/missing_account_policy';
import { LanguagePolicy } from './state_policy/language_policy';
import { LanguageServerPolicy } from './state_policy/language_server_policy';

jest.mock('./gitlab_platform_manager_for_code_suggestions', () => ({
  GitLabPlatformManagerForCodeSuggestionsImpl: jest.fn(),
}));
jest.mock('./state_policy/license_status_policy');
jest.mock('./state_policy/project_disabled_policy.ts');
jest.mock('./state_policy/minimal_gitlab_version_policy.ts');
jest.mock('./state_policy/language_policy.ts');
jest.mock('./state_policy/language_server_policy.ts');
jest.mock('./state_policy/missing_account_policy.ts');
jest.useFakeTimers();

describe('Code suggestions state manager', () => {
  let triggerSettingsRefresh: () => void;
  let stateManager: CodeSuggestionsStateManager;
  let platformManager: GitLabPlatformManager;
  let suggestionsPlatformManager: GitLabPlatformManagerForCodeSuggestionsImpl;
  let licensePolicyMock: StatePolicy;
  let projectDisabledPolicyMock: StatePolicy;
  let minimalGitLabVersionPolicyMock: StatePolicy;
  let languagePolicyMock: StatePolicy;
  let languageServerPolicyMock: StatePolicy;
  let missingAccountPolicyMock: StatePolicy;
  let languageServerFeatureStateProvider: LanguageServerFeatureStateProvider;
  const context = createExtensionContext();
  let mockedPolicies: StatePolicy[] = [];

  beforeEach(async () => {
    platformManager = createFakePartial<GitLabPlatformManager>({});

    licensePolicyMock = createFakePolicy(
      jest.requireActual('./state_policy/license_status_policy').NO_LICENSE,
    );
    projectDisabledPolicyMock = createFakePolicy(
      jest.requireActual('./state_policy/project_disabled_policy').DISABLED_BY_PROJECT,
    );
    minimalGitLabVersionPolicyMock = createFakePolicy(
      jest.requireActual('./state_policy/minimal_gitlab_version_policy').UNSUPPORTED_GITLAB_VERSION,
    );
    languageServerPolicyMock = createFakePolicy(
      jest.requireActual('./state_policy/language_server_policy').UNSUPPORTED_LANGUAGE,
    );
    jest.mocked(LicenseStatusPolicy).mockReturnValue(licensePolicyMock as LicenseStatusPolicy);

    languagePolicyMock = createFakePolicy(
      jest.requireActual('./state_policy/language_policy').UNSUPPORTED_LANGUAGE,
    );

    missingAccountPolicyMock = createFakePolicy(
      jest.requireActual('./state_policy/missing_account_policy').NO_ACCOUNT,
    );

    jest
      .mocked(ProjectDisabledPolicy)
      .mockReturnValue(projectDisabledPolicyMock as ProjectDisabledPolicy);

    jest
      .mocked(MinimumGitLabVersionPolicy)
      .mockReturnValue(minimalGitLabVersionPolicyMock as MinimumGitLabVersionPolicy);

    jest
      .mocked(MissingAccountPolicy)
      .mockReturnValue(missingAccountPolicyMock as MissingAccountPolicy);

    jest.mocked(LanguagePolicy).mockReturnValue(languagePolicyMock as LanguagePolicy);

    jest
      .mocked(LanguageServerPolicy)
      .mockReturnValue(languageServerPolicyMock as LanguageServerPolicy);

    // these triggers need to be created BEFORE state manager adds listeners to VS Code API
    triggerSettingsRefresh = createConfigurationChangeTrigger();

    // ensure the suggestions are enabled in settings
    jest
      .mocked(vscode.workspace.getConfiguration)
      .mockReturnValue(createFakeWorkspaceConfiguration({ enabled: true }));

    // pretend there is a GitLab account
    suggestionsPlatformManager = createFakePartial<GitLabPlatformManagerForCodeSuggestionsImpl>({
      getGitLabPlatform: jest.fn().mockResolvedValue(gitlabPlatformForProject),
      dispose: () => {},
    });
    jest
      .mocked(GitLabPlatformManagerForCodeSuggestionsImpl)
      .mockReturnValue(suggestionsPlatformManager);

    mockedPolicies = [
      licensePolicyMock,
      projectDisabledPolicyMock,
      minimalGitLabVersionPolicyMock,
      languageServerPolicyMock,
      languagePolicyMock,
      minimalGitLabVersionPolicyMock,
      missingAccountPolicyMock,
    ];

    languageServerFeatureStateProvider = createFakePartial<LanguageServerFeatureStateProvider>({});
    stateManager = new CodeSuggestionsStateManager(platformManager, context);
    disabledForSessionPolicy.setTemporaryDisabled(false);
    await stateManager.init();
  });

  afterEach(() => {
    stateManager.dispose();
  });

  const disableViaSettings = () => {
    jest
      .mocked(vscode.workspace.getConfiguration)
      .mockReturnValue(createFakeWorkspaceConfiguration({ enabled: false }));
    triggerSettingsRefresh();
  };

  describe('constructor', () => {
    it('reads settings and sets the disabled in settings property', () => {
      jest
        .mocked(vscode.workspace.getConfiguration)
        .mockReturnValue(createFakeWorkspaceConfiguration({ enabled: false }));

      stateManager = new CodeSuggestionsStateManager(platformManager, context);

      expect(stateManager.getVisibleState()).toBe(
        VisibleCodeSuggestionsState.DISABLED_VIA_SETTINGS,
      );
    });
  });

  describe('init', () => {
    it('if a policy initialization fails, the init does not crash', async () => {
      licensePolicyMock.init = jest.fn().mockRejectedValue(new Error('init error'));

      stateManager = new CodeSuggestionsStateManager(
        platformManager,
        context,
        languageServerFeatureStateProvider,
      );

      await expect(stateManager.init()).resolves.not.toThrow();
    });

    it('the visible state is updated when policy initialization completes successfully', async () => {
      const visibleStateChangeListener = jest.fn();
      // Have a policy that returns early, and engages
      languagePolicyMock.init = jest.fn(async () => {
        languagePolicyMock.engaged = true;
      });
      // Have a policy that returns late
      licensePolicyMock.init = jest.fn(async () => {
        await waitForMs(100);
      });

      stateManager = new CodeSuggestionsStateManager(platformManager, context);
      stateManager.onDidChangeVisibleState(visibleStateChangeListener);
      const getVisibleStateSpy = jest.spyOn(stateManager, 'getVisibleState');

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      stateManager.init();
      await jest.advanceTimersByTimeAsync(100);

      expect(getVisibleStateSpy).toHaveBeenCalledTimes(1);
      expect(visibleStateChangeListener).toHaveBeenCalledWith(
        VisibleCodeSuggestionsState.UNSUPPORTED_LANGUAGE,
      );
    });
  });

  describe('visible state', () => {
    type StateMutation = () => void | Promise<void>;
    const mutationsFromLeastImportant: {
      mutation: StateMutation;
      expectedState: VisibleCodeSuggestionsState;
    }[] = [
      {
        mutation: () => stateManager.setLoading(true),
        expectedState: VisibleCodeSuggestionsState.LOADING,
      },
      {
        mutation: () => stateManager.setError(true),
        expectedState: VisibleCodeSuggestionsState.ERROR,
      },
      {
        mutation: () => disabledForSessionPolicy.setTemporaryDisabled(true),
        expectedState: VisibleCodeSuggestionsState.DISABLED_BY_USER,
      },
      {
        mutation: disableViaSettings,
        expectedState: VisibleCodeSuggestionsState.DISABLED_VIA_SETTINGS,
      },
    ];

    const supportedLanguagePolicy = {
      mutation: async () => {
        languagePolicyMock.engaged = true;
        jest.mocked(languagePolicyMock.onEngagedChange).mock.calls[0][0](true);
      },
      expectedState: VisibleCodeSuggestionsState.UNSUPPORTED_LANGUAGE,
    };

    const disabledByProjectPolicy = {
      mutation: () => {
        projectDisabledPolicyMock.engaged = true;
        jest.mocked(projectDisabledPolicyMock.onEngagedChange).mock.calls[0][0](true);
      },
      expectedState: VisibleCodeSuggestionsState.DISABLED_BY_PROJECT,
    };

    const licenseAvailablePolicy = {
      mutation: () => {
        licensePolicyMock.engaged = true;
        jest.mocked(licensePolicyMock.onEngagedChange).mock.calls[0][0](true);
      },
      expectedState: VisibleCodeSuggestionsState.NO_LICENSE,
    };

    const minGitlabVersionPolicy = {
      mutation: () => {
        minimalGitLabVersionPolicyMock.engaged = true;
        jest.mocked(minimalGitLabVersionPolicyMock.onEngagedChange).mock.calls[0][0](true);
      },
      expectedState: VisibleCodeSuggestionsState.UNSUPPORTED_GITLAB_VERSION,
    };

    const lsPolicy = {
      mutation: async () => {
        languageServerPolicyMock.engaged = true;
        jest.mocked(languageServerPolicyMock.onEngagedChange).mock.calls[0][0](true);
      },
      expectedState: VisibleCodeSuggestionsState.UNSUPPORTED_LANGUAGE,
    };

    const getMissingAccountPolicy = (isLsEnabled: boolean) => {
      return {
        mutation: async () => {
          missingAccountPolicyMock.engaged = true;
          // When LS is enabled the first (index 0) call triggers state manager state change
          // But when ths LS is disabled, AccountPolicy is dependency for the MinGitLabVersionPolicy
          // so its first engage change triggers emitting event on the combined policy
          // only the second one (index 1) triggers state manager state change
          const mockCallNumber = isLsEnabled ? 0 : 1;
          jest.mocked(missingAccountPolicyMock.onEngagedChange).mock.calls[mockCallNumber][0](true);
        },
        expectedState: VisibleCodeSuggestionsState.NO_ACCOUNT,
      };
    };

    describe.each`
      enabled  | msg
      ${true}  | ${'Language Server feature flag is enabled'}
      ${false} | ${'Language Server feature flag is disabled'}
    `('when $msg', ({ enabled }) => {
      let mutations: {
        mutation: StateMutation;
        expectedState: VisibleCodeSuggestionsState;
      }[];

      beforeEach(async () => {
        mockedPolicies.forEach(policy => {
          jest.mocked(policy).onEngagedChange.mockClear();
        });
        const accountPolicy = getMissingAccountPolicy(enabled);
        const clientOrLSPolicies = enabled
          ? [lsPolicy, accountPolicy]
          : [
              supportedLanguagePolicy,
              disabledByProjectPolicy,
              licenseAvailablePolicy,
              minGitlabVersionPolicy,
              accountPolicy,
            ];
        const availableFeatureStateManager = enabled
          ? languageServerFeatureStateProvider
          : undefined;

        mutations = [...mutationsFromLeastImportant];
        mutations.splice(2, 0, ...clientOrLSPolicies);
        stateManager = new CodeSuggestionsStateManager(
          platformManager,
          context,
          availableFeatureStateManager,
        );
        await stateManager.init();
      });

      it('more important state takes precedence over less important state', async () => {
        expect(stateManager.getVisibleState()).toBe(VisibleCodeSuggestionsState.READY);

        for (const scenario of mutations) {
          // we want to ensure that we execute the mutations in series
          // eslint-disable-next-line no-await-in-loop
          await scenario.mutation();
          expect(stateManager.getVisibleState()).toBe(scenario.expectedState);
        }
      });

      it('every state change triggers an event', async () => {
        const visibleStateChangeListener = jest.fn();
        stateManager.onDidChangeVisibleState(visibleStateChangeListener);
        for (const scenario of mutations) {
          visibleStateChangeListener.mockReset();
          // we want to ensure that we execute the mutations in series
          // eslint-disable-next-line no-await-in-loop
          await scenario.mutation();
          expect(visibleStateChangeListener).toHaveBeenCalledWith(scenario.expectedState);
        }
      });
    });
  });

  describe('Loading state', () => {
    it('handles parallel operations', () => {
      stateManager.setLoading(true);
      stateManager.setLoading(true);
      stateManager.setLoading(false);

      expect(stateManager.getVisibleState()).toBe(VisibleCodeSuggestionsState.LOADING);

      stateManager.setLoading(false);

      expect(stateManager.getVisibleState()).toBe(VisibleCodeSuggestionsState.READY);
    });

    it('can never enter negative loading', () => {
      stateManager.setLoading(true);
      stateManager.setLoading(false);
      stateManager.setLoading(false);
      stateManager.setLoading(false);

      expect(stateManager.getVisibleState()).toBe(VisibleCodeSuggestionsState.READY);

      stateManager.setLoading(true);

      expect(stateManager.getVisibleState()).toBe(VisibleCodeSuggestionsState.LOADING);
    });
  });

  describe('disabled & active', () => {
    let disabledByUserListener: jest.Func;

    beforeEach(async () => {
      disabledByUserListener = jest.fn();
      stateManager.onDidChangeDisabledByUserState(disabledByUserListener);
      await stateManager.init();
    });

    it('by default is not disabled and it is active', async () => {
      expect(stateManager.isDisabledByUser()).toBe(false);
      expect(stateManager.isActive()).toBe(true);
    });

    it('changes to disabled and inactive when disabling via settings', () => {
      disableViaSettings();

      expect(stateManager.isDisabledByUser()).toBe(true);
      expect(disabledByUserListener).toHaveBeenCalledWith(true);

      expect(stateManager.isActive()).toBe(false);
    });

    it('changes to disabled and inactive when disabling temporarily for session', () => {
      disabledForSessionPolicy.setTemporaryDisabled(true);

      expect(stateManager.isDisabledByUser()).toBe(true);
      expect(disabledByUserListener).toHaveBeenCalledWith(true);

      expect(stateManager.isActive()).toBe(false);
    });
  });
});
