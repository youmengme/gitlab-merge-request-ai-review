import vscode, { CommentThreadCollapsibleState } from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { COMMENT_CONTROLLER_ID } from './utils';
import { QuickChatGutterIcon } from './quick_chat_gutter_icon';

const mockDecorationType = createFakePartial<vscode.TextEditorDecorationType>({
  dispose: jest.fn(),
});

describe('QuickChatGutterIcon', () => {
  let gutterIcon: QuickChatGutterIcon;
  let mockExtensionContext: vscode.ExtensionContext;
  let mockEditor: vscode.TextEditor;
  let mockFileUri: vscode.Uri;

  beforeEach(() => {
    mockExtensionContext = createFakePartial<vscode.ExtensionContext>({
      extensionUri: vscode.Uri.file('/foo/bar'),
    });

    mockFileUri = vscode.Uri.file('test/file.ts');
    mockEditor = createFakePartial<vscode.TextEditor>({
      selection: createFakePartial<vscode.Selection>({ active: new vscode.Position(0, 0) }),
      document: createFakePartial<vscode.TextDocument>({
        lineAt: jest.fn().mockReturnValue({ isEmptyOrWhitespace: true }),
        uri: mockFileUri, // Default to a file URI
      }),
      setDecorations: jest.fn(),
    });
    vscode.window.activeTextEditor = mockEditor;
    vscode.workspace.getConfiguration = jest
      .fn()
      .mockReturnValue({ keybindingHints: { enabled: true } });

    jest.mocked(vscode.window.createTextEditorDecorationType).mockReturnValue(mockDecorationType);
    gutterIcon = new QuickChatGutterIcon(mockExtensionContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates gutter icon decoration', () => {
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalledWith({
        gutterIconPath: vscode.Uri.joinPath(
          mockExtensionContext.extensionUri,
          'assets/icons/gitlab-duo-quick-chat.svg',
        ),
      });
    });
  });

  describe('reset decorations', () => {
    it('resetGutterIcon', () => {
      gutterIcon.resetGutterIcon(mockEditor);
      expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, []);
    });
  });

  describe('toggleGutterIcon', () => {
    beforeEach(() => {
      gutterIcon.resetGutterIcon = jest.fn();
    });

    describe('hides gutter icon', () => {
      it('when thread is collapsed', () => {
        const mockThread = createFakePartial<vscode.CommentThread>({
          comments: [],
          range: new vscode.Range(0, 0, 0, 0),
          uri: mockFileUri,
          collapsibleState: CommentThreadCollapsibleState.Collapsed,
        });
        gutterIcon.toggleGutterIcon(mockThread);

        // icon is disposed
        expect(gutterIcon.resetGutterIcon).toHaveBeenCalled();

        // setDecorations is not called to create an icon decoration
        expect(mockEditor.setDecorations).not.toHaveBeenCalled();
      });

      it('for different documents', () => {
        const mockThread = createFakePartial<vscode.CommentThread>({
          comments: [],
          range: new vscode.Range(0, 0, 0, 0),
          uri: vscode.Uri.file('test/notActiveFile.ts'),
          collapsibleState: CommentThreadCollapsibleState.Expanded,
        });
        gutterIcon.toggleGutterIcon(mockThread);

        // icon is disposed
        expect(gutterIcon.resetGutterIcon).toHaveBeenCalled();
        // setDecorations is not called to create an icon decoration
        expect(mockEditor.setDecorations).not.toHaveBeenCalled();
      });
    });

    describe('shows gutter icon ', () => {
      it('when in comment input', async () => {
        const mockThread = createFakePartial<vscode.CommentThread>({
          comments: [],
          range: new vscode.Range(0, 0, 0, 0),
          uri: mockFileUri,
          collapsibleState: CommentThreadCollapsibleState.Expanded,
        });
        // Create new mock editor with comment input URI
        const commentInputEditor = createFakePartial<vscode.TextEditor>({
          document: {
            uri: createFakePartial<vscode.Uri>({
              authority: COMMENT_CONTROLLER_ID,
              scheme: 'comment',
            }),
          },
          selection: new vscode.Selection(0, 0, 0, 0),
          setDecorations: jest.fn(),
        });

        (vscode.window.visibleTextEditors as unknown) = [mockEditor];
        (vscode.window.activeTextEditor as unknown) = commentInputEditor;

        gutterIcon.toggleGutterIcon(mockThread);

        // icon is disposed in active editor NOT comment input editor
        expect(gutterIcon.resetGutterIcon).toHaveBeenCalledWith(mockEditor);

        // setDecorations is called with active editor NOT comment input editor
        expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, [
          { range: new vscode.Range(mockThread.range.end, mockThread.range.end) },
        ]);
      });

      it('when in active editor', () => {
        const mockThread = createFakePartial<vscode.CommentThread>({
          comments: [],
          range: new vscode.Range(0, 0, 0, 0),
          uri: mockFileUri,
          collapsibleState: CommentThreadCollapsibleState.Expanded,
        });
        gutterIcon.toggleGutterIcon(mockThread);
        // icon is disposed
        expect(gutterIcon.resetGutterIcon).toHaveBeenCalled();
        // setDecorations is called to create an icon decoration
        expect(mockEditor.setDecorations).toHaveBeenCalledWith(mockDecorationType, [
          { range: new vscode.Range(mockThread.range.end, mockThread.range.end) },
        ]);
      });
    });
  });
});
