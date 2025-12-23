/* eslint-env jquery */

import { browser } from '@wdio/globals';
import { generateRandomString } from './general_helpers.js';
import { logger } from './logger_helpers.js';
import { dismissAllNotifications } from './notification_helpers.js';

/**
 * Waits for the code suggestion gutter icon to switch from loading to enabled.
 * Used by verifyCodeSuggestion()
 *
 * @async
 * @returns {Promise<void>}
 */
const waitForDuoSuggestion = async () => {
  await browser.waitUntil(
    async () => {
      const item = await browser.$$('.glyph-margin-widgets .codicon');
      return item.length > 0;
    },
    {
      timeoutMsg: `Code suggestions loading icon did not appear.`,
    },
  );

  await browser.waitUntil(
    async () => {
      const item = await browser.$$('.glyph-margin-widgets .codicon');
      return item.length === 0;
    },
    {
      timeout: 20000,
      timeoutMsg: `Code suggestions did not finish`,
    },
  );
};

/**
 * Waits for a code suggestion to generate and contain expected text.
 *
 * @async
 * @param {Object} tab - The text editor window
 * @param {string} initialPrompt - The initial prompt text
 * @returns {Promise<void>}
 */
const verifyCodeSuggestion = async (tab, initialPrompt) => {
  await waitForDuoSuggestion();
  await browser.keys('Tab');

  const editorText = await tab.getText();
  const generatedCode = editorText.replace(/\s/g, '').replace(initialPrompt.replace(/\s/g, ''), '');

  await expect(generatedCode).not.toContain(initialPrompt);
  await expect(generatedCode.length).toBeGreaterThan(1, {
    message: `Could not find generated code for prompt ${initialPrompt}.`,
  });
};

/**
 * Waits for the editor of a given filename.
 *
 * @async
 * @param {Object} editorView The text editor window
 * @param {string} filename Filename of the editor
 * @returns {Promise<void>}
 */
const waitForEditorTab = async (editorView, filename) => {
  await browser.waitUntil(
    async () => {
      const openTabs = await editorView.getOpenEditorTitles();
      return openTabs.includes(filename);
    },
    {
      timeout: 10000,
      timeoutMsg: `Tab for ${filename} did not appear.`,
    },
  );
};

/**
 * Creates a ruby file with a random filename.
 *
 * @async
 * @returns {Promise<TextEditor>} Promise resolving to Editor object
 */
const createFile = async () => {
  const workbench = await browser.getWorkbench();
  const filename = `test-${generateRandomString(7)}.rb`;
  const prompt = await workbench.executeCommand('Create: New File...');

  await prompt.setText(filename);
  await prompt.confirm();
  await prompt.confirm();

  const editorView = await workbench.getEditorView();
  await waitForEditorTab(editorView, filename);
  return editorView.openEditor(filename);
};

/**
 * Check if a folder by a given name is opened in Explorer Section
 *
 * @param {String} folderName
 * @returns {Promise<void>}
 */
const checkFolderOpen = async folderName => {
  const ariaLabel = await $(`aria/Explorer Section: ${folderName}`);
  await expect(ariaLabel).toHaveText(folderName, { ignoreCase: true });
};

/**
 * Open a folder by a given folder's path.
 *
 * @async
 * @param {String} path to folder
 * @returns {Promise<void>}
 */
const openFolder = async path => {
  await dismissAllNotifications();

  logger.info(`Opening Folder "${path}"...`);
  await browser.executeWorkbench((vscode, folderPath) => {
    const uri = vscode.Uri.file(folderPath);
    vscode.commands.executeCommand('vscode.openFolder', uri);
  }, path);

  const folderName = path.split('/').pop();
  await checkFolderOpen(folderName);
};

export { verifyCodeSuggestion, waitForEditorTab, createFile, openFolder };
