import * as vscode from 'vscode';

/**
 * Inserts a code snippet into the active editor from an AI response.
 * Escapes any dollar signs in the snippet to prevent snippet variable replacement.
 * https://code.visualstudio.com/docs/editor/userdefinedsnippets#_how-do-i-have-a-snippet-place-a-variable-in-the-pasted-script
 */
export const insertCodeSnippet = async (snippet: string) => {
  try {
    const { activeTextEditor } = vscode.window;
    if (!activeTextEditor) {
      await vscode.window.showWarningMessage(
        "There's no active editor to insert the snippet into.",
      );
      return;
    }

    const escapedSnippet = snippet.replace(/\$/g, '\\$');
    const snippetString = new vscode.SnippetString(escapedSnippet);

    await activeTextEditor.insertSnippet(snippetString);
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Error inserting snippet: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
