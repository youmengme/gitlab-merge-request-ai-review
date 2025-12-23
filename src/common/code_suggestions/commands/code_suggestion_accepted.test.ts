import { codeSuggestionsTelemetry } from '../code_suggestions_telemetry';
import {
  CodeSuggestionsTelemetryManager,
  CodeSuggestionTelemetryState,
} from '../code_suggestions_telemetry_manager';
import { codeSuggestionAccepted } from './code_suggestion_accepted';

jest.mock('../code_suggestions_telemetry_manager', () => ({
  CodeSuggestionsTelemetryManager: {
    updateSuggestionState: jest.fn(),
  },
  CodeSuggestionTelemetryState: {
    ACCEPTED: 'ACCEPTED',
  },
}));

describe('code suggestion accepted command', () => {
  it('updates codeSuggestionsTelemetry with the correct value', async () => {
    await codeSuggestionAccepted({ name: 'ensemble', engine: 'codegen' }, '123');

    expect(codeSuggestionsTelemetry.toArray()[0].accepts).toBe(1);
    expect(CodeSuggestionsTelemetryManager.updateSuggestionState).toBeCalledWith(
      expect.any(String),
      CodeSuggestionTelemetryState.ACCEPTED,
    );
  });
});
