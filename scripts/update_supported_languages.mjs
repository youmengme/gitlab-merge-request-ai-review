/**
 * This script updates the supported languages schema in package.json based on the latest gitlab-lsp release.
 * This script works in conjunction with the supported_languages_package_json.test.ts unit test
 * which checks that the schema in package.json is up-to-date
 *
 */
import path from 'path';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './utils/run_utils.mjs';
import codeSuggestionsConfig from './utils/code_suggestions_settings.cjs';

// -----------------------
// WARNING START: this code must be kept identical to the same code in src/common/test_utils/build_supported_languages.ts
// -----------------------
const SUPPORTED_LANGUAGES_CONFIG_NAME = 'gitlab.duoCodeSuggestions.enabledSupportedLanguages';

const buildSupportedLanguages = () => {
  const enabledSupportedLanguages = {};
  const defaultValues = {};
  const { supportedLanguages } = codeSuggestionsConfig.default;
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

function prettyPrint(json) {
  return JSON.stringify(json, null, 2);
}

function writePackageJson(packageJson) {
  writeFileSync(path.join(root, `package.json`), prettyPrint(packageJson));
}

const { properties, defaultValues } = buildSupportedLanguages();

const packageJson = JSON.parse(readFileSync(join(root, 'package.json')));

packageJson.contributes.configuration.properties[SUPPORTED_LANGUAGES_CONFIG_NAME].properties =
  properties;
packageJson.contributes.configuration.properties[SUPPORTED_LANGUAGES_CONFIG_NAME].default =
  defaultValues;

writePackageJson(packageJson);
