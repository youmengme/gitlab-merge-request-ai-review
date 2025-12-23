import * as vscode from 'vscode';
import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResult,
  TextDocumentEdit,
  TextEdit,
} from 'vscode-languageclient';
import { createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { groupBy } from 'lodash';
import { FeatureFlag } from '../feature_flags/constants';
import { getLocalFeatureFlagService } from '../feature_flags/local_feature_flag_service';
import { log } from '../log';
import { ApplyEditMiddleware } from './apply_edit_client_wrapper';

const NEWLINE_REGEX = /\r\n|\n|\r/;

export class FormatEditsMiddleware implements ApplyEditMiddleware {
  #p2c = createConverter(undefined, false, false);

  async process(
    params: ApplyWorkspaceEditParams,
    next: (params: ApplyWorkspaceEditParams) => Promise<ApplyWorkspaceEditResult>,
  ): Promise<ApplyWorkspaceEditResult> {
    if (!getLocalFeatureFlagService().isEnabled(FeatureFlag.FormatEdits)) {
      return next(params);
    }

    const result = await next(params);

    if (result.applied) {
      try {
        await this.#formatEditedRanges(params.edit);
      } catch (error) {
        log.error('[FormatEditsMiddleware] Error formatting edited ranges:', error);
      }
    }

    return result;
  }

  async #formatEditedRanges(workspaceEdit: ApplyWorkspaceEditParams['edit']): Promise<void> {
    if (!workspaceEdit.documentChanges) {
      return;
    }

    const editsByDocument = groupBy(
      workspaceEdit.documentChanges.filter(TextDocumentEdit.is),
      'textDocument.uri',
    );

    for (const [uriString, textDocumentEdits] of Object.entries(editsByDocument)) {
      try {
        // we want to await and run these formats one-by-one since they modify editor selection and could otherwise conflict
        // eslint-disable-next-line no-await-in-loop
        await this.#formatDocumentRanges(
          uriString,
          textDocumentEdits.flatMap(tde => tde.edits),
        );
      } catch (error) {
        log.error(`[FormatEditsMiddleware] Error formatting document ${uriString}:`, error);
      }
    }
  }

  async #formatDocumentRanges(uriString: string, textEdits: TextEdit[]): Promise<void> {
    const uri = this.#p2c.asUri(uriString);

    const existingEditor = vscode.window.visibleTextEditors.find(
      editor => editor.document.uri.toString() === uri.toString(),
    );
    const existingUserSelection = existingEditor?.selection;

    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: true,
    });

    const sortedEdits = this.#sortEditsInReverseOrder(textEdits);

    log.debug(
      `[FormatEditsMiddleware] Processing ${sortedEdits.length} edits in reverse order for "${uriString}"`,
    );

    for (const textEdit of sortedEdits) {
      // eslint-disable-next-line no-await-in-loop
      await this.#formatSingleEdit(editor, textEdit, uriString);
    }

    if (existingUserSelection) {
      editor.selection = existingUserSelection;
    } else {
      const firstTextEdit = textEdits[0];
      const firstEditStartPosition =
        firstTextEdit && this.#p2c.asPosition(firstTextEdit.range.start);
      if (firstEditStartPosition) {
        editor.selection = new vscode.Selection(firstEditStartPosition, firstEditStartPosition);
      }
    }
  }

  async #formatSingleEdit(
    editor: vscode.TextEditor,
    textEdit: TextEdit,
    uriString: string,
  ): Promise<void> {
    try {
      const rangeToFormat = this.#getRangeToFormat(textEdit);
      if (rangeToFormat.isEmpty) {
        return;
      }

      // eslint-disable-next-line no-param-reassign
      editor.selection = new vscode.Selection(rangeToFormat.start, rangeToFormat.end);
      await vscode.commands.executeCommand('editor.action.formatSelection');

      log.debug(
        `[FormatEditsMiddleware] Formatted inserted text for "${uriString}", range: ${rangeToFormat.start.line}:${rangeToFormat.start.character}-${rangeToFormat.end.line}:${rangeToFormat.end.character}`,
      );
    } catch (error) {
      log.error(`[FormatEditsMiddleware] Error formatting edit:`, error);
    }
  }

  /**
   * Sorts TextEdits in reverse document order (bottom to top, right to left)
   * This helps prevent the problem where formatting one edit invalidate the ranges of other edits
   *
   * KNOWN ISSUE: when processing these edits in reverse order, formatting one range could _remove_ an earlier line. If
   * there is another TextEdit directly next to this one, its range would be impacted. However, this is edge-casey
   * enough we haven't implemented a more complex system to handle it, and the impact is low (some code that has already
   * been formatted will be included for formatting again in the next range).
   */
  #sortEditsInReverseOrder(textEdits: TextEdit[]): TextEdit[] {
    return [...textEdits].sort((a, b) => {
      const aStart = this.#p2c.asPosition(a.range.start);
      const bStart = this.#p2c.asPosition(b.range.start);

      if (aStart.line !== bStart.line) {
        return bStart.line - aStart.line;
      }

      return bStart.character - aStart.character;
    });
  }

  /**
   * A vscode.TextEdit has a 'Range' on it, but this is the _insertion_ range, not the range of the final edited text.
   * So we calculate the range to format from the start of the insertion range + the new text length (accounting for multi lines)
   */
  #getRangeToFormat(textEdit: TextEdit): vscode.Range {
    const startPos = this.#p2c.asPosition(textEdit.range.start);

    const newTextLines = textEdit.newText.split(NEWLINE_REGEX);
    const endLine = startPos.line + newTextLines.length - 1;
    let endChar: number;

    if (newTextLines.length === 1) {
      endChar = startPos.character + newTextLines[0].length;
    } else {
      endChar = newTextLines[newTextLines.length - 1].length;
    }

    const endPos = new vscode.Position(endLine, endChar);
    return new vscode.Range(startPos, endPos);
  }
}
