import * as vscode from 'vscode';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { DUO_CHAT_WEBVIEW_ID } from '../../constants';
import { USER_COMMANDS } from '../../command_names';
import { handleError } from '../../errors/handle_error';
import { UserFriendlyError } from '../../errors/user_friendly_error';
import { escapeHtml } from '../escape_html';
import { setFakeWorkspaceConfiguration } from '../../test_utils/vscode_fakes';
import { LSDuoChatWebviewController } from './duo_chat_controller';

jest.mock('../../errors/handle_error');

describe('LSDuoChatWebviewController', () => {
  const mockUrl = new URL('http://localhost');
  const mockTitle = 'duo-chat';
  const mockViewId = DUO_CHAT_WEBVIEW_ID;

  let controller: LSDuoChatWebviewController;
  let mockWebviewView: vscode.WebviewView;

  const mockExecuteCommand = jest
    .spyOn(vscode.commands, 'executeCommand')
    .mockResolvedValue(undefined);

  beforeEach(() => {
    // mocking for isUrlAvailable
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve({ ok: true }));
    jest.mocked(vscode.env.asExternalUri).mockResolvedValue(vscode.Uri.parse(mockUrl.toString()));
    controller = new LSDuoChatWebviewController({
      viewId: mockViewId,
      url: mockUrl,
      title: mockTitle,
    });

    mockWebviewView = createFakePartial<vscode.WebviewView>({
      webview: { options: {} },
      show: jest.fn(),
      visible: false,
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const setupWebviewAndResolve = async ({
    webviewVisible = true,
    setChatReady = true,
    advanceTimersBy = 300,
  }: {
    webviewVisible?: boolean;
    setChatReady?: boolean;
    advanceTimersBy?: number;
  } = {}) => {
    mockWebviewView = createFakePartial<vscode.WebviewView>({
      ...mockWebviewView,
      visible: webviewVisible,
    });

    const resolveWebviewPromise = controller.resolveWebviewView(mockWebviewView);
    await jest.runAllTicks();
    if (setChatReady) {
      controller.setChatReady();
    }

    await jest.advanceTimersByTimeAsync(advanceTimersBy);
    await resolveWebviewPromise;

    return resolveWebviewPromise;
  };

  describe('show', () => {
    describe('when view exists', () => {
      describe('when view is visible', () => {
        it('does not call show', async () => {
          await setupWebviewAndResolve({
            webviewVisible: true,
            setChatReady: true,
            advanceTimersBy: 300,
          });

          const showPromise = controller.show();
          await jest.advanceTimersByTime(50);
          await showPromise;

          expect(mockWebviewView.show).not.toHaveBeenCalled();
        });
      });

      describe('when view is not visible', () => {
        it('shows the view', async () => {
          await setupWebviewAndResolve({ webviewVisible: false, setChatReady: true });
          const showPromise = controller.show();
          await jest.advanceTimersByTime(50);
          await showPromise;

          expect(mockWebviewView.show).toHaveBeenCalled();
        });
      });
    });

    describe('when view does not exist', () => {
      it('waits for view to load and executes focus command', async () => {
        const showPromise = controller.show();
        expect(mockExecuteCommand).toHaveBeenCalledWith('gl.webview.duo-chat-v2.focus');
        await setupWebviewAndResolve({ webviewVisible: true, setChatReady: true });
        jest.advanceTimersByTime(50);
        await showPromise;
        expect(mockExecuteCommand).toHaveBeenCalledWith(USER_COMMANDS.FOCUS_CHAT);
      });
    });
  });

  describe('hide', () => {
    describe('when view is visible', () => {
      it('runs command to close sidebar', async () => {
        await setupWebviewAndResolve({ webviewVisible: true, setChatReady: true });

        await controller.hide();

        expect(mockExecuteCommand).toHaveBeenCalledWith('workbench.action.closeSidebar');
      });
    });

    describe('when view is not visible', () => {
      it('does not run command', async () => {
        await controller.hide();
        expect(mockExecuteCommand).not.toHaveBeenCalled();
      });
    });
  });

  describe('focusChat', () => {
    describe('when view is visible', () => {
      it('runs command to focus chat', async () => {
        await setupWebviewAndResolve({ webviewVisible: true, setChatReady: true });

        await controller.focusChat();

        expect(mockExecuteCommand).toHaveBeenCalledWith(USER_COMMANDS.FOCUS_CHAT);
      });
    });

    describe('when view is not visible', () => {
      it('does not run command', async () => {
        await controller.focusChat();
        expect(mockExecuteCommand).not.toHaveBeenCalled();
      });
    });
  });

  describe('#waitForChatReady', () => {
    it('resolves when chat is set ready within timeout', async () => {
      await expect(setupWebviewAndResolve()).resolves.toBeUndefined();
    });

    it('rejects if chat was not ready within timeout', async () => {
      await setupWebviewAndResolve({ setChatReady: false, advanceTimersBy: 10000 });
      expect(handleError).toBeCalledWith(expect.any(UserFriendlyError));
      expect(mockWebviewView.webview.html).toContain(
        escapeHtml(`The webview didn't initialize in ${10000}ms`),
      );
    });

    describe('with custom webview timeout', () => {
      beforeEach(() => {
        setFakeWorkspaceConfiguration({
          webviewTimeoutSeconds: 7,
        });
      });

      it('rejects  after custom timeout', async () => {
        await setupWebviewAndResolve({ setChatReady: false, advanceTimersBy: 7000 });
        expect(handleError).toBeCalledWith(expect.any(UserFriendlyError));
        expect(mockWebviewView.webview.html).toContain(
          escapeHtml(`The webview didn't initialize in ${7000}ms`),
        );
      });
    });
  });
});
