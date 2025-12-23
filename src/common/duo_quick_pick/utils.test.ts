import vscode from 'vscode';
import {
  getDuoCodeSuggestionsConfiguration,
  DuoCodeSuggestionsConfiguration,
} from '../utils/extension_configuration';
import { createFakeWorkspaceConfiguration } from '../test_utils/vscode_fakes';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { VisibleCodeSuggestionsState } from '../code_suggestions/code_suggestions_state_manager';
import { USER_COMMANDS } from '../command_names';
import {
  generateCodeSuggestionsStatusItem,
  generateDuoChatStatusItem,
  generateCodeSuggestionsToggleItem,
  generateCodeSuggestionsLangToggleItem,
  generateQuickPickItem,
  generateDuoUnavailableStatusItem,
  generateDuoDiagnosticsStatusItem,
} from './utils';
import {
  CODE_SUGGESTIONS_ENABLED,
  CODE_SUGGESTIONS_DISABLED,
  CODE_SUGGESTIONS_DESCRIPTION,
  DUO_CHAT_ENABLED,
  DUO_CHAT_DISABLED,
  ENABLE_CODE_SUGGESTIONS,
  DISABLE_CODE_SUGGESTIONS,
  DUO_UNAVAILABLE,
} from './constants';

jest.mock('../utils/extension_configuration');

describe('Quick Pick Utils', () => {
  const label = 'some label';

  describe('generateQuickPickItem', () => {
    it('should generate a QuickPickItem with a label if only a label is provided', () => {
      const result = generateQuickPickItem(label);
      expect(result).toEqual({ label });
    });

    it('should generate a QuickPickItem with a label and a description', () => {
      const description = 'some description';
      const result = generateQuickPickItem(label, description);
      expect(result).toEqual({ label, description });
    });
  });

  describe('generateDuoUnavailableStatusItem', () => {
    it('should generate a QuickPickItem with a label and description for Duo unavailable', () => {
      const description = 'Please sign in to GitLab';
      const result = generateDuoUnavailableStatusItem(VisibleCodeSuggestionsState.NO_ACCOUNT);
      expect(result[0]).toEqual({ label: DUO_UNAVAILABLE, description });
      expect(result[1]).toBeInstanceOf(Function);
    });

    it('should return a function that calls authenticateUser for NO_ACCOUNT state', () => {
      const [, action] = generateDuoUnavailableStatusItem(VisibleCodeSuggestionsState.NO_ACCOUNT);
      const authenticateUserMock = jest.fn();
      jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(authenticateUserMock);

      action();

      expect(authenticateUserMock).toHaveBeenCalledWith(USER_COMMANDS.AUTHENTICATE);
    });

    it('should return an empty function for other states', () => {
      const [, action] = generateDuoUnavailableStatusItem(VisibleCodeSuggestionsState.ERROR);
      expect(action).toBeInstanceOf(Function);
      expect(action()).toBeUndefined();
    });
  });

  describe('generateCodeSuggestionsStatusItem', () => {
    it('should generate a QuickPickItem for enabled code suggestions', () => {
      const result = generateCodeSuggestionsStatusItem(true);
      expect(result).toEqual({
        label: CODE_SUGGESTIONS_ENABLED,
        description: CODE_SUGGESTIONS_DESCRIPTION,
      });
    });

    it('should generate a disabled code suggestions status when language disabled', () => {
      jest.mocked(getDuoCodeSuggestionsConfiguration).mockReturnValue(
        createFakePartial<DuoCodeSuggestionsConfiguration>({
          enabledSupportedLanguages: { javascript: false },
          additionalLanguages: [],
        }),
      );

      vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
        document: createFakePartial<vscode.TextDocument>({
          languageId: 'javascript',
        }),
      });

      const result = generateCodeSuggestionsStatusItem(true);
      expect(result).toEqual({
        label: CODE_SUGGESTIONS_DISABLED,
        description: CODE_SUGGESTIONS_DESCRIPTION,
      });
    });

    it('should generate a QuickPickItem for disabled code suggestions', () => {
      const result = generateCodeSuggestionsStatusItem(false);
      expect(result).toEqual({
        label: CODE_SUGGESTIONS_DISABLED,
        description: CODE_SUGGESTIONS_DESCRIPTION,
      });
    });
  });

  describe('generateDuoChatStatusItem', () => {
    const setDuoChatEnabled = (enabled: boolean) =>
      jest
        .mocked(vscode.workspace.getConfiguration)
        .mockReturnValue(createFakeWorkspaceConfiguration({ duoChat: { enabled } }));

    it('should generate a QuickPickItem for enabled Duo Chat', () => {
      setDuoChatEnabled(true);
      const result = generateDuoChatStatusItem();
      expect(result).toEqual({
        label: DUO_CHAT_ENABLED,
      });
    });

    it('should generate a QuickPickItem for disabled Duo Chat', () => {
      setDuoChatEnabled(false);
      const result = generateDuoChatStatusItem();
      expect(result).toEqual({
        label: DUO_CHAT_DISABLED,
      });
    });
  });

  describe('generateCodeSuggestionsToggleItem', () => {
    it('should generate a QuickPickItem to disable code suggestions when enabled', () => {
      const result = generateCodeSuggestionsToggleItem(true);
      expect(result).toEqual({ label: DISABLE_CODE_SUGGESTIONS });
    });

    it('should generate a QuickPickItem to enable code suggestions when disabled', () => {
      const result = generateCodeSuggestionsToggleItem(false);
      expect(result).toEqual({ label: ENABLE_CODE_SUGGESTIONS });
    });
  });

  describe('generateCodeSuggestionsLangToggleItem', () => {
    beforeEach(() => {
      jest.mocked(getDuoCodeSuggestionsConfiguration).mockReturnValue(
        createFakePartial<DuoCodeSuggestionsConfiguration>({
          enabledSupportedLanguages: { javascript: false },
          additionalLanguages: [],
        }),
      );

      vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
        document: createFakePartial<vscode.TextDocument>({
          languageId: 'javascript',
        }),
      });
    });

    it('should return undefined when code suggestions is globally disabled', () => {
      const result = generateCodeSuggestionsLangToggleItem(false);
      expect(result).toBeUndefined();
    });

    it('should return undefined when no active editor is open', () => {
      vscode.window.activeTextEditor = undefined;

      const result = generateCodeSuggestionsLangToggleItem(true);
      expect(result).toBeUndefined();
    });

    it('should return "Enable" item when language is not enabled', () => {
      const result = generateCodeSuggestionsLangToggleItem(true);
      expect(result).toEqual({
        label: `${ENABLE_CODE_SUGGESTIONS} for javascript`,
      });
    });

    it('should return "Disable" item when language is enabled', () => {
      jest.mocked(getDuoCodeSuggestionsConfiguration).mockReturnValue(
        createFakePartial<DuoCodeSuggestionsConfiguration>({
          enabledSupportedLanguages: { javascript: true },
          additionalLanguages: [],
        }),
      );

      const result = generateCodeSuggestionsLangToggleItem(true);
      expect(result).toEqual({
        label: `${DISABLE_CODE_SUGGESTIONS} for javascript`,
      });
    });

    it('should return "Disable" item when language is in additionalLanguages', () => {
      jest.mocked(getDuoCodeSuggestionsConfiguration).mockReturnValue(
        createFakePartial<DuoCodeSuggestionsConfiguration>({
          enabledSupportedLanguages: {},
          additionalLanguages: ['javascript'],
        }),
      );

      const result = generateCodeSuggestionsLangToggleItem(true);
      expect(result).toEqual({
        label: `${DISABLE_CODE_SUGGESTIONS} for javascript`,
      });
    });
  });
});

describe('generateDuoDiagnosticsStatusItem', () => {
  it.each`
    state                                                | label                                                               | description
    ${VisibleCodeSuggestionsState.NO_LICENSE}            | ${'Status: 1 problem detected, contact your GitLab administrator.'} | ${'Duo license not assigned.'}
    ${VisibleCodeSuggestionsState.ERROR}                 | ${'Status: Code Suggestion requests to API are failing.'}           | ${'See logs for more details.'}
    ${VisibleCodeSuggestionsState.SUGGESTIONS_API_ERROR} | ${'Status: Code Suggestion requests to API are failing.'}           | ${'See logs for more details.'}
  `(
    'calls quick pick item with correct payload for state: $state',
    ({ state, label, description }) => {
      const result = generateDuoDiagnosticsStatusItem(state);
      expect(result.label).toEqual(`$(error) ${label}`);
      expect(result.description).toEqual(description);
    },
  );
});
