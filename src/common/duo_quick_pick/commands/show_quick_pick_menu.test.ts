import vscode from 'vscode';
import {
  CodeSuggestionsStateManager,
  VisibleCodeSuggestionsState,
} from '../../code_suggestions/code_suggestions_state_manager';
import { COMMAND_OPEN_GITLAB_CHAT } from '../../chat/commands/open_gitlab_chat';
import { COMMAND_TOGGLE_CODE_SUGGESTIONS } from '../../code_suggestions/commands/toggle';
import { COMMAND_TOGGLE_CODE_SUGGESTIONS_FOR_LANGUAGE } from '../../code_suggestions/commands/toggle_language';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { createFakeWorkspaceConfiguration } from '../../test_utils/vscode_fakes';
import * as utils from '../utils';
import { USER_COMMANDS } from '../../command_names';
import { showDuoQuickPickMenu } from './show_quick_pick_menu';

describe('show duo quick pick menu command', () => {
  let mockStateManager: CodeSuggestionsStateManager;
  let mockQuickPick: vscode.QuickPick<vscode.QuickPickItem>;
  const duoChatLabel = '$(gitlab-duo-chat-enabled) GitLab Duo Chat: Enabled';

  const findItemByLabel = (label: string) => mockQuickPick.items.find(i => i.label === label);

  const findAnyItemByLabels = (labels: string[]) =>
    mockQuickPick.items.find(i => labels.find(label => label === i.label));

  const selectItemByLabel = async (label: string) => {
    const item = findItemByLabel(label);
    if (!item) return;

    const selectionCallback = jest.mocked(mockQuickPick.onDidChangeSelection).mock.calls[0][0];
    await selectionCallback([item]);
  };

  const defaultTestSetup = {
    isDisabledByUser: false,
    isMissingAccount: false,
    visibleState: VisibleCodeSuggestionsState.READY as VisibleCodeSuggestionsState,
  };
  type TestSetup = typeof defaultTestSetup;

  const setupTest = (testSetup: Partial<TestSetup> = {}) => {
    const { isDisabledByUser, isMissingAccount, visibleState } = {
      ...defaultTestSetup,
      ...testSetup,
    };
    mockStateManager = createFakePartial<CodeSuggestionsStateManager>({
      isDisabledByUser: jest.fn().mockReturnValue(isDisabledByUser),
      isMissingAccount: jest.fn().mockReturnValue(isMissingAccount),
      getVisibleState: jest.fn().mockReturnValue(visibleState),
    });

    mockQuickPick = createFakePartial<vscode.QuickPick<vscode.QuickPickItem>>({
      items: [],
      onDidChangeSelection: jest.fn(),
      onDidHide: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    });

    jest.spyOn(utils, 'generateDuoChatStatusItem').mockReturnValue({ label: duoChatLabel });

    (vscode.window.createQuickPick as jest.Mock).mockReturnValue(mockQuickPick);
  };

  beforeEach(async () => {
    setupTest();
    await showDuoQuickPickMenu({ stateManager: mockStateManager });
  });

  afterEach(() => jest.clearAllMocks());

  describe('QuickPick items', () => {
    const separator = { label: '', kind: vscode.QuickPickItemKind.Separator };
    const items = [
      {
        label: 'Status: No problems detected',
      },
      separator,
      {
        label: '$(gitlab-code-suggestions-enabled) GitLab Duo Code Suggestions: Enabled',
        description: 'Code completion + generation',
      },
      { label: duoChatLabel },
      separator,
      { label: 'Disable Code Suggestions' },
      separator,
      { label: 'Duo Settings' },
      { label: 'Documentation' },
      { label: 'GitLab Forum', description: 'Help and feedback' },
    ];

    items.forEach(item => {
      it(`should contain an item with label: "${item.label}"`, () => {
        expect(mockQuickPick.items).toEqual(
          expect.arrayContaining([expect.objectContaining(item)]),
        );
      });
    });
  });

  it('should handle selection of the Code Suggestions status item', async () => {
    const mockActiveEditor = createFakePartial<vscode.TextEditor>({
      document: createFakePartial<vscode.TextDocument>({
        getText: jest.fn().mockReturnValue('editorText'),
      }),
    });

    vscode.window.activeTextEditor = mockActiveEditor;

    await selectItemByLabel(
      '$(gitlab-code-suggestions-enabled) GitLab Duo Code Suggestions: Enabled',
    );

    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockActiveEditor.document);
    expect(mockQuickPick.hide).toHaveBeenCalled();
  });

  it('should show information message when GitLab Duo Chat is not enabled', async () => {
    await showDuoQuickPickMenu({ stateManager: mockStateManager });
    await selectItemByLabel(duoChatLabel);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'GitLab Duo Chat is currently disabled.',
    );
    expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(COMMAND_OPEN_GITLAB_CHAT);
  });

  it('should handle selection of the GitLab Duo Chat status item', async () => {
    jest
      .mocked(vscode.workspace.getConfiguration)
      .mockReturnValue(createFakeWorkspaceConfiguration({ duoChat: { enabled: true } }));

    await showDuoQuickPickMenu({ stateManager: mockStateManager });
    await selectItemByLabel(duoChatLabel);

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(COMMAND_OPEN_GITLAB_CHAT);
    expect(mockQuickPick.hide).toHaveBeenCalled();
  });

  it('should handle selection of the Code Suggestions toggle item', async () => {
    await selectItemByLabel('Disable Code Suggestions');

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(COMMAND_TOGGLE_CODE_SUGGESTIONS);
    expect(mockQuickPick.hide).toHaveBeenCalled();
  });

  it('should handle selection of the Duo Settings item', async () => {
    await selectItemByLabel('Duo Settings');

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.openSettings',
      '@ext:gitlab.gitlab-workflow',
    );

    expect(mockQuickPick.hide).toHaveBeenCalled();
  });

  it('should handle selection of the Documentation item', async () => {
    const documentationUrl = 'https://docs.gitlab.com/user/gitlab_duo/';
    await selectItemByLabel('Documentation');

    expect(vscode.env.openExternal).toHaveBeenCalledWith(vscode.Uri.parse(documentationUrl));
  });

  it('should handle selection of the GitLab Forum item', async () => {
    const forumUrl = 'https://forum.gitlab.com/c/gitlab-duo/52';
    await selectItemByLabel('GitLab Forum');

    expect(vscode.env.openExternal).toHaveBeenCalledWith(vscode.Uri.parse(forumUrl));
  });

  it('should dispose QuickPick on hide', async () => {
    const hideCallback = (mockQuickPick.onDidHide as jest.Mock).mock.calls[0][0];
    hideCallback();

    expect(mockQuickPick.dispose).toHaveBeenCalled();
  });

  it('should show information message when code suggestions is disabled', async () => {
    setupTest({ isDisabledByUser: true });
    await showDuoQuickPickMenu({ stateManager: mockStateManager });

    await selectItemByLabel(
      '$(gitlab-code-suggestions-disabled) GitLab Duo Code Suggestions: Disabled',
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'GitLab Duo Code Suggestions is currently disabled.',
    );
  });

  it('should show information message when no active editor', async () => {
    vscode.window.activeTextEditor = undefined;

    await selectItemByLabel(
      '$(gitlab-code-suggestions-enabled) GitLab Duo Code Suggestions: Enabled',
    );

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'No active editor. Open a file to use Duo Code Suggestions.',
    );
  });

  describe('QuickPickitems when missing account', () => {
    beforeEach(async () => {
      setupTest({ isMissingAccount: true, visibleState: VisibleCodeSuggestionsState.NO_ACCOUNT });
      await showDuoQuickPickMenu({ stateManager: mockStateManager });
    });

    it('should show "Duo unavailable" item', () => {
      const duoUnavailableItem = findItemByLabel(
        '$(gitlab-code-suggestions-disabled) Duo unavailable',
      );
      expect(duoUnavailableItem).toBeDefined();
      expect(duoUnavailableItem?.description).toBe('Please sign in to GitLab');
    });

    it('should not show Code Suggestions status item', () => {
      const codeSuggestionsItem = findAnyItemByLabels([
        '$(gitlab-code-suggestions-enabled) GitLab Duo Code Suggestions: Enabled',
        '$(gitlab-code-suggestions-disabled) GitLab Duo Code Suggestions: Disabled',
      ]);
      expect(codeSuggestionsItem).toBeUndefined();
    });

    it('should not show Code Suggestions toggle item', () => {
      const toggleItem = findItemByLabel('Disable Code Suggestions');
      expect(toggleItem).toBeUndefined();
    });

    it('should handle selection of the Duo unavailable item', async () => {
      await selectItemByLabel('$(gitlab-code-suggestions-disabled) Duo unavailable');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(USER_COMMANDS.AUTHENTICATE);
      expect(mockQuickPick.hide).toHaveBeenCalled();
    });
  });

  describe('code suggestions language toggle', () => {
    const toggleItemMock = { label: 'Enable Code Suggestions for javascript' };

    beforeEach(async () => {
      jest.spyOn(utils, 'generateCodeSuggestionsLangToggleItem').mockReturnValue(toggleItemMock);

      await showDuoQuickPickMenu({ stateManager: mockStateManager });
    });

    it('should add a language toggle when Code Suggestions is enabled globally', () => {
      expect(mockQuickPick.items).toContain(toggleItemMock);
    });

    it('should handle selection of the language toggle', async () => {
      await selectItemByLabel(toggleItemMock.label);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        COMMAND_TOGGLE_CODE_SUGGESTIONS_FOR_LANGUAGE,
      );
      expect(mockQuickPick.hide).toHaveBeenCalled();
    });

    it('should not add a language toggle at index 2 when item is not generated', async () => {
      jest.spyOn(utils, 'generateCodeSuggestionsLangToggleItem').mockReturnValue(undefined);
      await showDuoQuickPickMenu({ stateManager: mockStateManager });

      expect(mockQuickPick.items[2]).not.toEqual(toggleItemMock);
    });
  });
});
