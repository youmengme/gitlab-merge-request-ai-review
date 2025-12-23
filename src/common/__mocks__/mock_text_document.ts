import vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';

/**
 * Creates a mock vscode.TextDocument.
 * Includes mock implementation for working with ranges, content and lines
 *
 * @param uri The document URI
 * @param content The full document content
 * @returns A mock vscode.TextDocument
 */
export function createMockTextDocument({
  uri = vscode.Uri.file('/path/to/file.ts'),
  content = 'full document content\nsecond line\nthird line',
}: {
  uri?: vscode.Uri;
  content?: string;
} = {}) {
  const lines = content.split('\n');

  return createFakePartial<vscode.TextDocument>({
    getText: jest.fn().mockImplementation((range?: vscode.Range) => {
      if (!range) return content;

      const startLine = range.start.line;
      const endLine = range.end.line;
      const startChar = range.start.character;
      const endChar = range.end.character;

      if (startLine === endLine) {
        // Range is within a single line
        return lines[startLine].substring(startChar, endChar);
      }

      // Range spans multiple lines
      let result = `${lines[startLine].substring(startChar)}\n`;

      // Add full intermediate lines
      for (let i = startLine + 1; i < endLine; i++) {
        result += `${lines[i]}\n`;
      }

      // Add the end line portion
      result += lines[endLine].substring(0, endChar);
      return result;
    }),
    lineAt: jest.fn().mockImplementation((line: number | vscode.Position) => {
      const lineNumber = typeof line === 'number' ? line : line.line;
      const lineText = lines[lineNumber];

      return createFakePartial<vscode.TextLine>({
        text: lineText,
        range: new vscode.Range(lineNumber, 0, lineNumber, lineText.length),
        rangeIncludingLineBreak: new vscode.Range(lineNumber, 0, lineNumber, lineText.length + 1),
        lineNumber,
        firstNonWhitespaceCharacterIndex: lineText.search(/\S/),
        isEmptyOrWhitespace: /^\s*$/.test(lineText),
      });
    }),
    lineCount: lines.length,
    uri,
  });
}
