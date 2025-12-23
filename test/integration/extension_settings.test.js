const assert = require('assert');
const vscode = require('vscode');
const codeSuggestionsConfig = require('@gitlab-org/gitlab-lsp/code_suggestions_config.json');

describe('extension settings', () => {
  describe('supported language settings', () => {
    const supportedLanguagesConfigKey = 'gitlab.duoCodeSuggestions';
    it('enabledSupportedLanguages should match the supported languages', () => {
      const settings = vscode.workspace.getConfiguration(supportedLanguagesConfigKey);
      const languages = settings.get('enabledSupportedLanguages');
      const enabledLanguages = Object.keys(languages);
      const expectedLanguages = codeSuggestionsConfig.supportedLanguages.map(l => l.languageId);

      for (const language of expectedLanguages) {
        assert.ok(languages[language] === true, `${language} is enabled`);
      }
      assert.ok(enabledLanguages.length > 0, 'Languages list is not empty');
    });
  });
});
