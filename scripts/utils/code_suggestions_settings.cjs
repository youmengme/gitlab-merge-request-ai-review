// This is a workaround to be able to directly import code_suggestions_config.json file.
// .mjs files require to use a new syntax import { whatever } from 'your-file.json' assert { type: 'json' }
// this syntax is not yet supported by eslint. In order to properly use this syntax would require a usage of a babel parser plugin
// see this issue for details: https://github.com/eslint/eslint/discussions/15305
const codeSuggestionSettings = require('@gitlab-org/gitlab-lsp/code_suggestions_config.json');

exports.default = codeSuggestionSettings;
