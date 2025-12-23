import {
  DuoCodeSuggestionsConfiguration,
  getDuoCodeSuggestionsConfiguration,
  setDuoCodeSuggestionsConfiguration,
} from '../../utils/extension_configuration';
import { CodeSuggestionsStateManager } from '../code_suggestions_state_manager';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { disabledForSessionPolicy } from '../state_policy/disabled_for_session_policy';
import { toggleCodeSuggestions } from './toggle';

jest.mock('../state_policy/disabled_for_session_policy');
jest.mock('../../utils/extension_configuration', () => ({
  getDuoCodeSuggestionsConfiguration: jest.fn(() => ({ enabled: false })),
  setDuoCodeSuggestionsConfiguration: jest.fn(),
}));

const stateManager = createFakePartial<CodeSuggestionsStateManager>({
  isDisabledByUser: jest.fn().mockReturnValue(false),
});

describe('toggle code suggestions command', () => {
  it('enables code suggestions globally if previously disabled', async () => {
    await toggleCodeSuggestions({ stateManager });

    expect(setDuoCodeSuggestionsConfiguration).toHaveBeenCalledWith({
      enabled: !getDuoCodeSuggestionsConfiguration().enabled,
    });
    expect(disabledForSessionPolicy.setTemporaryDisabled).not.toHaveBeenCalled();
  });

  it('disables code suggestions per session if previously globally enabled', async () => {
    jest
      .mocked(getDuoCodeSuggestionsConfiguration)
      .mockReturnValue(createFakePartial<DuoCodeSuggestionsConfiguration>({ enabled: true }));

    await toggleCodeSuggestions({ stateManager });

    expect(setDuoCodeSuggestionsConfiguration).not.toHaveBeenCalled();
    expect(disabledForSessionPolicy.setTemporaryDisabled).toHaveBeenCalledWith(true);
  });
});
