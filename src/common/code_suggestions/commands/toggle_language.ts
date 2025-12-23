import * as vscode from 'vscode';
import {
  DuoCodeSuggestionsConfiguration,
  getDuoCodeSuggestionsConfiguration,
  setDuoCodeSuggestionsConfiguration,
} from '../../utils/extension_configuration';

export const COMMAND_TOGGLE_CODE_SUGGESTIONS_FOR_LANGUAGE = 'gl.toggleCodeSuggestionsForLanguage';
export const toggleCodeSuggestionsForLanguage = async () => {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    await vscode.window.showWarningMessage(
      'GitLab: could not toggle language, as no text editor is active.',
    );
    return;
  }

  const { languageId } = editor.document;

  const { enabledSupportedLanguages, additionalLanguages } = getDuoCodeSuggestionsConfiguration();

  const newConfig: Partial<DuoCodeSuggestionsConfiguration> = {};

  // Given the languageId, determine whether to update the
  // enabledSupportedLanguages or the additionalLanguages setting.
  if (Object.hasOwn(enabledSupportedLanguages, languageId)) {
    // Prepare updated the enabledSupportedLanguages setting value.
    const newEnabledValue = !enabledSupportedLanguages[languageId];

    newConfig.enabledSupportedLanguages = {
      ...enabledSupportedLanguages,
      [languageId]: newEnabledValue,
    };
  } else {
    // Prepare updated additionalLanguages setting value.
    newConfig.additionalLanguages = [...additionalLanguages];

    const index = newConfig.additionalLanguages.indexOf(languageId);

    if (index === -1) {
      newConfig.additionalLanguages.push(languageId);
    } else {
      newConfig.additionalLanguages.splice(index, 1);
    }
  }

  await setDuoCodeSuggestionsConfiguration(newConfig);
};
