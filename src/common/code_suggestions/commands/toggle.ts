import {
  getDuoCodeSuggestionsConfiguration,
  setDuoCodeSuggestionsConfiguration,
} from '../../utils/extension_configuration';
import { CodeSuggestionsStateManager } from '../code_suggestions_state_manager';
import { disabledForSessionPolicy } from '../state_policy/disabled_for_session_policy';

export const COMMAND_TOGGLE_CODE_SUGGESTIONS = 'gl.toggleCodeSuggestions';
export const toggleCodeSuggestions = async ({
  stateManager,
}: {
  stateManager: CodeSuggestionsStateManager;
}) => {
  const config = getDuoCodeSuggestionsConfiguration();
  if (!config.enabled) {
    // Enable extension globally
    await setDuoCodeSuggestionsConfiguration({ enabled: true });
  } else {
    // Disable/enable extension only per session
    disabledForSessionPolicy.setTemporaryDisabled(!stateManager.isDisabledByUser());
  }
};
