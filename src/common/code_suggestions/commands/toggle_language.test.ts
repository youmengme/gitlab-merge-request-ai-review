import * as vscode from 'vscode';
import {
  getDuoCodeSuggestionsConfiguration,
  setDuoCodeSuggestionsConfiguration,
  DuoCodeSuggestionsConfiguration,
} from '../../utils/extension_configuration';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { toggleCodeSuggestionsForLanguage } from './toggle_language';

jest.mock('../state_policy/disabled_for_session_policy');
jest.mock('../../utils/extension_configuration', () => ({
  getDuoCodeSuggestionsConfiguration: jest.fn(() => ({})),
  setDuoCodeSuggestionsConfiguration: jest.fn(),
}));

function setConfiguration(
  config: Partial<
    Pick<DuoCodeSuggestionsConfiguration, 'enabledSupportedLanguages' | 'additionalLanguages'>
  >,
) {
  jest.mocked(getDuoCodeSuggestionsConfiguration).mockReturnValue(
    createFakePartial<DuoCodeSuggestionsConfiguration>({
      enabled: true,
      enabledSupportedLanguages: {},
      additionalLanguages: [],
      ...config,
    }),
  );
}

function setActiveTextEditorLanguage(languageId: string | undefined) {
  vscode.window.activeTextEditor =
    languageId === undefined
      ? undefined
      : createFakePartial<vscode.TextEditor>({ document: { languageId } });
}

describe('toggle code suggestions for language command', () => {
  beforeEach(() => {
    setActiveTextEditorLanguage(undefined);
    setConfiguration({});
  });

  it('disables code suggestions for enabled supported language', async () => {
    setActiveTextEditorLanguage('java');
    setConfiguration({ enabledSupportedLanguages: { java: true } });

    await toggleCodeSuggestionsForLanguage();

    expect(setDuoCodeSuggestionsConfiguration).toHaveBeenCalledWith({
      enabledSupportedLanguages: { java: false },
    });
  });

  it('enables code suggestions for disabled supported language', async () => {
    setActiveTextEditorLanguage('java');
    setConfiguration({ enabledSupportedLanguages: { java: false } });

    await toggleCodeSuggestionsForLanguage();

    expect(setDuoCodeSuggestionsConfiguration).toHaveBeenCalledWith({
      enabledSupportedLanguages: { java: true },
    });
  });

  it('enables code suggestions for disabled unsupported language', async () => {
    setActiveTextEditorLanguage('foo');
    setConfiguration({ additionalLanguages: [] });

    await toggleCodeSuggestionsForLanguage();

    expect(setDuoCodeSuggestionsConfiguration).toHaveBeenCalledWith({
      additionalLanguages: ['foo'],
    });
  });

  it('disables code suggestions for enabled unsupported language', async () => {
    setActiveTextEditorLanguage('foo');
    setConfiguration({ additionalLanguages: ['foo'] });

    await toggleCodeSuggestionsForLanguage();

    expect(setDuoCodeSuggestionsConfiguration).toHaveBeenCalledWith({
      additionalLanguages: [],
    });
  });

  it('gracefully handles no document', async () => {
    setActiveTextEditorLanguage(undefined);

    await expect(toggleCodeSuggestionsForLanguage()).resolves.toBe(undefined);

    expect(setDuoCodeSuggestionsConfiguration).not.toHaveBeenCalled();
  });
});
