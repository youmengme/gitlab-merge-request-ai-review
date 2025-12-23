import { Model, codeSuggestionsTelemetry } from '../code_suggestions_telemetry';
import {
  CodeSuggestionTelemetryState,
  CodeSuggestionsTelemetryManager,
} from '../code_suggestions_telemetry_manager';

export const COMMAND_CODE_SUGGESTION_ACCEPTED = 'gl.codeSuggestionAccepted';
// Used for telemetry
export const codeSuggestionAccepted = async (model: Model, traceID: string) => {
  // emmit: suggestion_accepted
  // reset state to make sure that it is not also accounted as rejected
  codeSuggestionsTelemetry.incAcceptCount(model);
  CodeSuggestionsTelemetryManager.updateSuggestionState(
    traceID,
    CodeSuggestionTelemetryState.ACCEPTED,
  );
};
