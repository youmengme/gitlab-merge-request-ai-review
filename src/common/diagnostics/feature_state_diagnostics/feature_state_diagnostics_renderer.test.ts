import {
  AGENT_PLATFORM,
  AGENTIC_CHAT,
  AUTHENTICATION,
  CHAT,
  CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE,
  CHAT_TERMINAL_CONTEXT,
  CODE_SUGGESTIONS,
  FLOWS,
  StateCheckId,
} from '@gitlab-org/gitlab-lsp';
import { AllFeaturesState } from '../../language_server/language_server_feature_state_provider';
import { FeatureStateDiagnosticsRenderer } from './feature_state_diagnostics_renderer';

const createMockState = (engaged: boolean): AllFeaturesState => {
  const createCheck = (checkId: StateCheckId, details?: string) => ({
    checkId,
    details,
    engaged,
  });

  return {
    [AUTHENTICATION]: { featureId: AUTHENTICATION, engagedChecks: [], allChecks: [] },
    [CHAT]: {
      featureId: CHAT,
      engagedChecks: engaged
        ? [
            createCheck('authentication-required', 'Authentication required.'),
            createCheck('chat-disabled-by-user', 'Duo Chat manually disabled.'),
            createCheck(
              'chat-no-license',
              'A GitLab Duo license is required to use this feature. Contact your GitLab administrator to request access.',
            ),
            createCheck('duo-disabled-for-project', 'Duo features are disabled for this project'),
          ]
        : [],
      allChecks: [
        createCheck('authentication-required', 'Authentication required.'),
        createCheck('chat-disabled-by-user', 'Duo Chat manually disabled.'),
        createCheck(
          'chat-no-license',
          'A GitLab Duo license is required to use this feature. Contact your GitLab administrator to request access.',
        ),
        createCheck('duo-disabled-for-project', 'Duo features are disabled for this project'),
      ],
    },
    [CHAT_TERMINAL_CONTEXT]: {
      featureId: CHAT_TERMINAL_CONTEXT,
      engagedChecks: engaged
        ? [
            createCheck(
              CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE,
              'Chat terminal context not enabled for user.',
            ),
          ]
        : [],
      allChecks: [
        createCheck(
          CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE,
          'Chat terminal context not enabled for user.',
        ),
      ],
    },
    [CODE_SUGGESTIONS]: {
      featureId: CODE_SUGGESTIONS,
      engagedChecks: engaged
        ? [
            createCheck('authentication-required', 'Authentication required.'),
            createCheck('code-suggestions-disabled-by-user', 'Code Suggestions manually disabled.'),
            createCheck('code-suggestions-api-error', 'Error requesting suggestions from the API.'),
            createCheck('code-suggestions-unsupported-gitlab-version'),
            createCheck(
              'code-suggestions-no-license',
              'A GitLab Duo license is required to use this feature. Contact your GitLab administrator to request access.',
            ),
            createCheck('duo-disabled-for-project', 'Duo features are disabled for this project'),
            createCheck(
              'code-suggestions-document-unsupported-language',
              'Code suggestions are not supported for this language',
            ),
          ]
        : [],
      allChecks: [
        createCheck('authentication-required', 'Authentication required.'),
        createCheck('code-suggestions-disabled-by-user', 'Code Suggestions manually disabled.'),
        createCheck('code-suggestions-api-error', 'Error requesting suggestions from the API.'),
        createCheck('code-suggestions-unsupported-gitlab-version'),
        createCheck(
          'code-suggestions-no-license',
          'A GitLab Duo license is required to use this feature. Contact your GitLab administrator to request access.',
        ),
        createCheck('duo-disabled-for-project', 'Duo features are disabled for this project'),
        createCheck(
          'code-suggestions-document-unsupported-language',
          'Code suggestions are not supported for this language',
        ),
      ],
    },
    [AGENTIC_CHAT]: {
      featureId: AGENTIC_CHAT,
      engagedChecks: engaged
        ? [
            createCheck('authentication-required', 'Authentication required.'),
            createCheck('agentic-chat-no-support', 'Not supported'),
          ]
        : [],
      allChecks: [
        createCheck('authentication-required', 'Authentication required.'),
        createCheck('agentic-chat-no-support', 'Not supported'),
      ],
    },
    [AGENT_PLATFORM]: {
      featureId: AGENT_PLATFORM,
      engagedChecks: engaged
        ? [
            createCheck('authentication-required', 'Authentication required.'),
            createCheck('agentic-chat-no-support', 'Not supported'),
          ]
        : [],
      allChecks: [
        createCheck('authentication-required', 'Authentication required.'),
        createCheck('agentic-chat-no-support', 'Not supported'),
      ],
    },
    [FLOWS]: {
      featureId: FLOWS,
      engagedChecks: engaged
        ? [createCheck('authentication-required', 'Authentication required.')]
        : [],
      allChecks: [createCheck('authentication-required', 'Authentication required.')],
    },
  };
};

describe('FeatureStateDiagnosticsRenderer', () => {
  const testCases = [
    {
      name: 'when checks are not engaged',
      engaged: false,
      expectedStatus: 'On',
      checkStatusPre: '[x]',
      checkStatusAppend: '(true)',
    },
    {
      name: 'when checks are engaged',
      engaged: true,
      expectedStatus: 'Off',
      checkStatusPre: '[ ]',
      checkStatusAppend: '(false)',
    },
  ];

  test.each(testCases)(
    '$name',
    ({ engaged, expectedStatus, checkStatusPre, checkStatusAppend }) => {
      const renderer = new FeatureStateDiagnosticsRenderer();
      const mockState = createMockState(engaged);
      const result = renderer.render([mockState]);

      const expectedCodeSuggestions =
        `- ${checkStatusPre} User is authenticated ${checkStatusAppend}\n` +
        `- ${checkStatusPre} Code Suggestions are enabled in settings ${checkStatusAppend}\n` +
        `- ${checkStatusPre} Code Suggestions API connection is working ${checkStatusAppend}\n` +
        `- ${checkStatusPre} The GitLab instance version supports Code Suggestions ${checkStatusAppend}\n` +
        `- ${checkStatusPre} Valid GitLab license ${checkStatusAppend}\n` +
        `- ${checkStatusPre} GitLab Duo is enabled for the open project(s) ${checkStatusAppend}`;

      const expectedDuo =
        `- ${checkStatusPre} User is authenticated ${checkStatusAppend}\n` +
        `- ${checkStatusPre} Chat is enabled in settings ${checkStatusAppend}\n` +
        `- ${checkStatusPre} Valid GitLab license ${checkStatusAppend}\n` +
        `- ${checkStatusPre} GitLab Duo is enabled for the open project(s) ${checkStatusAppend}`;

      const expectedTerminalContext = `- ${checkStatusPre} Include terminal context is enabled for user ${checkStatusAppend}`;

      const expectedAgenticChat = `- ${checkStatusPre} User is authenticated ${checkStatusAppend}
- ${checkStatusPre} Agentic Chat is supported for the current project ${checkStatusAppend}`;

      expect(result[0].title).toBe(`GitLab Duo Code Suggestions (${expectedStatus})`);
      expect(result[0].content).toBe(expectedCodeSuggestions);
      expect(result[1].title).toBe(`GitLab Duo Chat (${expectedStatus})`);
      expect(result[1].content).toBe(expectedDuo);
      expect(result[2].title).toBe(`Terminal Context (${expectedStatus})`);
      expect(result[2].content).toBe(expectedTerminalContext);
      expect(result[3].title).toBe(`GitLab Agentic Chat (${expectedStatus})`);
      expect(result[3].content).toBe(expectedAgenticChat);
    },
  );

  it('should return an empty array when language server is disabled', () => {
    const renderer = new FeatureStateDiagnosticsRenderer();
    const mockEmptyState: AllFeaturesState = {
      [AGENT_PLATFORM]: { featureId: AGENT_PLATFORM, engagedChecks: [], allChecks: [] },
      [AUTHENTICATION]: { featureId: AUTHENTICATION, engagedChecks: [], allChecks: [] },
      [CHAT]: { featureId: CHAT, engagedChecks: [], allChecks: [] },
      [CHAT_TERMINAL_CONTEXT]: {
        featureId: CHAT_TERMINAL_CONTEXT,
        engagedChecks: [],
        allChecks: [],
      },
      [CODE_SUGGESTIONS]: { featureId: CODE_SUGGESTIONS, engagedChecks: [], allChecks: [] },
      [AGENTIC_CHAT]: { featureId: AGENTIC_CHAT, engagedChecks: [], allChecks: [] },
      [FLOWS]: { featureId: FLOWS, engagedChecks: [], allChecks: [] },
    };
    const result = renderer.render([mockEmptyState]);
    expect(result).toEqual([]);
  });
});
