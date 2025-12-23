# Supported Languages for Code Suggestions

The GitLab Language Server (LS) specifies which languages are eligible for code suggestions. For detailed information, see the [documentation](https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/blob/main/docs/developer/supported_languages.md). The VS Code Extension uses this information in the following ways:

## Configuration Schema for Supported Languages

The configuration schema for `gitlab.duoCodeSuggestions.enabledSupportedLanguages` property is defined in our [`package.json`](https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/dc65c5d17498182e7fad699a9c153b20554e9ac9/package.json#L312). To ensure the `properties` and `default` values remain synchronized with the Language Server's source of truth, we employ two mechanisms:

1. **Unit Testing**: A dedicated [unit test](https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/dc65c5d17498182e7fad699a9c153b20554e9ac9/src/common/supported_languages_package_json.test.ts#L8) validates that the configuration schema is up-to-date with the language definition in LS.

1. **Update Script**: Developers can run `npm run update-supported-languages` to automatically update the configuration schema based on the Language Server's definition.

## Language Server Configuration Translation

The extension includes [translation logic](https://gitlab.com/gitlab-org/gitlab-vscode-extension/blob/dc65c5d17498182e7fad699a9c153b20554e9ac9/src/common/language_server/language_client_wrapper.ts#L121) that transforms the `enabledSupportedLanguages` setting into a list of "disabled supported languages," which is the format expected by the Language Server.

The `enabledSupportedLanguages` configuration schema was specifically designed to provide an optimal VS Code user interface: a checklist of supported languages that are enabled by default. Because the Language Server expects a list of disabled languages, this transformation step is necessary.
