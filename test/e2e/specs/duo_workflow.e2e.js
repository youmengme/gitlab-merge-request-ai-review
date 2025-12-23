import {
  completeAuth,
  verifyStartButtonClickable,
  setTaskPrompt,
  openDuoWorkFlowView,
} from '../helpers/index.js';

/**
 * Please note that GitLab Duo Agent Platform feature is controlled by a feature flag and
 * currently only available for internal GitLab team members for testing.
 * See https://docs.gitlab.com/user/duo_workflow/ for more information.
 *
 *
 * Skipping this spec by default so that it won't run in CI for the time being
 * The behaviors aren't consistent and very flaky through out the user flow
 * And the flow only works with vscode browser version 1.92.2
 * See issue https://github.com/webdriverio-community/wdio-vscode-service/issues/136#issuecomment-2638674692
 * It works perfectly fine when run locally, so keeping the code for local run for future testing purposes
 *
 *
 * To run locally, update 'browserVersion:'  in wdio.conf.js to '1.92.2'
 * and unskip describe block.
 *
 * Optional: append "--spec specs/duo_workflow.e2e.js" to "test:e2e": "wdio run ./wdio.conf.js" in package.json
 * to execute this spec only.
 */
xdescribe('GitLab Workflow Extension Duo Agent Platform', async () => {
  const testPrompt = 'Please write a hello world file in javascript';

  // Current working folder should be <$homeDir>/gitlab-vscode-extension/test/e2e
  // Removing subdir '/test/e2e' from the path
  const path = process.cwd().replace('/test/e2e', '');

  before(async () => {
    await completeAuth();
  });

  it('navigates to GitLab Duo Agent Platform tab', async () => {
    await openDuoWorkFlowView(path);
    await setTaskPrompt(testPrompt);
    await verifyStartButtonClickable();
  });
});
