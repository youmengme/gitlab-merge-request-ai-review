import { browser } from '@wdio/globals';
import { config } from '../wdio.conf.js';
import { waitForPromptTitleToContain } from './command_palette_helpers.js';
import { dismissAllNotifications, waitForNotification } from './notification_helpers.js';
import { withLoggerAtError } from './general_helpers.js';
import { logger } from './logger_helpers.js';

/**
 * Executes the 'GitLab: Authenticate' command. Retries if extension is not loaded yet.
 *
 * @async
 * @returns {prompt}
 */
const invokeAuthPrompt = async () => {
  const workbench = await browser.getWorkbench();
  let prompt;

  logger.info('Invoking command "Gitlab: Authenticate"...');
  await browser.waitUntil(
    async () => {
      prompt = await workbench.executeCommand('GitLab: Authenticate');
      await browser.pause(500);

      const promptText = await prompt.getTitle();
      return typeof promptText === 'string' && promptText.includes('Select GitLab instance');
    },
    {
      timeout: 30000,
      timeoutMsg: `Command palette did not have 'GitLab: Authenticate' after 15 seconds".`,
    },
  );

  return prompt;
};

export const selectPatAuthenticationAndOpenTokenInput = async () => {
  await dismissAllNotifications();

  logger.info('Selecting PAT as authentication method...');
  const prompt = await invokeAuthPrompt();
  await prompt.setText('');

  // https://gitlab.com can be selected by default, other instances must be typed in
  if (config.gitlabHost === 'https://gitlab.com') {
    await prompt.selectQuickPick(config.gitlabHost);
    await waitForPromptTitleToContain(prompt, 'Select authentication method');
    await prompt.selectQuickPick('Personal Access Token');
  } else {
    await prompt.selectQuickPick('Manually enter instance URL');
    await prompt.setText(config.gitlabHost);
    await prompt.confirm();
  }

  await waitForPromptTitleToContain(prompt, 'Do you want to create a new token?');
  await prompt.selectQuickPick('Enter an existing token');

  await expect(prompt.input$).toHaveAttr('type', 'password', {
    message: 'Input field is not masked for passwords.',
  });

  return prompt;
};

/**
 * Completes authorization with environment variable `TEST_GITLAB_TOKEN` for the GitLab extension
 *
 * @async
 * @returns {Promise<void>}
 */
export const completeAuth = async () => {
  if (!process.env.TEST_GITLAB_TOKEN) {
    throw new Error('TEST_GITLAB_TOKEN environment variable is not set!');
  }

  const prompt = await selectPatAuthenticationAndOpenTokenInput();

  // Set logger to error level to avoid logging the token
  await withLoggerAtError(async () => {
    await prompt.setText(process.env.TEST_GITLAB_TOKEN);
  });

  await prompt.confirm();

  await waitForNotification('Added GitLab account for user');
};
