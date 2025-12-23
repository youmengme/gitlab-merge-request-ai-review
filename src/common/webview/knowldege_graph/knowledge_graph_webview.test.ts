import * as vscode from 'vscode';
import { KNOWLEDGE_GRAPH_WEBVIEW_ID } from '../../constants';
import { getWebviewContent } from '../get_ls_webview_content';
import { KnowledgeGraphWebview } from './knowledge_graph_webview';

jest.mock('vscode', () => ({
  window: {
    createWebviewPanel: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue({}),
    }),
    onDidChangeConfiguration: jest.fn().mockReturnValue({
      dispose: jest.fn(),
    }),
  },
  ViewColumn: {
    One: 1,
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
}));

jest.mock('../get_ls_webview_content');
jest.mock('../../log');

describe('KnowledgeGraphWebview', () => {
  let webview: vscode.Webview;
  let panel: vscode.WebviewPanel;
  let knowledgeGraphWebview: KnowledgeGraphWebview;

  const revealSpy = jest.fn();
  const onDidDisposeSpy = jest.fn();
  const disposeSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    webview = {} as vscode.Webview;
    panel = {
      webview,
      dispose: disposeSpy,
      onDidDispose: onDidDisposeSpy,
      reveal: revealSpy,
    } as unknown as vscode.WebviewPanel;

    jest.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel);
    jest.mocked(getWebviewContent).mockResolvedValue('<html>Mock Content</html>');
    jest.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
    jest.mocked(vscode.commands.registerCommand).mockReturnValue({
      dispose: jest.fn(),
    } as vscode.Disposable);

    knowledgeGraphWebview = new KnowledgeGraphWebview();
  });

  describe('start', () => {
    describe('when url is invalid', () => {
      it('should not register command for malformed URL', async () => {
        await knowledgeGraphWebview.start('not-a-url');

        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      });

      it('should not register command for empty URL', async () => {
        await knowledgeGraphWebview.start('');

        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      });
    });

    describe('when url is valid', () => {
      const validUrl = 'http://localhost:3000/knowledge-graph';

      it('should register command for valid URL', async () => {
        await knowledgeGraphWebview.start(validUrl);

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
          'gl.webview.knowledgeGraph.show',
          expect.any(Function),
        );
      });
    });

    describe('when command is not registered yet', () => {
      const validUrl = 'http://localhost:3000/knowledge-graph';

      it('should register the webview command', async () => {
        await knowledgeGraphWebview.start(validUrl);

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
          'gl.webview.knowledgeGraph.show',
          expect.any(Function),
        );
      });

      it('should update the context to indicate knowledge graph is ready', async () => {
        await knowledgeGraphWebview.start(validUrl);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          'setContext',
          'gitlab:knowledgeGraphReady',
          true,
        );
      });
    });

    describe('when command is already registered', () => {
      const validUrl = 'http://localhost:3000/knowledge-graph';

      it('should not register the command and update the context again', async () => {
        await knowledgeGraphWebview.start(validUrl);
        jest.clearAllMocks();

        await knowledgeGraphWebview.start(validUrl);

        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      });
    });
  });

  describe('registered command behavior', () => {
    const validUrl = 'http://localhost:3000/knowledge-graph';
    let commandHandler: () => Promise<vscode.WebviewPanel>;

    beforeEach(async () => {
      await knowledgeGraphWebview.start(validUrl);
      const [, handler] = jest.mocked(vscode.commands.registerCommand).mock.calls[0];
      commandHandler = handler;
    });

    describe('when panel does not exist', () => {
      it('should create webview panel with correct parameters', async () => {
        await commandHandler();

        expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
          KNOWLEDGE_GRAPH_WEBVIEW_ID,
          'Knowledge Graph',
          {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true,
          },
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          },
        );
      });

      it('should set correct HTML content for the webview', async () => {
        await commandHandler();

        expect(getWebviewContent).toHaveBeenCalledWith(new URL(validUrl), 'Knowledge Graph');
        expect(webview.html).toBe('<html>Mock Content</html>');
      });

      it('should setup onDidDispose handler', async () => {
        await commandHandler();

        expect(onDidDisposeSpy).toHaveBeenCalledWith(expect.any(Function));
      });

      it('should return the created panel', async () => {
        const result = await commandHandler();

        expect(result).toBe(panel);
      });
    });

    describe('when panel already exists', () => {
      beforeEach(async () => {
        await commandHandler();
        jest.clearAllMocks();
      });

      it('should reveal existing panel instead of creating new one', async () => {
        const result = await commandHandler();

        expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
        expect(revealSpy).toHaveBeenCalledWith(vscode.ViewColumn.One);
        expect(result).toBe(panel);
      });
    });

    describe('when panel is disposed', () => {
      it('should reset panel reference on disposal', async () => {
        await commandHandler();

        const onDidDisposeHandler = onDidDisposeSpy.mock.calls[0][0];
        onDidDisposeHandler();

        jest.clearAllMocks();
        await commandHandler();

        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        expect(revealSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('dispose', () => {
    it('should dispose the command when called', async () => {
      const mockDispose = jest.fn();
      jest.mocked(vscode.commands.registerCommand).mockReturnValue({
        dispose: mockDispose,
      } as vscode.Disposable);

      await knowledgeGraphWebview.start('http://localhost:3000/test');
      knowledgeGraphWebview.dispose();

      expect(mockDispose).toHaveBeenCalledTimes(1);
    });
  });
});
