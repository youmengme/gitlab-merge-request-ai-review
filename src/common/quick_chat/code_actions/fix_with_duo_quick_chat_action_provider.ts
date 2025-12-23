import vscode from 'vscode';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../../feature_flags/local_feature_flag_service';
import {
  COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT,
  QUICK_CHAT_OPEN_TRIGGER,
} from '../constants';
import type { QuickChatOpenOptions } from '../quick_chat_state';
import { log } from '../../log';

const CODE_ACTION_LABEL = 'Fix with GitLab Duo';

export class FixWithDuoQuickChatActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Source,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    diagnosticsRange: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const featureFlagEnabled = getLocalFeatureFlagService().isEnabled(
      FeatureFlag.FixWithDuoQuickChatCodeActions,
    );
    if (!featureFlagEnabled) {
      return [];
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return [];
    }

    const diagnostics = [...context.diagnostics];

    const quickFixAction = this.#getQuickFixAction(
      diagnostics,
      document,
      diagnosticsRange,
      editor.selection,
    );

    const sourceAction = this.#getSourceAction(document);

    if (!context.only) {
      return sourceAction ? [quickFixAction, sourceAction] : [quickFixAction];
    }

    if (context.only.contains(vscode.CodeActionKind.QuickFix)) {
      return [quickFixAction];
    }

    if (context.only.contains(vscode.CodeActionKind.Source)) {
      return sourceAction ? [sourceAction] : [];
    }

    log.warn(
      `[FixWithDuoQuickChatActionProvider] Unknown CodeActionKind requested: "${context.only.value}"`,
    );
    return [];
  }

  #createCodeAction(
    kind: vscode.CodeActionKind,
    options: QuickChatOpenOptions,
    diagnostics: vscode.Diagnostic[] = [],
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(CODE_ACTION_LABEL, kind);
    action.command = {
      command: COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT,
      title: CODE_ACTION_LABEL,
      arguments: [options],
    };
    action.diagnostics = [...diagnostics];

    return action;
  }

  #getQuickFixAction(
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    diagnosticsRange: vscode.Range,
    selectionRange: vscode.Selection,
  ): vscode.CodeAction {
    const quickChatOpenOptions: QuickChatOpenOptions = {
      trigger: QUICK_CHAT_OPEN_TRIGGER.CODE_ACTION_FIX_WITH_DUO,
      document,
      range: this.#getCodeActionRange(diagnosticsRange, selectionRange, document),
      message: this.#getFixMessage(diagnostics),
    };

    return this.#createCodeAction(
      vscode.CodeActionKind.QuickFix,
      quickChatOpenOptions,
      diagnostics,
    );
  }

  #getSourceAction(document: vscode.TextDocument): vscode.CodeAction | undefined {
    // When VSCode calls the code action provider for "source" code actions, it does not pass in any array of diagnostics errors for the document.
    // This is because in VSCode source actions can be unrelated to fixing issues (e.g. 'organise imports'). So for our own "/fix" source action,
    // we need to explicitly get diagnostics for the document and early-exit if the document has no issues. This matches the Jetbrains implementation.
    const allDocumentDiagnostics = vscode.languages.getDiagnostics(document.uri);
    if (!allDocumentDiagnostics.length) {
      return undefined;
    }

    // Since a "source" action targets the entire document, we provide the whole doc range rather than scoping to specific diagnostics
    const diagnosticsRange = new vscode.Range(
      0,
      0,
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length,
    );

    // A "source" action cannot be triggered if the editor has a selection, as it applies to the entire document
    const emptyEditorSelection = new vscode.Selection(0, 0, 0, 0);

    const quickChatOpenOptions: QuickChatOpenOptions = {
      trigger: QUICK_CHAT_OPEN_TRIGGER.CODE_ACTION_FIX_WITH_DUO,
      document,
      range: this.#getCodeActionRange(diagnosticsRange, emptyEditorSelection, document),
      message: this.#getFixMessage([]),
    };

    return this.#createCodeAction(vscode.CodeActionKind.Source, quickChatOpenOptions);
  }

  /**
   * Gets the appropriate range for a code action, prioritizing user selection.
   * If the user has an active selection, use that range.
   * Otherwise, use the provided range (which encompasses the diagnostics).
   * Expands to full line if the range is a single point.
   */
  #getCodeActionRange(
    diagnosticsRange: vscode.Range,
    editorSelection: vscode.Selection,
    document: vscode.TextDocument,
  ): vscode.Range {
    if (!editorSelection.isEmpty) {
      return editorSelection;
    }

    if (diagnosticsRange.start.isEqual(diagnosticsRange.end)) {
      // Sometimes, diagnostics range is a single position/character where the error occurs, so start/end position will be equal.
      // This results in a zero-width Range, so no code would be captured, and we must send code with the `/fix` command.
      // So in this case we expand the range to include the full line of code, so that /fix has some content to work with.
      const lineNumber = diagnosticsRange.start.line;
      return document.lineAt(lineNumber).range;
    }

    return diagnosticsRange;
  }

  /**
   * Formats a `/fix` message for Duo Chat which handles different numbers of diagnostic errors
   * This message format matches what the GitLab Jetbrains plugin sends from their equivalent code action
   */
  #getFixMessage(diagnostics: vscode.Diagnostic[]): string {
    if (!diagnostics.length) {
      return `/fix`;
    }

    const formatDiagnostic = (diagnostic: vscode.Diagnostic) =>
      `\`${diagnostic.message}\` on line ${diagnostic.range.start.line + 1}`;
    if (diagnostics.length === 1) {
      return `/fix ${formatDiagnostic(diagnostics[0])}`;
    }

    return `/fix multiple issues: \n\n${diagnostics.map(formatDiagnostic).join('\n')}`;
  }
}
