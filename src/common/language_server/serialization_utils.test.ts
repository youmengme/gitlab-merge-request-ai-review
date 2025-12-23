import * as vscode from 'vscode';
import {
  serializeInlineCompletionContext,
  serializePosition,
  serializeRange,
} from './serialization_utils';

describe('serializationUtils', () => {
  describe('serializePosition', () => {
    it('converts a vscode.Position object into a plain js object', () => {
      const result = serializePosition(new vscode.Position(1, 1));

      expect(result).not.toBeInstanceOf(vscode.Position);
      expect(result).toEqual({ line: 1, character: 1 });
    });
  });

  describe('serializeRange', () => {
    it('converts a vscode.Range object into a plain js object', () => {
      const result = serializeRange(
        new vscode.Range(new vscode.Position(1, 1), new vscode.Position(1, 2)),
      );

      expect(result).not.toBeInstanceOf(vscode.Range);
      expect(result).toEqual({ start: { line: 1, character: 1 }, end: { line: 1, character: 2 } });
    });
  });

  describe('serializeInlineCompletionContext', () => {
    it('transforms the selectedCompletionInfo range object into a plain js object', () => {
      const result = serializeInlineCompletionContext({
        triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
        selectedCompletionInfo: {
          range: new vscode.Range(new vscode.Position(1, 1), new vscode.Position(1, 2)),
          text: 'text',
        },
      });

      expect(result.selectedCompletionInfo?.range).not.toBeInstanceOf(vscode.Range);
      expect(result).toEqual({
        triggerKind: vscode.InlineCompletionTriggerKind.Automatic,
        selectedCompletionInfo: {
          range: { start: { line: 1, character: 1 }, end: { line: 1, character: 2 } },
          text: 'text',
        },
      });
    });
  });
});
