import { browser } from '@wdio/globals';
import {
  completeAuth,
  verifyDuoChatResponse,
  askDuoChat,
  verifyDuoChatEmpty,
} from '../helpers/index.js';

describe('GitLab Workflow Extension Duo Chat', async () => {
  let workbench;

  before(async () => {
    await completeAuth();
  });

  beforeEach(async () => {
    workbench = await browser.getWorkbench();
    await workbench.executeCommand('GitLab Duo Chat: Start a new conversation');
    const duoChatWebView = await workbench.getWebviewByTitle('GitLab Duo Chat');
    await duoChatWebView.open();
    // LS chat is now enabled by default
    // the LS serves content for the webview that contains the chat iframe
    // thus we get iframe (chat) inside the iframe (VSCode webview)
    // we need to switch the active context to this inner (chat) iframe
    // to be able to find elements inside it
    const lsChatIFrames = await browser.$$('iframe');
    await browser.switchToFrame(lsChatIFrames[0]);
  });

  it('sends a Duo chat request and receives a response', async () => {
    await askDuoChat('/clear');
    await verifyDuoChatEmpty();

    await askDuoChat('hi');
    const expectedOutput = 'GitLab';
    await verifyDuoChatResponse(expectedOutput);
  });
});
