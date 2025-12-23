import { VisibleCodeSuggestionsState } from '../../code_suggestions_state_manager';
import { StatePolicy } from '../state_policy';

export const createFakePolicy: (state?: VisibleCodeSuggestionsState) => StatePolicy = state => ({
  engaged: false,
  onEngagedChange: jest.fn(() => ({ dispose: () => {} })),
  state: state || 'test',
  dispose: jest.fn(),
});
