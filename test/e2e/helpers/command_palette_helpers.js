import { browser } from '@wdio/globals';

const waitForPromptTitleToContain = async (prompt, title) => {
  await browser.waitUntil(
    async () => {
      const promptText = await prompt.getTitle();
      return typeof promptText === 'string' && promptText.includes(title);
    },
    {
      timeout: 30000,
      timeoutMsg: `Prompt title did not contain "${title}".`,
    },
  );
};

export { waitForPromptTitleToContain };
