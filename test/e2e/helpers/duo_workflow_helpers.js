/* eslint-env jquery */

import { browser } from '@wdio/globals';
import { logger } from './logger_helpers.js';
import { openFolder } from './editor_helpers.js';

/**
 * Invoking "Gitlab: Show Duo Agent Platform" command
 *
 * @async
 * @returns {Promise<void>}
 */
async function invokeGitlabDuoWorkflowCommand() {
  logger.info(`Invoking "Gitlab: Show Duo Agent Platform" command...`);
  let webview;
  const workbench = await browser.getWorkbench();

  await browser.waitUntil(
    async () => {
      await workbench.executeCommand('Gitlab: Show Duo Agent Platform');
      await browser.pause(2000);

      webview = await workbench.getWebviewByTitle('GitLab Duo Agent Platform');
      return webview !== null;
    },
    {
      timeout: 15000,
      timeoutMsg: `Command palette did not have "Gitlab: Show Duo Agent Platform" after 15 seconds".`,
      interval: 1000,
    },
  );

  await webview.open();
}

/**
 * Looking for text 'Gitlab Duo Agent Platform' in webview
 *
 * @async
 * @returns boolean
 */
async function duoWorkflowViewIsRendered() {
  logger.info('Verifies webview has content "Gitlab Duo Agent Platform"...');
  const iframe = await browser.findElement('css selector', 'iframe');
  await browser.switchToFrame(iframe);
  const getDocumentText = await browser.executeScript(
    'return document.documentElement.outerText',
    [],
  );

  return getDocumentText.includes('GitLab Duo Agent Platform');
}

/**
 * Opens GitLab Duo Agent Platform view by
 * Invoking command "Gitlab: Show Duo Agent Platform"
 * Then switch inside the <iframe/> of the webview
 *
 * @async
 * @returns {Promise<void>}
 */
const openDuoWorkFlowView = async path => {
  await browser.waitUntil(
    async () => {
      await openFolder(path);

      logger.info('Opening Gitlab Duo Agent Platform view...');
      await invokeGitlabDuoWorkflowCommand();
      return duoWorkflowViewIsRendered();
    },
    {
      timeout: 30000,
      timeoutMsg: `Gitlab Duo Agent Platform view did not appear within 30 seconds.`,
      interval: 1000,
    },
  );
};

/**
 * Sets simple text in task prompt to enable start button
 *
 * @async
 * @param {String} text string to input into textarea
 * @returns {Promise<void>}
 */
const setTaskPrompt = async text => {
  logger.info('Typing task into task prompt...');
  const taskPromptLocator = '[data-testid="workflow-task-textarea"]';

  await $(taskPromptLocator).click();
  await $(taskPromptLocator).setValue(text);
};

/**
 * Verifies GitLab Duo Agent Platform start button is clickable
 *
 * @async
 * @returns {Promise<void>}
 */
const verifyStartButtonClickable = async () => {
  logger.info('Verifying Gitlab Duo Agent Platform "Start" button is clickable...');
  const buttonLocator = '[data-testid="start-workflow-button"]';

  expect(await $(buttonLocator).isClickable()).toBe(true);
};

export { verifyStartButtonClickable, setTaskPrompt, openDuoWorkFlowView };
