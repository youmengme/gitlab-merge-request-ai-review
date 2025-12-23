const { Uri } = require('../desktop/test_utils/uri');
const { EventEmitter } = require('../desktop/test_utils/event_emitter');
const { FileType } = require('../desktop/test_utils/file_type');
const { FileSystemError } = require('../desktop/test_utils/file_system_error');
const { Position } = require('../common/test_utils/position');
const { Selection } = require('../common/test_utils/selection');
const { Range } = require('../common/test_utils/range');
const { TabInputText } = require('../common/test_utils/tab_input_text');

const returnsDisposable = () => jest.fn().mockReturnValue({ dispose: jest.fn() });

class Disposable {
  constructor(callback) {
    this.dispose = typeof callback === 'function' ? callback : () => {};
  }

  static from(...items) {
    return new Disposable(() => {
      items.forEach(i => i.dispose());
    });
  }
}

module.exports = {
  Disposable,
  TreeItem: function TreeItem(labelOrUri, collapsibleState) {
    this.collapsibleState = collapsibleState;
    if (typeof labelOrUri === 'string') {
      this.label = labelOrUri;
    } else {
      this.resourceUri = labelOrUri;
    }
  },
  ThemeIcon: function ThemeIcon(id) {
    return { id };
  },
  EventEmitter,
  TreeItemCollapsibleState: {
    Collapsed: 'collapsed',
  },
  MarkdownString: function MarkdownString(value, supportThemeIcons) {
    this.value = value;
    this.supportThemeIcons = supportThemeIcons;
  },
  Uri,
  TabInputText,
  authentication: {
    getSession: jest.fn(),
    onDidChangeSessions: jest.fn(),
  },
  comments: {
    createCommentController: jest.fn(),
  },
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createStatusBarItem: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showSaveDialog: jest.fn(),
    withProgress: jest.fn().mockImplementation((opt, callback) => callback()),
    createQuickPick: jest.fn(),
    onDidChangeTextEditorSelection: jest.fn(),
    onDidChangeVisibleTextEditors: jest.fn(),
    onDidChangeTextEditorVisibleRanges: jest.fn(),
    onDidChangeActiveTextEditor: jest.fn(),
    onDidChangeActiveColorTheme: jest.fn(),
    onDidChangeTerminalShellIntegration: jest.fn(),
    onDidEndTerminalShellExecution: jest.fn(),
    onDidCloseTerminal: jest.fn(),
    createTerminal: jest.fn(),
    createWebviewPanel: jest.fn(),
    showTextDocument: jest.fn(),
    tabGroups: {
      activeTabGroup: {},
      all: [],
    },
    createTextEditorDecorationType: jest.fn(),
    registerWebviewViewProvider: jest.fn(),
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: returnsDisposable(),
  },
  languages: {
    registerInlineCompletionItemProvider: returnsDisposable(),
    registerCompletionItemProvider: jest.fn(),
    registerCodeActionsProvider: jest.fn(),
    getDiagnostics: jest.fn(),
    onDidChangeDiagnostics: jest.fn(),
  },
  workspace: {
    openTextDocument: jest.fn(),
    getConfiguration: jest.fn().mockReturnValue({ get: jest.fn() }),
    onDidOpenTextDocument: jest.fn(),
    onDidChangeConfiguration: returnsDisposable(),
    onDidChangeTextDocument: jest.fn(),
    onDidSaveTextDocument: returnsDisposable(),
    onDidCloseTextDocument: jest.fn(),
    createFileSystemWatcher: jest.fn(),
    getWorkspaceFolder: jest.fn(),
    registerTextDocumentContentProvider: jest.fn(),
    textDocuments: [],
    applyEdit: jest.fn(),
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
  },
  UIKind: {
    Desktop: 1,
    Web: 2,
  },
  extensions: {
    getExtension: jest.fn(),
  },
  env: {
    isTelemetryEnabled: true,
    uriScheme: 'vscode',
    clipboard: {
      writeText: jest.fn(),
      readText: jest.fn(),
    },
    onDidChangeTelemetryEnabled: jest.fn(),
    openExternal: jest.fn(),
    appName: 'test-app-name',
    asExternalUri: jest.fn(),
    env: {
      UIKind: 'desktop',
    },
  },
  CommentMode: { Editing: 0, Preview: 1 },
  StatusBarAlignment: { Left: 0 },
  CommentThreadCollapsibleState: { Collapsed: 0, Expanded: 1 },
  CommentThreadState: { Unresolved: 0, Resolved: 1 },
  Position,
  Selection,
  Range,
  CancellationTokenSource: function CancellationTokenSource() {
    const controller = new AbortController();

    return {
      token: {
        get isCancellationRequested() {
          return controller.signal.aborted;
        },
        set isCancellationRequested(val) {
          throw new Error(
            'Cannot set isCancellationRequested. Try using the CancellationTokenSource.',
          );
        },
        onCancellationRequested(callback) {
          controller.signal.addEventListener('abort', callback);

          return {
            dispose() {
              controller.signal.removeEventListener('abort', callback);
            },
          };
        },
      },
      cancel() {
        controller.abort();
      },
    };
  },
  ThemeColor: jest.fn(color => color),
  ProgressLocation: {
    Notification: 'Notification',
  },
  FoldingRange: function FoldingRange(start, end, kind) {
    return { start, end, kind };
  },
  FoldingRangeKind: {
    Region: 3,
  },
  FileType,
  FileSystemError,
  ViewColumn: {
    Active: -1,
  },
  InlineCompletionTriggerKind: {
    Automatic: true,
  },
  CompletionItemKind: {
    Snippet: 14,
    Text: 0,
  },
  InlineCompletionItem: function InlineCompletionItem(insertText, range, command) {
    this.insertText = insertText;
    this.range = range;
    this.command = command;
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
  CompletionItem: function CompletionItem(label, kind) {
    return { label, kind };
  },
  CodeLens: jest.fn(),
  DocumentLink: jest.fn(),
  CodeAction: function CodeAction(label, kind) {
    return { label, kind };
  },
  CodeActionKind: {
    QuickFix: 'quickfix',
    Refactor: 'refactor',
    Source: 'source',
  },
  Diagnostic: jest.fn(),
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  CallHierarchyItem: jest.fn(),
  TypeHierarchyItem: jest.fn(),
  SymbolInformation: jest.fn(),
  InlayHint: jest.fn(),
  CancellationError: jest.fn(),
  QuickPickItemKind: { Separator: -1 },
  SnippetString: jest.fn(),
  WorkspaceEdit: function WorkspaceEdit() {
    this.set = jest.fn();
    this.get = jest.fn();
    this.has = jest.fn();
    this.delete = jest.fn();
    this.size = 0;
    this.allEntries = jest.fn().mockReturnValue([]);
  },
  version: 'vscode-test-version-0.0',
};
