import * as vscode from 'vscode';
import {
  getLocalFeatureFlagService,
  LocalFeatureFlagService,
} from '../../feature_flags/local_feature_flag_service';
import { COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT } from '../constants';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { asMutable } from '../../test_utils/types';
import { createMockTextDocument } from '../../__mocks__/mock_text_document';
import { FixWithDuoQuickChatActionProvider } from './fix_with_duo_quick_chat_action_provider';

jest.mock('../../feature_flags/local_feature_flag_service');

describe('FixWithDuoQuickChatActionProvider', () => {
  let provider: FixWithDuoQuickChatActionProvider;
  let mockDocument: vscode.TextDocument;
  let mockContext: vscode.CodeActionContext;
  let mockDiagnostics: vscode.Diagnostic[];
  let mockDiagnosticsRange: vscode.Range;
  let mockEditorSelectionRange: vscode.Range;

  beforeEach(() => {
    provider = new FixWithDuoQuickChatActionProvider();
    mockDiagnosticsRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10));
    mockEditorSelectionRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(1, 10),
    );
    mockDocument = createMockTextDocument();
    mockDiagnostics = [
      createFakePartial<vscode.Diagnostic>({
        message: 'Test error message',
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 5)),
      }),
    ];
    mockContext = createFakePartial<vscode.CodeActionContext>({
      diagnostics: mockDiagnostics,
    });

    asMutable(vscode.window).activeTextEditor = createFakePartial<vscode.TextEditor>({
      document: mockDocument,
      selection: mockEditorSelectionRange,
    });

    vscode.languages.getDiagnostics = jest.fn().mockReturnValue(mockDiagnostics);
  });

  describe('provideCodeActions', () => {
    describe('when feature flag is disabled', () => {
      beforeEach(() => {
        jest
          .mocked(getLocalFeatureFlagService)
          .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => false }));
      });

      it('returns an empty array', async () => {
        const actions = await provider.provideCodeActions(
          mockDocument,
          mockDiagnosticsRange,
          mockContext,
        );
        expect(actions).toEqual([]);
      });
    });

    describe('when feature flag is enabled', () => {
      beforeEach(() => {
        jest
          .mocked(getLocalFeatureFlagService)
          .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => true }));
      });

      it('returns empty array if no active editor', async () => {
        asMutable(vscode.window).activeTextEditor = undefined;
        const actions = await provider.provideCodeActions(
          mockDocument,
          mockDiagnosticsRange,
          mockContext,
        );
        expect(actions).toEqual([]);
      });

      it('returns both quickfix and source actions when no filter is provided', async () => {
        const actions = await provider.provideCodeActions(
          mockDocument,
          mockDiagnosticsRange,
          mockContext,
        );

        expect(actions).toHaveLength(2);
        expect(actions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ kind: vscode.CodeActionKind.QuickFix }),
            expect.objectContaining({ kind: vscode.CodeActionKind.Source }),
          ]),
        );
      });

      describe('when requesting QuickFix code actions', () => {
        beforeEach(() => {
          asMutable(mockContext).only = createFakePartial<vscode.CodeActionKind>({
            contains: (kind: vscode.CodeActionKind) => kind === vscode.CodeActionKind.QuickFix,
            value: 'quickfix',
          });
        });

        it('returns only Quick Fix action', async () => {
          const actions = await provider.provideCodeActions(
            mockDocument,
            mockDiagnosticsRange,
            mockContext,
          );

          expect(actions).toEqual([
            expect.objectContaining({ kind: vscode.CodeActionKind.QuickFix }),
          ]);
        });

        it('code action contains diagnostics', async () => {
          const actions = await provider.provideCodeActions(
            mockDocument,
            mockDiagnosticsRange,
            mockContext,
          );

          const quickFixAction = actions?.at(0);
          expect(quickFixAction?.diagnostics).toEqual(mockDiagnostics);
        });

        it('formats a single diagnostic correctly', async () => {
          const diagnostic = createFakePartial<vscode.Diagnostic>({
            message: 'Missing semicolon',
            range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
          });
          asMutable(mockContext).diagnostics = [diagnostic];

          const actions = await provider.provideCodeActions(
            mockDocument,
            mockDiagnosticsRange,
            mockContext,
          );
          const action = actions?.at(0);

          const quickChatOptions = action?.command?.arguments?.at(0);
          expect(quickChatOptions.message).toBe('/fix `Missing semicolon` on line 2');
        });

        it('formats multiple diagnostics correctly', async () => {
          asMutable(mockContext).diagnostics = [
            createFakePartial<vscode.Diagnostic>({
              message: 'Missing semicolon',
              range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
            }),
            createFakePartial<vscode.Diagnostic>({
              message: 'Unused variable',
              range: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 10)),
            }),
          ];

          const actions = await provider.provideCodeActions(
            mockDocument,
            mockDiagnosticsRange,
            mockContext,
          );
          const action = actions?.at(0);

          const quickChatOptions = action?.command?.arguments?.at(0);
          expect(quickChatOptions.message).toContain('/fix multiple issues:');
          expect(quickChatOptions.message).toContain('`Missing semicolon` on line 2');
          expect(quickChatOptions.message).toContain('`Unused variable` on line 3');
        });
      });

      describe('when requesting Source code actions', () => {
        beforeEach(() => {
          asMutable(mockContext).only = createFakePartial<vscode.CodeActionKind>({
            contains: (kind: vscode.CodeActionKind) => kind === vscode.CodeActionKind.Source,
            value: 'source',
          });
        });

        describe('when the document has diagnostics', () => {
          it('returns expected Source action', async () => {
            const actions = await provider.provideCodeActions(
              mockDocument,
              mockDiagnosticsRange,
              mockContext,
            );

            expect(actions).toEqual([
              expect.objectContaining({
                kind: vscode.CodeActionKind.Source,
                command: expect.objectContaining({
                  command: COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT,
                  title: 'Fix with GitLab Duo',
                  arguments: expect.arrayContaining([
                    expect.objectContaining({
                      message: '/fix',
                    }),
                  ]),
                }),
              }),
            ]);
          });

          it('creates a range covering the entire document', async () => {
            const actions = await provider.provideCodeActions(
              mockDocument,
              mockDiagnosticsRange,
              mockContext,
            );

            const sourceAction = actions?.at(0);
            const quickChatOptions = sourceAction?.command?.arguments?.at(0);

            expect(quickChatOptions.range.start.line).toBe(0);
            expect(quickChatOptions.range.start.character).toBe(0);
            expect(quickChatOptions.range.end.line).toBe(2);
            expect(quickChatOptions.range.end.character).toBe(10);
          });
        });

        describe('when the document has no diagnostics', () => {
          beforeEach(() => {
            asMutable(vscode.languages).getDiagnostics = jest.fn().mockReturnValue([]);
          });

          it('returns empty array', async () => {
            const actions = await provider.provideCodeActions(
              mockDocument,
              mockDiagnosticsRange,
              mockContext,
            );

            expect(actions).toHaveLength(0);
          });
        });
      });

      describe('when requesting an unknown code action', () => {
        beforeEach(() => {
          asMutable(mockContext).only = createFakePartial<vscode.CodeActionKind>({
            contains: () => false,
            value: 'unknown',
          });
        });

        it('returns empty array', async () => {
          const actions = await provider.provideCodeActions(
            mockDocument,
            mockDiagnosticsRange,
            mockContext,
          );

          expect(actions).toEqual([]);
        });
      });

      describe('getCodeActionRange', () => {
        describe.each([
          {
            name: 'when editor selection is not empty',
            diagnosticRange: { start: [1, 5], end: [2, 10] },
            editorSelection: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(4, 0)),
            expected: { start: [0, 0], end: [4, 0] },
          },
          {
            name: 'when editor selection is empty and diagnostic range is not',
            diagnosticRange: { start: [1, 5], end: [2, 10] },
            editorSelection: new vscode.Selection(0, 0, 0, 0),
            expected: { start: [1, 5], end: [2, 10] },
          },
          {
            name: 'when diagnostic range is zero-width and needs to be expanded to the full line',
            diagnosticRange: { start: [1, 0], end: [1, 0] }, // Zero-width range
            editorSelection: new vscode.Selection(0, 0, 0, 0),
            expected: { start: [1, 0], end: [1, 11] },
          },
        ])('$name', ({ diagnosticRange, editorSelection, expected }) => {
          let diagnosticsRange: vscode.Range;

          beforeEach(() => {
            diagnosticsRange = new vscode.Range(
              new vscode.Position(diagnosticRange.start[0], diagnosticRange.start[1]),
              new vscode.Position(diagnosticRange.end[0], diagnosticRange.end[1]),
            );

            mockEditorSelectionRange = editorSelection;
            asMutable(vscode.window).activeTextEditor = createFakePartial<vscode.TextEditor>({
              document: mockDocument,
              selection: mockEditorSelectionRange,
            });
          });

          it('creates expected range', async () => {
            const actions = await provider.provideCodeActions(
              mockDocument,
              diagnosticsRange,
              mockContext,
            );

            const action = actions?.at(0);
            const quickChatOptions = action?.command?.arguments?.at(0);

            expect(quickChatOptions.range.start.line).toBe(expected.start[0]);
            expect(quickChatOptions.range.start.character).toBe(expected.start[1]);
            expect(quickChatOptions.range.end.line).toBe(expected.end[0]);
            expect(quickChatOptions.range.end.character).toBe(expected.end[1]);
          });
        });
      });
    });
  });
});
