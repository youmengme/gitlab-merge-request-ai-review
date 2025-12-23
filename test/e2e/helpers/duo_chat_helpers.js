import { browser } from '@wdio/globals';

/**
 * Waits for the last Duo Chat response to contain expectedText
 *
 * @async
 * @param {string} expectedText - Text we expect to be included in the response from duo chat
 * @returns {Promise<void>}
 */
const verifyDuoChatResponse = async expectedText => {
  const DUO_CHAT_RESPONSES_LOCATOR = '#chat-component .duo-chat-message';

  let actualText;
  let duoChatResponses;

  await browser.waitUntil(
    async () => {
      duoChatResponses = await browser.$$(DUO_CHAT_RESPONSES_LOCATOR);

      const lastResponse = duoChatResponses[duoChatResponses.length - 1];

      if (!lastResponse) {
        return false;
      }

      actualText = await lastResponse.getText();

      return actualText.includes(expectedText);
    },
    {
      timeout: 20000,
      timeoutMsg: `Expected "${expectedText}" to be included in last Duo Chat response.`,
    },
  );
};

/**
 * Submits a Duo chat request
 *
 * @async
 * @param {string} input - Text we want to ask duo chat
 * @returns {Promise<void>}
 */
const askDuoChat = async input => {
  await browser.keys(input.split());
  await browser.keys('Enter');
  await browser.pause(1000);
};

/**
 * Waits for the Duo Chat to be cleared
 *
 * @async
 * @returns {Promise<void>}
 */
const verifyDuoChatEmpty = async () => {
  const DUO_CHAT_EMPTY_LOCATOR = '[data-testid="gl-duo-chat-empty-state"]';

  await browser.waitUntil(
    async () => {
      const emptyStateElement = await browser.$(DUO_CHAT_EMPTY_LOCATOR);
      return emptyStateElement.isExisting();
    },
    {
      timeout: 10000,
      timeoutMsg: `Expected empty state element with selector "${DUO_CHAT_EMPTY_LOCATOR}" to appear within 10 seconds.`,
    },
  );
};

export { verifyDuoChatResponse, askDuoChat, verifyDuoChatEmpty };
