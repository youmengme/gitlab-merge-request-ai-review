import vscode from 'vscode';
import {
  CODE_SUGGESTIONS,
  UNSUPPORTED_GITLAB_VERSION,
  SUGGESTIONS_DISABLED_BY_USER,
} from '@gitlab-org/gitlab-lsp';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { createExtensionContext } from '../../test_utils/entities';
import { DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING } from '../../constants';
import {
  AllFeaturesState,
  LanguageServerFeatureStateProvider,
} from '../../language_server/language_server_feature_state_provider';
import { LanguageServerPolicy, UNSUPPORTED_LANGUAGE } from './language_server_policy';

describe('LanguageServerPolicy', () => {
  let policy: LanguageServerPolicy;
  let context: vscode.ExtensionContext;
  const mockOnChange = jest.fn();
  const mockOnChangeDisposable = jest.fn();
  const languageServerFeatureStateProvider = createFakePartial<LanguageServerFeatureStateProvider>({
    onChange: mockOnChange,
  });
  let triggerOnChange: (params: AllFeaturesState) => void;
  const engageListener = jest.fn();

  const engagedPolicyParams = createFakePartial<AllFeaturesState>({
    [CODE_SUGGESTIONS]: {
      featureId: CODE_SUGGESTIONS,
      engagedChecks: [
        {
          checkId: UNSUPPORTED_LANGUAGE,
          details: 'test',
          engaged: true,
        },
      ],
      allChecks: [
        {
          checkId: UNSUPPORTED_LANGUAGE,
          details: 'test',
          engaged: true,
        },
      ],
    },
  });

  const anotherEngagedPolicyParams = createFakePartial<AllFeaturesState>({
    [CODE_SUGGESTIONS]: {
      featureId: CODE_SUGGESTIONS,
      engagedChecks: [
        {
          checkId: SUGGESTIONS_DISABLED_BY_USER,
          details: 'test',
          engaged: true,
        },
      ],
      allChecks: [
        {
          checkId: SUGGESTIONS_DISABLED_BY_USER,
          details: 'test',
          engaged: true,
        },
        {
          checkId: UNSUPPORTED_LANGUAGE,
          details: 'test',
          engaged: false,
        },
      ],
    },
  });

  const notEngagedParams = createFakePartial<AllFeaturesState>({
    [CODE_SUGGESTIONS]: {
      featureId: CODE_SUGGESTIONS,
      engagedChecks: [],
      allChecks: [
        {
          checkId: UNSUPPORTED_LANGUAGE,
          details: 'test',
          engaged: false,
        },
      ],
    },
  });

  beforeEach(async () => {
    context = createExtensionContext();
    jest.resetAllMocks();
    policy = new LanguageServerPolicy(languageServerFeatureStateProvider, context);
    mockOnChange.mockImplementation(_callback => {
      triggerOnChange = _callback;
      return { dispose: mockOnChangeDisposable };
    });
    await policy.init();

    policy.onEngagedChange(engageListener);
  });

  it('is engaged when LS notifies about the code suggestions state change with NON-empty state', () => {
    triggerOnChange(engagedPolicyParams);

    expect(policy.engaged).toBe(true);
    expect(policy.state).toBe(UNSUPPORTED_LANGUAGE);
  });

  it('is NOT engaged when LS notifies about the code suggestions state with an empty state', () => {
    const params = createFakePartial<AllFeaturesState>({});
    triggerOnChange(params);

    expect(policy.engaged).toBe(false);
    expect(policy.state).toBe(undefined);
  });

  it('fires onEngagedChange after updating the policy', () => {
    engageListener.mockImplementation(() => {
      expect(policy.engaged).toBe(true);
      expect(policy.state).toBe(UNSUPPORTED_LANGUAGE);
    });

    expect(engageListener).not.toHaveBeenCalled();

    triggerOnChange(engagedPolicyParams);

    expect(engageListener).toHaveBeenCalledTimes(1);
  });

  it('fires onEngagedChange only when state changes', () => {
    triggerOnChange(notEngagedParams);
    triggerOnChange(notEngagedParams);
    triggerOnChange(engagedPolicyParams); // triggers change -> true
    triggerOnChange(engagedPolicyParams);
    triggerOnChange(anotherEngagedPolicyParams); // triggers change -> true
    triggerOnChange(notEngagedParams); // triggers change -> false

    expect(engageListener.mock.calls).toEqual([[true], [true], [false]]);
  });

  it('disposes the client notification disposable', () => {
    expect(mockOnChangeDisposable).not.toHaveBeenCalled();

    policy.dispose();

    expect(mockOnChangeDisposable).toHaveBeenCalledTimes(1);
  });

  describe('Special state handling', () => {
    describe(`${UNSUPPORTED_GITLAB_VERSION}`, () => {
      const baseUrl = 'http://test.com';
      const version = '16.7';

      const engagedMinGitLabVersionCheckParams = createFakePartial<AllFeaturesState>({
        [CODE_SUGGESTIONS]: {
          featureId: CODE_SUGGESTIONS,
          engagedChecks: [
            {
              checkId: UNSUPPORTED_GITLAB_VERSION,
              context: {
                baseUrl,
                version,
              },
              engaged: true,
            },
          ],
          allChecks: [
            {
              checkId: UNSUPPORTED_GITLAB_VERSION,
              context: {
                baseUrl,
                version,
              },
              engaged: true,
            },
          ],
        },
      });

      it(`shows error notification when version is below 16.8`, async () => {
        await triggerOnChange(engagedMinGitLabVersionCheckParams);
        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      });

      it('stores user preference for not showing the warning', async () => {
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Do not show again');

        await triggerOnChange(engagedMinGitLabVersionCheckParams);

        expect(context.globalState.get(DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING)).toStrictEqual(
          {
            [baseUrl]: true,
          },
        );
      });

      it('does not show the warning if user said they do not want to see it but disabled code suggestions', async () => {
        await context.globalState.update(DO_NOT_SHOW_CODE_SUGGESTIONS_VERSION_WARNING, {
          [baseUrl]: true,
        });

        await triggerOnChange(engagedMinGitLabVersionCheckParams);

        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
      });
    });
  });
});
