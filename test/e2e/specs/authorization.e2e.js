import {
  selectPatAuthenticationAndOpenTokenInput,
  waitForNotification,
  withLoggerAtError,
} from '../helpers/index.js';

describe('GitLab Workflow Extension Authorization', () => {
  let prompt;

  beforeEach(async () => {
    prompt = await selectPatAuthenticationAndOpenTokenInput();
  });

  it('fails to authenticate with an invalid token', async () => {
    await prompt.setText('INVALID_TOKEN');
    await prompt.confirm();

    await waitForNotification('API Unauthorized');
  });

  it('authenticates with a valid token', async () => {
    // Set logger to error level to avoid logging the token
    await withLoggerAtError(async () => {
      await prompt.setText(process.env.TEST_GITLAB_TOKEN);
    });

    await prompt.confirm();
    await waitForNotification('Added GitLab account for user');
  });
});
