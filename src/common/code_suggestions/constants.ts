import { supportedLanguages } from '@gitlab-org/gitlab-lsp/code_suggestions_config.json';

export const MODEL_GATEWAY_DUO_CODE_SUGGESTIONS_API_URL =
  'https://codesuggestions.gitlab.com/v2/completions';
export const GITLAB_DUO_CODE_SUGGESTIONS_API_PATH = '/code_suggestions/completions';
export const DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE = 'gitlab.duoCodeSuggestions';
export const NEW_CODE_SUGGESTION_GITLAB_RELEASE = '16.3.0';

// this list matches predefined list in the model gateway
// https://gitlab.com/gitlab-org/modelops/applied-ml/code-suggestions/ai-assist/-/blob/main/codesuggestions/suggestions/prompt.py#L29-44
export const DUO_CODE_SUGGESTIONS_LANGUAGES = supportedLanguages.map(
  langData => langData.languageId,
);

export const CODE_SUGGESTIONS_MIN_LENGTH = 10;

export const CS_DISABLED_PROJECT_CHECK_INTERVAL = 300000; // 5 min
