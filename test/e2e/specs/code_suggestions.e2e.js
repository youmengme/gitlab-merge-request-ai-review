import { browser } from '@wdio/globals';
import { completeAuth, verifyCodeSuggestion, createFile } from '../helpers/index.js';

const KEY = {
  SPACE: 'Space',
  ENTER: 'Enter',
};

describe('GitLab Workflow Extension Code Suggestions', async () => {
  let tab;

  before(async () => {
    await completeAuth();
  });

  beforeEach(async () => {
    tab = await createFile();
  });

  it('suggests code after typing', async () => {
    const codePartial = `
    public class Vehicle {
      private String make;

      public String getMake() {
          return`;

    await tab.setText(codePartial);
    await browser.keys(KEY.SPACE);

    await verifyCodeSuggestion(tab, codePartial);
  });

  it('generates code given a prompt', async () => {
    const prompt = '# generate a simple hello world web server\n';

    await tab.setText(prompt);
    await browser.keys(KEY.ENTER);

    await verifyCodeSuggestion(tab, prompt);
  });

  it('considers context from open tabs', async () => {
    const codePartial = `
      module Foo
        module Constants
          FOO_XYZ_1 = 1
          FOO_XYZ_2 = 2
          FOO_XYZ_3 = 3
        end
      end`;

    await tab.setText(codePartial);

    const newTab = await createFile();
    const codePrompt = 'Foo::Constants:';
    await newTab.setText(codePrompt);
    await browser.keys(':');

    await verifyCodeSuggestion(tab, codePrompt);
    const editorText = await newTab.getText();

    // check that the constants from the other tab are referenced
    expect(editorText).toMatch(/XYZ/);
  });
});
