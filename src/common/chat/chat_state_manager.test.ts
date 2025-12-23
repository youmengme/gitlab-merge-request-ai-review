import {
  CHAT,
  CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE,
  CHAT_NO_LICENSE,
  CHAT_TERMINAL_CONTEXT,
  CODE_SUGGESTIONS,
  DUO_DISABLED_FOR_PROJECT,
} from '@gitlab-org/gitlab-lsp';
import vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  AllFeaturesState,
  LanguageServerFeatureStateProvider,
} from '../language_server/language_server_feature_state_provider';
import { ChatState, ChatStateManager } from './chat_state_manager';

const waitForPromises = () => new Promise(process.nextTick);
describe('Chat State Manager', () => {
  let chatStateManager: ChatStateManager;

  let triggerOnChange: (params: AllFeaturesState) => void;
  const mockOnChange = jest.fn();
  const mockOnChangeDisposable = jest.fn();
  const languageServerFeatureStateProvider = createFakePartial<LanguageServerFeatureStateProvider>({
    onChange: mockOnChange,
  });

  beforeEach(async () => {
    mockOnChange.mockImplementation(_callback => {
      triggerOnChange = _callback;
      return { dispose: mockOnChangeDisposable };
    });
    chatStateManager = new ChatStateManager(languageServerFeatureStateProvider);
  });

  describe('Chat License check', () => {
    it('should run command to disable chat when user has no Duo Chat License', async () => {
      const chatDisabledParams = createFakePartial<AllFeaturesState>({
        [CHAT]: {
          featureId: CHAT,
          engagedChecks: [
            {
              checkId: CHAT_NO_LICENSE,
            },
          ],
          allChecks: [],
        },
      });

      triggerOnChange(chatDisabledParams);
      await waitForPromises();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatAvailable',
        false,
      );
    });

    it('should run command to enable chat when Duo Chat license check is not engaged', async () => {
      const chatEnabledParams = createFakePartial<AllFeaturesState>({
        [CHAT]: {
          featureId: CHAT,
          engagedChecks: [],
          allChecks: [],
        },
      });

      triggerOnChange(chatEnabledParams);
      await waitForPromises();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatAvailable',
        true,
      );
    });
  });

  describe('Duo enabled for project check', () => {
    it('should run command to disable chat when Duo is disabled for project', async () => {
      const chatDisabledParams = createFakePartial<AllFeaturesState>({
        [CHAT]: {
          featureId: CHAT,
          engagedChecks: [
            {
              checkId: DUO_DISABLED_FOR_PROJECT,
              details: 'Duo not enabled for project.',
              engaged: true,
            },
          ],
          allChecks: [],
        },
      });

      triggerOnChange(chatDisabledParams);
      await waitForPromises();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatAvailableForProject',
        false,
      );
    });

    it('should run command to enable chat when Duo enabled for project', async () => {
      const chatEnabledParams = createFakePartial<AllFeaturesState>({
        [CHAT]: {
          featureId: CHAT,
          engagedChecks: [],
          allChecks: [],
        },
      });

      triggerOnChange(chatEnabledParams);
      await waitForPromises();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatAvailableForProject',
        true,
      );
    });
  });

  describe('Chat terminal context check', () => {
    it('should set terminal context available when terminal context has no engaged checks', async () => {
      const params = createFakePartial<AllFeaturesState>({
        [CHAT]: {
          featureId: CHAT,
          engagedChecks: [],
          allChecks: [],
        },
        [CHAT_TERMINAL_CONTEXT]: {
          featureId: CHAT_TERMINAL_CONTEXT,
          engagedChecks: [],
          allChecks: [{ checkId: CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE, engaged: false }],
        },
      });

      triggerOnChange(params);
      await waitForPromises();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatTerminalContextAvailable',
        true,
      );
    });

    it('should set terminal context unavailable when terminal context has engaged checks', async () => {
      const params = createFakePartial<AllFeaturesState>({
        [CHAT]: {
          featureId: CHAT,
          engagedChecks: [],
          allChecks: [],
        },
        [CHAT_TERMINAL_CONTEXT]: {
          featureId: CHAT_TERMINAL_CONTEXT,
          engagedChecks: [{ checkId: CHAT_INCLUDE_TERMINAL_CONTEXT_UNAVAILABLE, engaged: true }],
          allChecks: [],
        },
      });

      triggerOnChange(params);
      await waitForPromises();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatTerminalContextAvailable',
        false,
      );
    });
  });

  it('should call "onChange" listener with the new state when state is updated', async () => {
    const listener = jest.fn();

    const chatFeatureState = {
      featureId: CHAT,
      engagedChecks: [],
      allChecks: [],
    };

    const codeSuggestionsFeatureState = {
      featureId: CODE_SUGGESTIONS,
      engagedChecks: [],
      allChecks: [],
    };

    chatStateManager.onChange(listener);
    const mockStates = createFakePartial<AllFeaturesState>({
      [CHAT]: chatFeatureState,
      [CODE_SUGGESTIONS]: codeSuggestionsFeatureState,
    });

    triggerOnChange(mockStates);
    await waitForPromises();
    expect(listener).toHaveBeenCalledWith({
      chatAvailable: true,
    } satisfies ChatState);
  });
});
