import * as codeSuggestionsConfig from '@gitlab-org/gitlab-lsp/code_suggestions_config.json';

// -----------------------
// WARNING START: this code must be kept identical to the same code in scripts/update_supported_languages.mjs.
// -----------------------
export const SUPPORTED_LANGUAGES_CONFIG_NAME =
  'gitlab.duoCodeSuggestions.enabledSupportedLanguages' as const;

export const buildSupportedLanguages = () => {
  const enabledSupportedLanguages: Record<string, unknown> = {};
  const defaultValues: Record<string, boolean> = {};
  const { supportedLanguages } = codeSuggestionsConfig;
  for (const language of supportedLanguages) {
    enabledSupportedLanguages[language.languageId] = {
      type: 'boolean',
      default: true,
      description: language.humanReadableName,
    };

    defaultValues[language.languageId] = true;
  }

  return {
    properties: enabledSupportedLanguages,
    defaultValues,
  };
};
// ---------------------------
// WARNING END
// ---------------------------
