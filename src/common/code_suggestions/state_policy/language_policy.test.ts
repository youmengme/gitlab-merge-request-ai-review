import * as vscode from 'vscode';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import {
  createActiveTextEditorChangeTrigger,
  createConfigurationChangeTrigger,
} from '../../test_utils/vscode_fakes';
import { DUO_CODE_SUGGESTIONS_LANGUAGES } from '../constants';
import { getDuoCodeSuggestionsLanguages } from '../../utils/extension_configuration';
import {
  LanguagePolicy,
  DISABLED_LANGUAGE_VIA_SETTINGS,
  UNSUPPORTED_LANGUAGE,
} from './language_policy';

jest.mock('../../utils/extension_configuration');

describe('LanguagePolicy', () => {
  let policy: LanguagePolicy;
  const triggerActiveTextEditorChange = createActiveTextEditorChangeTrigger();
  const triggerConfigurationChange = createConfigurationChangeTrigger();

  function mockEnabledLanguages(enabledLanguages = DUO_CODE_SUGGESTIONS_LANGUAGES) {
    jest.mocked(getDuoCodeSuggestionsLanguages).mockReturnValue(enabledLanguages);
  }

  beforeEach(async () => {
    mockEnabledLanguages();
    policy = new LanguagePolicy();
  });

  it('has UNSUPPORTED_LANGUAGE state', () => {
    expect(policy.state).toBe(UNSUPPORTED_LANGUAGE);
  });

  describe('given the language is supported and enabled', () => {
    it('is not engaged', async () => {
      DUO_CODE_SUGGESTIONS_LANGUAGES.forEach(async languageId => {
        await triggerActiveTextEditorChange(
          createFakePartial<vscode.TextEditor>({ document: { languageId } }),
        );

        expect(policy.engaged).toBe(false);
      });
    });
  });

  describe('given the language is unsupported and enabled', () => {
    it('is not engaged', async () => {
      mockEnabledLanguages(['foo']);
      await triggerConfigurationChange();

      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'foo' } }),
      );

      expect(policy.engaged).toBe(false);
    });
  });

  describe('given the language is supported and disabled', () => {
    beforeEach(async () => {
      mockEnabledLanguages(DUO_CODE_SUGGESTIONS_LANGUAGES.filter(lang => lang !== 'python'));
      await triggerConfigurationChange();

      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'python' } }),
      );
    });

    it('is engaged', async () => {
      expect(policy.engaged).toBe(true);
    });

    it('has DISABLED_LANGUAGE_VIA_SETTINGS state', async () => {
      expect(policy.state).toBe(DISABLED_LANGUAGE_VIA_SETTINGS);
    });
  });

  describe('given the language is unsupported and disabled', () => {
    beforeEach(async () => {
      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'foo' } }),
      );
    });

    it('is engaged', async () => {
      expect(policy.engaged).toBe(true);
    });

    it('has UNSUPPORTED_LANGUAGE state', () => {
      expect(policy.state).toBe(UNSUPPORTED_LANGUAGE);
    });
  });

  describe('onEngagedChange', () => {
    const listener = jest.fn();
    let initialState: string;
    let initialEngaged: boolean;

    beforeEach(() => {
      listener.mockClear();
      policy.onEngagedChange(listener);
      initialState = policy.state;
      initialEngaged = policy.engaged;
    });

    it('fires when only engaged changes', async () => {
      expect(listener).not.toHaveBeenCalled();

      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'javascript' } }),
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith(false);
      expect(policy.state).toBe(initialState);

      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'json' } }),
      );

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(true);
      expect(policy.state).toBe(initialState);
    });

    it('fires when only state changes', async () => {
      mockEnabledLanguages(DUO_CODE_SUGGESTIONS_LANGUAGES.filter(lang => lang !== 'javascript'));
      await triggerConfigurationChange();

      expect(listener).not.toHaveBeenCalled();

      // Switch to unsupported language
      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'unsupportedlang' } }),
      );

      // Switch to disabled language
      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'javascript' } }),
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith(true);
      expect(policy.engaged).toBe(initialEngaged);
      expect(policy.state).not.toBe(initialState);
    });

    it('does not fire when state and engaged do not change', async () => {
      expect(listener).not.toHaveBeenCalled();

      // Switch to unsupported language
      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'unsupportedlang' } }),
      );

      // Switch to another unsupported language
      await triggerActiveTextEditorChange(
        createFakePartial<vscode.TextEditor>({ document: { languageId: 'otherunsupportedlang' } }),
      );

      expect(listener).not.toHaveBeenCalled();
      expect(policy.engaged).toBe(initialEngaged);
      expect(policy.state).toBe(initialState);
    });
  });
});
