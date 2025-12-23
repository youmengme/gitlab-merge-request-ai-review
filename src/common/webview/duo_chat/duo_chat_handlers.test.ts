import * as vscode from 'vscode';
import { DUO_CHAT_WEBVIEW_ID } from '../../constants';
import { WebviewMessageRegistry } from '../message_handlers/webview_message_registry';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { log } from '../../log';
import { insertCodeSnippet as insertCodeSnippetFn } from '../../chat/insert_code_snippet';
import { copyContent } from '../../chat/copy_content';
import {
  registerDuoChatHandlers,
  showUserMessage,
  MessageType,
  openLink,
  copyMessage,
  insertCodeSnippet,
  copyCodeSnippet,
} from './duo_chat_handlers';
import { LSDuoChatWebviewController } from './duo_chat_controller';

jest.mock('../setup_webviews');
jest.mock('vscode');
jest.mock('../../chat/insert_code_snippet');
jest.mock('../../chat/copy_content');

describe('registerDuoChatHandlers', () => {
  let mockRegistry: WebviewMessageRegistry;
  const chatController = createFakePartial<LSDuoChatWebviewController>({});

  beforeEach(() => {
    mockRegistry = createFakePartial<WebviewMessageRegistry>({
      onRequest: jest.fn(),
      onNotification: jest.fn(),
    });

    registerDuoChatHandlers(mockRegistry, chatController, DUO_CHAT_WEBVIEW_ID);
  });

  const notificationHandlers = [
    'insertCodeSnippet',
    'copyCodeSnippet',
    'appReady',
    'focusChange',
    'showMessage',
    'openLink',
    'openUrl',
  ];

  it('should register a request handler for `getCurrentFileContext` request', () => {
    expect(mockRegistry.onRequest).toHaveBeenCalledWith(
      DUO_CHAT_WEBVIEW_ID,
      'getCurrentFileContext',
      expect.any(Function),
    );
  });

  notificationHandlers.forEach(handler => {
    it(`should register a handler for \`${handler}\` notification`, () => {
      expect(mockRegistry.onNotification).toHaveBeenCalledWith(
        DUO_CHAT_WEBVIEW_ID,
        handler,
        expect.any(Function),
      );
    });
  });

  type ShowMessageMethod = 'showInformationMessage' | 'showWarningMessage' | 'showErrorMessage';

  describe('showUserMessage', () => {
    it.each`
      messageType  | expectedMethod
      ${'info'}    | ${'showInformationMessage'}
      ${'warning'} | ${'showWarningMessage'}
      ${'error'}   | ${'showErrorMessage'}
    `(
      'when messageType is "$messageType" calls "vscode.window.$expectedMethod"',
      async ({
        messageType,
        expectedMethod,
      }: {
        messageType: MessageType;
        expectedMethod: ShowMessageMethod;
      }) => {
        const spy = jest.spyOn(vscode.window, expectedMethod);

        const message = 'Hi, user!';
        await showUserMessage({ type: messageType, message });

        expect(spy).toHaveBeenCalledWith(message);
      },
    );
  });

  describe('openLink', () => {
    let uriParseSpy: jest.SpyInstance;
    let openExternalUrlSpy: jest.SpyInstance;

    beforeEach(() => {
      uriParseSpy = jest.spyOn(vscode.Uri, 'parse');
      openExternalUrlSpy = jest.spyOn(vscode.env, 'openExternal');
    });

    describe.each([
      { paramName: 'href', paramValue: 'https://google.com' },
      { paramName: 'url', paramValue: 'https://gitlab.com' },
    ])('with $paramName parameter', ({ paramName, paramValue }) => {
      it(`should call vscode API to parse and open external link using ${paramName} parameter`, async () => {
        const params = { [paramName]: paramValue };
        await openLink(params);
        expect(uriParseSpy).toHaveBeenCalledWith(paramValue);
        expect(openExternalUrlSpy).toHaveBeenCalledWith(expect.any(vscode.Uri));
      });

      it(`should work when called via ${paramName === 'href' ? 'openLink' : 'openUrl'} notification handler`, async () => {
        const params = { [paramName]: paramValue };
        await openLink(params);
        expect(uriParseSpy).toHaveBeenCalledWith(paramValue);
        expect(openExternalUrlSpy).toHaveBeenCalledWith(expect.any(vscode.Uri));
      });

      it(`should log a warning when opening ${paramName} fails`, async () => {
        jest.mocked(openExternalUrlSpy).mockResolvedValueOnce(false);
        jest.spyOn(log, 'warn');
        const params = { [paramName]: paramValue };
        await openLink(params);
        expect(log.warn).toHaveBeenCalledWith(`Failed to open URL: ${paramValue}`);
      });
    });

    it('should do nothing when neither href nor url is provided', async () => {
      await openLink({});
      expect(uriParseSpy).not.toHaveBeenCalled();
      expect(openExternalUrlSpy).not.toHaveBeenCalled();
    });
  });

  describe('copyMessage', () => {
    it('copies message to clipboard when valid message is provided', async () => {
      const message = 'Test message to copy';
      await copyMessage({ message });

      expect(copyContent).toHaveBeenCalledWith(message);
    });

    it('does nothing when message is not provided', async () => {
      await copyMessage({});
      expect(copyContent).not.toHaveBeenCalled();
    });

    it('handles invalid params gracefully', async () => {
      await copyMessage(null);
      expect(copyContent).not.toHaveBeenCalled();
    });
  });

  describe('copyCodeSnippet', () => {
    it('copies snippet to clipboard when valid snippet is provided', async () => {
      const snippet = 'const test = "hello";';
      await copyCodeSnippet({ snippet });

      expect(copyContent).toHaveBeenCalledWith(snippet);
    });

    it('does nothing when snippet is not provided', async () => {
      await copyCodeSnippet({});
      expect(copyContent).not.toHaveBeenCalled();
    });

    it('handles invalid params gracefully', async () => {
      await copyCodeSnippet(null);
      expect(copyContent).not.toHaveBeenCalled();
    });
  });

  describe('insertCodeSnippet', () => {
    it('inserts snippet when valid snippet is provided', async () => {
      const snippet = 'const test = "hello";';
      await insertCodeSnippet({ snippet });

      expect(insertCodeSnippetFn).toHaveBeenCalledWith(snippet);
    });

    it('does nothing when snippet is not provided', async () => {
      await insertCodeSnippet({});
      expect(insertCodeSnippetFn).not.toHaveBeenCalled();
    });

    it('handles invalid params gracefully', async () => {
      await insertCodeSnippet(null);
      expect(insertCodeSnippetFn).not.toHaveBeenCalled();
    });
  });
});
