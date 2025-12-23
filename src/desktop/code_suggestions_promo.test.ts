import vscode from 'vscode';
import { InMemoryMemento } from '../../test/integration/test_infrastructure/in_memory_memento';
import { TokenAccount } from '../common/platform/gitlab_account';
import { setupCodeSuggestionsPromo } from './code_suggestions_promo';
import { DISMISSED_CODE_SUGGESTIONS_PROMO } from './constants';
import { accountService } from './accounts/account_service';

jest.mock('./accounts/account_service', () => ({
  accountService: {
    onDidChange: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    getAllAccounts: jest.fn(() => []),
  },
}));

const FAKE_GITLAB_ACCOUNT: TokenAccount = {
  type: 'token',
  instanceUrl: 'https://gitlab.com',
  username: 'user',
  id: '1',
  token: '',
};

const FAKE_OTHER_INSTANCE_ACCOUNT: TokenAccount = {
  ...FAKE_GITLAB_ACCOUNT,
  instanceUrl: 'https://some.other.host',
};

describe('Code suggestions promo', () => {
  let context: vscode.ExtensionContext;
  const disposeTextDocumentChange = jest.fn();

  beforeEach(() => {
    context = {
      globalState: new InMemoryMemento(),
    } as unknown as vscode.ExtensionContext;

    jest
      .mocked(vscode.workspace.onDidChangeTextDocument)
      .mockReturnValue({ dispose: disposeTextDocumentChange });
  });

  it('does not subscribe to any events when promo was already dismissed', async () => {
    await context.globalState.update(DISMISSED_CODE_SUGGESTIONS_PROMO, true);
    setupCodeSuggestionsPromo(context);

    expect(accountService.onDidChange).not.toHaveBeenCalled();
    expect(vscode.workspace.onDidChangeTextDocument).not.toHaveBeenCalled();
  });

  describe('when gitlab.com account is available', () => {
    beforeEach(() => {
      jest.mocked(accountService.getAllAccounts).mockReturnValueOnce([FAKE_GITLAB_ACCOUNT]);
      setupCodeSuggestionsPromo(context);
    });

    it('triggers promo on first text change', async () => {
      const [[listener]] = jest.mocked(vscode.workspace.onDidChangeTextDocument).mock.calls;
      listener({} as vscode.TextDocumentChangeEvent);

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('unsubscribes from text changes after first one', async () => {
      const [[listener]] = jest.mocked(vscode.workspace.onDidChangeTextDocument).mock.calls;
      jest.mocked(disposeTextDocumentChange).mockClear();

      await listener({} as vscode.TextDocumentChangeEvent);
      expect(disposeTextDocumentChange).toHaveBeenCalled();
    });
  });

  describe('when gitlab.com account is not available', () => {
    beforeEach(() => {
      setupCodeSuggestionsPromo(context);
    });

    it('triggers promo when gitlab.com account becomes available', () => {
      const [[listener]] = jest.mocked(accountService.onDidChange).mock.calls;
      jest.mocked(accountService.getAllAccounts).mockReturnValueOnce([FAKE_GITLAB_ACCOUNT]);
      listener();

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('does not trigger promo when non-gitlab.com account becomes available', () => {
      const [[listener]] = jest.mocked(accountService.onDidChange).mock.calls;
      jest.mocked(accountService.getAllAccounts).mockReturnValueOnce([FAKE_OTHER_INSTANCE_ACCOUNT]);
      listener();

      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });
});
