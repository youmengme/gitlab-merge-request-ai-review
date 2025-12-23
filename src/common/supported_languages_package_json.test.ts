import * as packageJson from '../../package.json';
import {
  buildSupportedLanguages,
  SUPPORTED_LANGUAGES_CONFIG_NAME,
} from './test_utils/build_supported_languages';

describe('Supported Languages package.json config contribution', () => {
  it('contains all languages', () => {
    const supportedLangConfig = packageJson.contributes.configuration.find(c => c.id === 'duo')
      ?.properties[SUPPORTED_LANGUAGES_CONFIG_NAME];
    const { properties, defaultValues } = buildSupportedLanguages();
    try {
      expect(supportedLangConfig?.properties).toEqual(properties);
      expect(supportedLangConfig?.default).toEqual(defaultValues);
    } catch (e) {
      throw new Error(
        `The enabled supported languages configuration schema in package.json is out of date. You probably updated the \`@gitlab-org/gitlab-lsp\` dependency. Please run \`npm run update-supported-languages\`, to update the schema.\n\nFor more information see https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/main/docs/developer/code-suggestions-supported-languages.md\n\nThe exact error explaining what property is out of sync${e.message}`,
      );
    }
  });
});
