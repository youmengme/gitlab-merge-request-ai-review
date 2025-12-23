import * as vscode from 'vscode';
import { AIContextCategory, AIContextItem } from '@gitlab-org/gitlab-lsp';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { prepareWebviewSource } from '../utils/webviews/prepare_webview_source';
import { GitLabChatView } from './gitlab_chat_view';
import { GitLabChatRecord } from './gitlab_chat_record';
import { defaultSlashCommands } from './gitlab_chat_slash_commands';
import { getErrorScreenHtml } from './error_screen';

jest.mock('../utils/webviews/wait_for_webview');
jest.mock('../utils/webviews/prepare_webview_source', () => ({
  prepareWebviewSource: jest.fn().mockReturnValue('preparedWebviewSource'),
}));

describe('GitLabChatView', () => {
  const context = {} as Partial<vscode.ExtensionContext> as vscode.ExtensionContext;
  let view: GitLabChatView;
  let webview: vscode.WebviewView;
  const viewProcessCallback = jest.fn();

  beforeEach(() => {
    webview = {
      webview: {
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn(),
      } as Partial<vscode.Webview> as vscode.Webview,
      onDidDispose: jest.fn(),
      onDidChangeVisibility: jest.fn(),
      show: jest.fn(),
    } as Partial<vscode.WebviewView> as vscode.WebviewView;

    view = new GitLabChatView(context);
    view.onViewMessage(viewProcessCallback);
  });

  describe('resolveWebviewView', () => {
    beforeEach(async () => {
      await view.resolveWebviewView(webview);
    });

    it('updates webview with proper html options', () => {
      expect(webview.webview.options).toEqual({ enableScripts: true });
      expect(webview.webview.html.length).toBeGreaterThan(0);
    });

    it('sets message processing and dispose callbacks', () => {
      expect(webview.webview.onDidReceiveMessage).toHaveBeenCalledWith(expect.any(Function));
      expect(webview.onDidChangeVisibility).toHaveBeenCalledWith(expect.any(Function));
      expect(webview.onDidDispose).toHaveBeenCalledWith(expect.any(Function), view);
    });

    it('updates the view with correct html content', async () => {
      await view.resolveWebviewView(webview);
      expect(webview.webview.html).toBe('preparedWebviewSource');
      expect(prepareWebviewSource).toHaveBeenCalledWith(
        webview.webview,
        context,
        'gitlab_duo_chat',
        undefined,
        {
          slashCommands: defaultSlashCommands,
        },
      );
    });
  });

  describe('show', () => {
    it('shows the chatview', async () => {
      await view.resolveWebviewView(webview);

      await view.show();

      expect(webview.show).toHaveBeenCalled();
    });

    it('executes vscode command if the view is not present', async () => {
      vscode.commands.executeCommand = jest.fn();

      await view.show();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('gl.chatView.focus');
    });

    it('focuses the prompt if the view is already visible', async () => {
      webview = {
        ...webview,
        visible: true,
      };
      await view.resolveWebviewView(webview);

      await view.show();

      expect(webview.webview.postMessage).toHaveBeenCalledWith({
        eventType: 'focusChat',
      });
    });
  });

  describe('hide', () => {
    it('hides the chatview', async () => {
      webview = {
        ...webview,
        visible: true,
      };
      await view.resolveWebviewView(webview);

      await view.hide();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.closeSidebar');
    });
  });

  describe('focusChat', () => {
    it('focuses the prompt', async () => {
      await view.resolveWebviewView(webview);

      await view.focusChat();

      expect(webview.webview.postMessage).toHaveBeenCalledWith({
        eventType: 'focusChat',
      });
    });
  });

  describe('setChatFocused', () => {
    it('set context "gitlab:chatFocused', async () => {
      await view.resolveWebviewView(webview);
      const isChatFocused = true;
      await view.setChatFocused(isChatFocused);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatFocused',
        isChatFocused,
      );
    });
  });

  describe('set error screen content', () => {
    it('throws error when chat view is not initialized', () => {
      expect(() => view.setErrorScreenContent('error message')).toThrow(
        'Chat view not initialized.',
      );
    });

    it('sets error screen content successfully when chat view is initialized', async () => {
      const errorMessage = 'test error message';
      const errorScreenHtml = getErrorScreenHtml(errorMessage);

      await view.resolveWebviewView(webview);

      view.setErrorScreenContent(errorMessage);

      expect(webview.webview.html).toBe(errorScreenHtml);
    });
  });

  describe('with webview initialized', () => {
    beforeEach(async () => {
      await view.resolveWebviewView(webview);
    });

    describe('addRecord', () => {
      it('sends newRecord view message', async () => {
        const record = new GitLabChatRecord({ role: 'user', content: 'hello' });

        await view.addRecord(record);

        expect(webview.webview.postMessage).toHaveBeenCalledWith({
          eventType: 'newRecord',
          record,
        });
      });
    });

    describe('updateRecord', () => {
      it('sends updateRecord view message', async () => {
        const record = new GitLabChatRecord({ role: 'user', content: 'hello' });

        await view.updateRecord(record);

        expect(webview.webview.postMessage).toHaveBeenCalledWith({
          eventType: 'updateRecord',
          record,
        });
      });
    });

    describe('setLoadingState', () => {
      it.each([[true], [false]])(
        'sends correct setLoadingState view message when isLoading is %s',
        async isLoading => {
          await view.setLoadingState(isLoading);

          expect(webview.webview.postMessage).toHaveBeenCalledWith({
            eventType: 'setLoadingState',
            isLoading,
          });
        },
      );
    });

    describe('clearChat', () => {
      it('sends `clearChat` view message', async () => {
        await view.clearChat();

        expect(webview.webview.postMessage).toHaveBeenCalledWith({ eventType: 'clearChat' });
      });
    });

    describe('cancelPrompt', () => {
      it('sends `cancelPrompt` view message', async () => {
        const canceledPromptRequestIds = ['requestId1', 'requestId2', 'requestId3'];
        await view.cancelPrompt(canceledPromptRequestIds);

        expect(webview.webview.postMessage).toHaveBeenCalledWith({
          eventType: 'cancelPrompt',
          canceledPromptRequestIds,
        });
      });
    });

    describe('setContextItemCategories', () => {
      it('sends `contextCategoriesResult` view message', async () => {
        const categories: Array<AIContextCategory> = ['file', 'issue', 'merge_request'];
        await view.setContextItemCategories(categories);

        expect(webview.webview.postMessage).toHaveBeenCalledWith({
          eventType: 'contextCategoriesResult',
          categories,
        });
      });
    });

    describe('setCurrentContextItems', () => {
      it('sends `contextCurrentItemsResult` view message', async () => {
        const items = [
          createFakePartial<AIContextItem>({ id: '1' }),
          createFakePartial<AIContextItem>({ id: '2' }),
          createFakePartial<AIContextItem>({ id: '3' }),
        ];
        await view.setCurrentContextItems(items);

        expect(webview.webview.postMessage).toHaveBeenCalledWith({
          eventType: 'contextCurrentItemsResult',
          items,
        });
      });
    });

    describe('setContextItemSearchResults', () => {
      it('sends `contextCurrentItemsResult` view message', async () => {
        const results = [
          createFakePartial<AIContextItem>({ id: '1' }),
          createFakePartial<AIContextItem>({ id: '2' }),
          createFakePartial<AIContextItem>({ id: '3' }),
        ];
        await view.setContextItemSearchResults(results);

        expect(webview.webview.postMessage).toHaveBeenCalledWith({
          eventType: 'contextItemSearchResult',
          results,
        });
      });
    });
  });
});
