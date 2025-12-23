import vscode, { MarkdownString } from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  QUICK_CHAT_EXPANDED_CONTEXT,
  QuickChatCommentThreadService,
} from './comment_thread_service';
import { COMMENT_CONTROLLER_ID } from './utils';

const mockFilePath = 'test/path/to/file.txt';
const mockFileUri = vscode.Uri.file(mockFilePath);

const mockDebug = jest.fn();

jest.mock('../log', () => {
  const originalModule = jest.requireActual('../log');
  const mockModule = jest.createMockFromModule<typeof originalModule>('../log');

  return {
    ...mockModule,
    log: {
      debug: jest.fn().mockImplementation(msg => mockDebug(msg)),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

const createNewMockThread = (range: vscode.Range) => {
  const mockThread = createFakePartial<vscode.CommentThread>({
    dispose: jest.fn(),
    range,
    comments: [],
    uri: mockFileUri,
  });

  return mockThread;
};

const mockCommentController = createFakePartial<vscode.CommentController>({
  createCommentThread: jest.fn((_uri, range) => createNewMockThread(range)),
  commentingRangeProvider: jest.mocked({}),
  options: jest.mocked({} as vscode.CommentOptions),
  dispose: jest.fn(),
});

const mockDocument = createFakePartial<vscode.TextDocument>({
  uri: mockFileUri,
});

describe('QuickChatCommentThreadService', () => {
  let commentThreadService: QuickChatCommentThreadService;
  const range = new vscode.Range(0, 0, 0, 10);

  beforeEach(() => {
    (vscode.comments.createCommentController as jest.Mock).mockReturnValue(mockCommentController);
    commentThreadService = new QuickChatCommentThreadService();
    commentThreadService.createCommentThread(
      mockFileUri,
      range,
      'Ask a question or give an instruction...',
    );
  });

  describe('constructor', () => {
    it('creates a comment controller with correct parameters', () => {
      expect(vscode.comments.createCommentController).toHaveBeenCalledWith(
        'duo-quick-chat',
        'Duo Quick Chat',
      );
    });
  });

  describe('createCommentThread', () => {
    it('call comment controller with correct parameters', () => {
      const testToken = createFakePartial<vscode.CancellationToken>({});

      expect(
        mockCommentController.commentingRangeProvider?.provideCommentingRanges(
          mockDocument,
          testToken,
        ),
      ).toEqual([new vscode.Range(range.end, range.end)]);

      expect(mockCommentController.createCommentThread).toHaveBeenCalledWith(
        mockFileUri,
        range,
        [],
      );
    });

    it('with initial state and label', () => {
      const thread = commentThreadService.getThread();
      expect(thread?.collapsibleState).toEqual(vscode.CommentThreadCollapsibleState.Expanded);
      expect(thread?.label).toEqual('Duo Quick Chat (include line 1)');
    });
  });

  describe('updateThreadSelection', () => {
    const mockEditor = createFakePartial<vscode.TextEditor>({
      document: { uri: mockFileUri },
      selection: range,
      setDecorations: jest.fn(),
    });

    it('updates thread label', () => {
      const thread = commentThreadService.getThread();
      expect(thread?.label).toEqual('Duo Quick Chat (include line 1)');
      const mockSelection = createFakePartial<vscode.Selection>({
        active: new vscode.Position(0, 0),
        start: new vscode.Position(1, 0),
        end: new vscode.Position(2, 0),
      });

      // select new set of selection in editor
      mockEditor.selection = mockSelection;
      commentThreadService.updateThreadSelection(mockFileUri, mockEditor);
      expect(mockDebug).toHaveBeenCalled();
      expect(thread?.label).toEqual('Duo Quick Chat (include lines 2-3)');
    });

    it('does not update thread label when selection is un-changed', () => {
      const thread = commentThreadService.getThread();
      expect(thread?.label).toEqual('Duo Quick Chat (include line 1)');
      const mockSelection = createFakePartial<vscode.Selection>({
        active: new vscode.Position(0, 0),
        start: new vscode.Position(0, 0),
        end: new vscode.Position(0, 10),
      });
      // select the same set of selection in editor
      mockEditor.selection = mockSelection;
      commentThreadService.updateThreadSelection(mockFileUri, mockEditor);
      expect(mockDebug).not.toHaveBeenCalled();
      expect(thread?.label).toEqual('Duo Quick Chat (include line 1)');
    });

    it('should not update the label when the thread comment is in focus', () => {
      const editorWithThreadFocused = createFakePartial<vscode.TextEditor>({
        document: {
          lineAt: jest.fn(),
          uri: {
            scheme: 'comment',
            authority: COMMENT_CONTROLLER_ID,
          },
        },
        selection: range,
      });
      commentThreadService.updateThreadSelection(mockFileUri, editorWithThreadFocused);
      expect(mockDebug).not.toHaveBeenCalled();
    });
  });

  describe('updateThreadRange', () => {
    const createChange = (startLine: number, text: string) =>
      createFakePartial<vscode.TextDocumentContentChangeEvent>({
        range: new vscode.Range(startLine, 0, startLine, 0),
        text,
      });
    const mockRange = new vscode.Range(0, 0, 5, 10);

    beforeEach(() => {
      commentThreadService.createCommentThread(
        mockFileUri,
        mockRange,
        'Ask a question or give an instruction...',
      );
    });

    it('returns null for invalid inputs or changes after thread', () => {
      commentThreadService.updateThreadRange(createChange(0, ''));
      const thread = commentThreadService.getThread();
      expect(thread?.range).toEqual(mockRange);

      commentThreadService.updateThreadRange(null);
      expect(thread?.range).toEqual(mockRange);

      commentThreadService.updateThreadRange(createChange(6, '\n'));
      expect(thread?.range).toEqual(mockRange);
    });

    it('adjusts thread position when adding lines', () => {
      commentThreadService.updateThreadRange(createChange(2, 'new\n'));
      const thread = commentThreadService.getThread();
      expect(thread?.range.end.line).toBe(6);
    });

    it('adjusts thread position when removing lines', () => {
      commentThreadService.updateThreadRange(createChange(2, ''));
      const thread = commentThreadService.getThread();
      expect(thread?.range.end.line).toBe(5);
    });
  });

  describe('hideThread', () => {
    it('can collapse thread', () => {
      const thread = commentThreadService.getThread();
      expect(thread?.collapsibleState).toEqual(vscode.CommentThreadCollapsibleState.Expanded);
      commentThreadService.hideThread();
      expect(thread?.collapsibleState).toEqual(vscode.CommentThreadCollapsibleState.Collapsed);
    });
  });

  describe('manage comments', () => {
    it('addUserComment', () => {
      commentThreadService.addUserComment('this is user');
      const thread = commentThreadService.getThread();
      expect(thread?.comments.length).toEqual(1);
      const comment = thread?.comments[0];
      expect(comment).toEqual({
        body: 'this is user',
        mode: vscode.CommentMode.Preview,
        author: { name: 'You' },
        contextValue: 'user',
      });
    });

    it('addLoaderComment', () => {
      commentThreadService.addLoaderComment();
      const thread = commentThreadService.getThread();
      expect(thread?.comments.length).toEqual(1);
      const comment = thread?.comments[0];
      expect(comment).toEqual({
        body: expect.objectContaining({
          value: '<b>GitLab Duo Chat</b> is finding an answer',
          supportHtml: true,
        }),
        mode: vscode.CommentMode.Preview,
        author: { name: '' },
        contextValue: 'loader',
      });
    });

    describe('addResponseComment', () => {
      it('adds comment when previous comment is not response comment', () => {
        const response = new MarkdownString('mock response');
        commentThreadService.addResponseComment(response);
        const thread = commentThreadService.getThread();
        expect(thread?.comments.length).toEqual(1);
        const comment = thread?.comments[0];
        expect(comment).toEqual({
          body: response,
          mode: vscode.CommentMode.Preview,
          author: { name: 'Duo' },
          contextValue: 'response',
        });
      });

      it('skips when previous comment is response comment', () => {
        const addedResponse = new MarkdownString('expected');
        const skippedResponse = new MarkdownString('not expected');
        commentThreadService.addResponseComment(addedResponse);
        commentThreadService.addResponseComment(skippedResponse);
        const thread = commentThreadService.getThread();
        expect(thread?.comments.length).toEqual(1);
        const comment = thread?.comments[0];

        expect(comment).toEqual({
          body: addedResponse,
          mode: vscode.CommentMode.Preview,
          author: { name: 'Duo' },
          contextValue: 'response',
        });
      });
    });

    it('clearComments', () => {
      commentThreadService.addUserComment('this is user');
      commentThreadService.addLoaderComment();
      const thread = commentThreadService.getThread();
      expect(thread?.comments.length).toEqual(2);
      commentThreadService.clearComments();
      expect(thread?.comments.length).toEqual(0);
    });

    it('addResetComment', () => {
      commentThreadService.addResetComment();
      const thread = commentThreadService.getThread();
      expect(thread?.comments.length).toEqual(1);
      const comment = thread?.comments[0];
      expect(comment).toEqual({
        body: expect.objectContaining({
          value: '<hr /><em>New chat</em>',
          supportHtml: true,
        }),
        mode: vscode.CommentMode.Preview,
        author: { name: '' },
        contextValue: 'reset',
      });
    });

    describe('setLoadingContext', () => {
      it('executes setContext command with correct parameters', async () => {
        await commentThreadService.setLoadingContext(true);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          'setContext',
          'duoCommentLoading',
          true,
        );
      });
    });

    describe('setOpenInDocContext', () => {
      const diffDocumentUri = vscode.Uri.file('test/path/to/differentFile.txt');

      it.each`
        message  | documentUri         | isExpanded | quickChatOpen
        ${''}    | ${mockDocument.uri} | ${true}    | ${true}
        ${''}    | ${mockDocument.uri} | ${false}   | ${false}
        ${'not'} | ${diffDocumentUri}  | ${true}    | ${false}
        ${'not'} | ${diffDocumentUri}  | ${false}   | ${false}
      `(
        'when thread is $message in given document and its isExpanded is $isExpanded, gitlab:quickChatOpen should be set to $quickChatOpen',
        async ({ documentUri, isExpanded, quickChatOpen }) => {
          if (!isExpanded) {
            await commentThreadService.hideThread();
          }
          await commentThreadService.setOpenInDocContext(documentUri);
          expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            QUICK_CHAT_EXPANDED_CONTEXT,
            quickChatOpen,
          );
        },
      );
    });
  });
});
