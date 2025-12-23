import {
  AGENT_PLATFORM,
  AGENTIC_CHAT,
  AUTHENTICATION,
  CHAT,
  CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE,
  CHAT_NO_LICENSE,
  CHAT_TERMINAL_CONTEXT,
  CODE_SUGGESTIONS,
  FLOWS,
  FeatureState,
  FeatureStateCheck,
} from '@gitlab-org/gitlab-lsp';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  AllFeaturesState,
  LanguageServerFeatureStateProviderImpl,
} from './language_server_feature_state_provider';

describe('LanguageServerFeatureStateProvider', () => {
  let languageServerFeatureStateProvider: LanguageServerFeatureStateProviderImpl;
  let mockStates: FeatureState[];
  let mockStateProviderResponse: AllFeaturesState;

  beforeEach(() => {
    languageServerFeatureStateProvider = new LanguageServerFeatureStateProviderImpl();

    mockStates = [
      {
        featureId: CHAT,
        engagedChecks: [
          createFakePartial<FeatureStateCheck<typeof CHAT_NO_LICENSE>>({
            details: 'No chat license.',
            engaged: true,
          }),
        ],
        allChecks: [],
      },
      {
        featureId: CHAT_TERMINAL_CONTEXT,
        engagedChecks: [
          createFakePartial<FeatureStateCheck<typeof CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE>>({
            details: 'Chat terminal context not enabled.',
            engaged: true,
          }),
        ],
        allChecks: [],
      },
    ];

    mockStateProviderResponse = createFakePartial<AllFeaturesState>({
      [AUTHENTICATION]: createFakePartial<FeatureState>({
        featureId: AUTHENTICATION,
        engagedChecks: [],
        allChecks: [],
      }),
      [CHAT]: createFakePartial<FeatureState>({
        featureId: CHAT,
        engagedChecks: [
          createFakePartial<FeatureStateCheck<typeof CHAT_NO_LICENSE>>({
            details: 'No chat license.',
            engaged: true,
          }),
        ],
        allChecks: [],
      }),
      [CODE_SUGGESTIONS]: createFakePartial<FeatureState>({
        featureId: CODE_SUGGESTIONS,
        engagedChecks: [],
        allChecks: [],
      }),
      [CHAT_TERMINAL_CONTEXT]: createFakePartial<FeatureState>({
        featureId: CHAT_TERMINAL_CONTEXT,
        engagedChecks: [
          createFakePartial<FeatureStateCheck<typeof CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE>>({
            details: 'Chat terminal context not enabled.',
            engaged: true,
          }),
        ],
        allChecks: [],
      }),
      [AGENTIC_CHAT]: createFakePartial<FeatureState>({
        featureId: AGENTIC_CHAT,
        engagedChecks: [],
        allChecks: [],
      }),
      [AGENT_PLATFORM]: createFakePartial<FeatureState>({
        featureId: AGENT_PLATFORM,
        engagedChecks: [],
        allChecks: [],
      }),
      [FLOWS]: createFakePartial<FeatureState>({
        featureId: FLOWS,
        engagedChecks: [],
        allChecks: [],
      }),
    });
  });

  it('should update state and emit an event "setStates" is called', () => {
    const listener = jest.fn();

    languageServerFeatureStateProvider.onChange(listener);

    languageServerFeatureStateProvider.setStates(mockStates);

    expect(listener).toHaveBeenCalledWith(mockStateProviderResponse);
    expect(languageServerFeatureStateProvider.state.chat).toEqual(mockStateProviderResponse.chat);
  });
});
