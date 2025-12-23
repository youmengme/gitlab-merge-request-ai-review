import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { LsWebviewController } from './ls_webview_controller';
import { getWebviewContent } from './get_ls_webview_content';
import { applyMiddleware } from './middleware';

jest.mock('./get_ls_webview_content');
jest.mock('./middleware');

describe('LsWebviewController', () => {
  const mockUrl = new URL('http://localhost');
  const mockTitle = 'test-title';
  const mockViewId = 'test-view-id';

  let controller: LsWebviewController;
  let mockWebviewView: vscode.WebviewView;

  beforeEach(() => {
    // mocking for isUrlAvailable
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve({ ok: true }));
    jest.mocked(vscode.env.asExternalUri).mockResolvedValue(vscode.Uri.parse(mockUrl.toString()));

    controller = new LsWebviewController({
      viewId: mockViewId,
      url: mockUrl,
      title: mockTitle,
    });

    mockWebviewView = createFakePartial<vscode.WebviewView>({
      webview: {
        options: {},
      },
      show: jest.fn(),
      visible: false,
    });

    (getWebviewContent as jest.Mock).mockReturnValue('<mock-html-content>');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveWebviewView', () => {
    it('sets up the webview correctly', async () => {
      await controller.resolveWebviewView(mockWebviewView);

      expect(mockWebviewView.webview.options).toEqual({ enableScripts: true });
      expect(mockWebviewView.title).toBe(mockTitle);
      expect(mockWebviewView.webview.html).toBe('<mock-html-content>');
      expect(getWebviewContent).toHaveBeenCalledWith(mockUrl, mockTitle);
    });

    describe('when middleware is provided', () => {
      it('applies the middleware', async () => {
        const mockMiddleware = jest.fn();
        controller = new LsWebviewController({
          viewId: mockViewId,
          url: mockUrl,
          title: mockTitle,
          middlewares: [mockMiddleware],
        });

        await controller.resolveWebviewView(mockWebviewView);

        expect(applyMiddleware).toHaveBeenCalledWith(mockWebviewView, [mockMiddleware]);
      });
    });

    describe('when middleware is not provided', () => {
      it('does not apply middleware', async () => {
        await controller.resolveWebviewView(mockWebviewView);

        expect(applyMiddleware).not.toHaveBeenCalled();
      });
    });
  });

  describe('show', () => {
    describe('when view exists', () => {
      describe('when view is visible', () => {
        it('does not call show', async () => {
          mockWebviewView = createFakePartial<vscode.WebviewView>({
            ...mockWebviewView,
            visible: true,
          });
          await controller.resolveWebviewView(mockWebviewView);

          await controller.show();

          expect(mockWebviewView.show).not.toHaveBeenCalled();
        });
      });
      describe('when view is not visible', () => {
        it('shows the view', async () => {
          await controller.resolveWebviewView(mockWebviewView);

          await controller.show();

          expect(mockWebviewView.show).toHaveBeenCalled();
        });
      });
    });

    describe('when view does not exist', () => {
      it('executes focus command', async () => {
        const mockExecuteCommand = jest
          .spyOn(vscode.commands, 'executeCommand')
          .mockResolvedValue(undefined);

        await controller.show();

        expect(mockExecuteCommand).toHaveBeenCalledWith('test-view-id.focus');
      });
    });
  });
});
