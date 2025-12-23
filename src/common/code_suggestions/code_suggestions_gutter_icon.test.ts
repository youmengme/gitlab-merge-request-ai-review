import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { createExtensionContext } from '../test_utils/entities';
import { CodeSuggestionsGutterIcon } from './code_suggestions_gutter_icon';
import {
  CodeSuggestionsStateManager,
  VisibleCodeSuggestionsState,
} from './code_suggestions_state_manager';

describe('CodeSuggestionsGutterIcon', () => {
  let codeSuggestionsStateManager: CodeSuggestionsStateManager;
  let context: vscode.ExtensionContext;
  let mockStateChangeEmitter: vscode.EventEmitter<VisibleCodeSuggestionsState>;
  let setDecorationsSpy: jest.Mock;
  let subject: CodeSuggestionsGutterIcon;
  let textEditorDecorationTypeMap: Map<string, vscode.TextEditorDecorationType>;
  let activeTextEditorSelection: { start: { line: number } };

  const triggerTextEditorSelectionChange = (e: vscode.TextEditorSelectionChangeEvent) => {
    jest
      .mocked(vscode.window.onDidChangeTextEditorSelection)
      .mock.calls.forEach(([listener]) => listener(e));
  };

  const triggerActiveTextEditorChange = (e: vscode.TextEditor | undefined) => {
    jest
      .mocked(vscode.window.onDidChangeActiveTextEditor)
      .mock.calls.forEach(([listener]) => listener(e));
  };

  beforeEach(() => {
    textEditorDecorationTypeMap = new Map<string, vscode.TextEditorDecorationType>();
    setDecorationsSpy = jest.fn();
    mockStateChangeEmitter = new vscode.EventEmitter<VisibleCodeSuggestionsState>();

    activeTextEditorSelection = {
      start: {
        line: 7,
      },
    };
    vscode.window.activeTextEditor = createFakePartial<vscode.TextEditor>({
      setDecorations: setDecorationsSpy,
      selection: activeTextEditorSelection,
      document: {},
    });
    jest
      .mocked(vscode.window.createTextEditorDecorationType)
      .mockImplementation(({ gutterIconPath = '' }) => {
        const textEditorDecorationType: vscode.TextEditorDecorationType = {
          dispose: jest.fn(),
          key: gutterIconPath.toString(),
        };

        textEditorDecorationTypeMap.set(textEditorDecorationType.key, textEditorDecorationType);

        return textEditorDecorationType;
      });
    jest.mocked(vscode.window.onDidChangeTextEditorSelection).mockReturnValue({
      dispose: jest.fn(),
    });
    jest.mocked(vscode.window.onDidChangeActiveTextEditor).mockReturnValue({
      dispose: jest.fn(),
    });

    context = createExtensionContext();
    codeSuggestionsStateManager = createFakePartial<CodeSuggestionsStateManager>({
      onDidChangeVisibleState: mockStateChangeEmitter.event,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    subject.dispose();
  });

  describe('default', () => {
    beforeEach(() => {
      subject = new CodeSuggestionsGutterIcon(context, codeSuggestionsStateManager);
    });

    it.each`
      state                                  | iconPath
      ${VisibleCodeSuggestionsState.LOADING} | ${'https://localhost/assets/icons/gitlab-code-suggestions-loading.svg'}
      ${VisibleCodeSuggestionsState.ERROR}   | ${'https://localhost/assets/icons/gitlab-code-suggestions-error.svg'}
    `(
      'when manager state changes to $state, updates decorations to $iconPath',
      ({ state, iconPath }) => {
        expect(setDecorationsSpy).not.toHaveBeenCalled();

        mockStateChangeEmitter.fire(state);

        expect(setDecorationsSpy).toHaveBeenCalledTimes(1);
        expect(setDecorationsSpy).toHaveBeenCalledWith(textEditorDecorationTypeMap.get(iconPath), [
          {
            range: {
              start: { line: 7 },
              end: { line: 7 },
            },
          },
        ]);
      },
    );

    it('when manager state changes to unhandled state, nothing happens', () => {
      mockStateChangeEmitter.fire(VisibleCodeSuggestionsState.READY);

      expect(setDecorationsSpy).not.toHaveBeenCalled();
    });

    it('when manager state changes then changes again, clears old decoration', () => {
      mockStateChangeEmitter.fire(VisibleCodeSuggestionsState.LOADING);
      setDecorationsSpy.mockClear();

      mockStateChangeEmitter.fire(VisibleCodeSuggestionsState.READY);

      const loadingDecoration = textEditorDecorationTypeMap.get(
        'https://localhost/assets/icons/gitlab-code-suggestions-loading.svg',
      );

      expect(setDecorationsSpy).toHaveBeenCalledTimes(1);
      expect(setDecorationsSpy).toHaveBeenCalledWith(loadingDecoration, []);
    });

    it('when manager state changes then text editor selection changes, clears and reapplies old decoration', () => {
      mockStateChangeEmitter.fire(VisibleCodeSuggestionsState.LOADING);
      setDecorationsSpy.mockClear();

      activeTextEditorSelection.start.line = 10;
      triggerTextEditorSelectionChange(
        createFakePartial<vscode.TextEditorSelectionChangeEvent>({}),
      );

      const loadingDecoration = textEditorDecorationTypeMap.get(
        'https://localhost/assets/icons/gitlab-code-suggestions-loading.svg',
      );

      expect(setDecorationsSpy).toHaveBeenCalledTimes(2);
      expect(setDecorationsSpy).toHaveBeenCalledWith(loadingDecoration, []);
      expect(setDecorationsSpy).toHaveBeenCalledWith(loadingDecoration, [
        {
          range: {
            start: { line: 10 },
            end: { line: 10 },
          },
        },
      ]);
    });

    it('with not active editor, when manager state changes, nothing happens', () => {
      vscode.window.activeTextEditor = undefined;
      mockStateChangeEmitter.fire(VisibleCodeSuggestionsState.LOADING);

      expect(setDecorationsSpy).not.toHaveBeenCalled();
    });

    it('clears current decoration when active text editor changes', () => {
      mockStateChangeEmitter.fire(VisibleCodeSuggestionsState.LOADING);

      triggerActiveTextEditorChange(createFakePartial<vscode.TextEditor>({}));

      const loadingDecoration = textEditorDecorationTypeMap.get(
        'https://localhost/assets/icons/gitlab-code-suggestions-loading.svg',
      );

      expect(setDecorationsSpy).toHaveBeenCalledTimes(2);
      expect(setDecorationsSpy).toHaveBeenCalledWith(loadingDecoration, [
        {
          range: {
            start: { line: 7 },
            end: { line: 7 },
          },
        },
      ]);
      expect(setDecorationsSpy).toHaveBeenCalledWith(loadingDecoration, []);
    });
  });

  describe('dispose', () => {
    it('disposes subscriptions', () => {
      const icon = new CodeSuggestionsGutterIcon(context, codeSuggestionsStateManager);
      icon.dispose();

      const disposeTextEditorSelection = jest.mocked(vscode.window.onDidChangeTextEditorSelection)
        .mock.results[0].value.dispose;

      expect(disposeTextEditorSelection).toHaveBeenCalled();
    });
  });
});
