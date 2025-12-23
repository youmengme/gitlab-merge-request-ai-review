import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import {
  DUO_CODE_SUGGESTIONS_LANGUAGES,
  DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE,
} from '../code_suggestions/constants';
import { createFakeWorkspaceConfiguration } from '../test_utils/vscode_fakes';
import {
  getDuoCodeSuggestionsLanguages,
  setDuoCodeSuggestionsConfiguration,
  parseDisabledSupportedLanguages,
  getDuoCodeSuggestionsConfiguration,
  getAgentPlatformConfiguration,
} from './extension_configuration';

describe('utils/extension_configuration', () => {
  describe('setDuoCodeSuggestionsConfiguration', () => {
    let mockAiConfig: vscode.WorkspaceConfiguration;

    beforeEach(() => {
      mockAiConfig = createFakePartial<vscode.WorkspaceConfiguration>({
        update: jest.fn().mockResolvedValue(undefined),
        inspect: jest.fn().mockReturnValue(undefined),
      });

      jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockAiConfig);
    });

    it('requests AI config', async () => {
      expect(vscode.workspace.getConfiguration).not.toHaveBeenCalled();

      await setDuoCodeSuggestionsConfiguration({
        enabled: true,
      });

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledTimes(1);
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(
        DUO_CODE_SUGGESTIONS_CONFIG_NAMESPACE,
      );
    });

    it.each`
      config                                         | mockInspect                  | expectedUpdate
      ${{ enabled: true }}                           | ${undefined}                 | ${[['enabled', true, vscode.ConfigurationTarget.Global]]}
      ${{ enabled: false }}                          | ${{ workspaceValue: false }} | ${[['enabled', false, vscode.ConfigurationTarget.Workspace]]}
      ${{ additionalLanguages: ['foo'] }}            | ${undefined}                 | ${[['additionalLanguages', ['foo'], vscode.ConfigurationTarget.Global]]}
      ${{ enabledSupportedLanguages: { c: false } }} | ${undefined}                 | ${[['enabledSupportedLanguages', { c: false }, vscode.ConfigurationTarget.Global]]}
      ${{ enabledSupportedLanguages: undefined }}    | ${undefined}                 | ${[['enabledSupportedLanguages', undefined, vscode.ConfigurationTarget.Global]]}
    `(
      'with config=$config and inspect=$mockInspect, should update',
      async ({ config, mockInspect, expectedUpdate }) => {
        jest.mocked(mockAiConfig.inspect).mockReturnValue(mockInspect);
        expect(mockAiConfig.update).not.toHaveBeenCalled();

        await setDuoCodeSuggestionsConfiguration(config);

        expect(jest.mocked(mockAiConfig.update).mock.calls).toEqual(expectedUpdate);
      },
    );
  });

  describe('getDuoCodeSuggestionsConfiguration', () => {
    describe('given valid values', () => {
      beforeEach(() => {
        jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
          createFakeWorkspaceConfiguration({
            enabled: true,
            suggestionsCache: undefined,
            additionalLanguages: ['foo'],
            enabledSupportedLanguages: { c: true, python: false },
            openTabsContext: true,
          }),
        );
      });

      it('return the values', () => {
        expect(getDuoCodeSuggestionsConfiguration()).toEqual({
          enabled: true,
          suggestionsCache: undefined,
          additionalLanguages: ['foo'],
          enabledSupportedLanguages: { c: true, python: false },
          openTabsContext: true,
        });
      });
    });

    describe('given invalid values', () => {
      beforeEach(() => {
        jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
          createFakeWorkspaceConfiguration({
            enabled: 'true',
            suggestionsCache: undefined,
            additionalLanguages: 'foo,bar',
            enabledSupportedLanguages: { c: 'true', python: null },
            openTabsContext: 'false',
          }),
        );
      });

      it('returns sensible default values', () => {
        expect(getDuoCodeSuggestionsConfiguration()).toEqual({
          enabled: true,
          suggestionsCache: undefined,
          additionalLanguages: [],
          enabledSupportedLanguages: {},
          openTabsContext: true,
        });
      });
    });
  });

  describe('parseDisabledSupportedLanguages', () => {
    it('should returns empty lists given empty configuration', () => {
      expect(parseDisabledSupportedLanguages({})).toEqual([]);
    });

    it('should return lists representing configured languages', () => {
      expect(parseDisabledSupportedLanguages({ cpp: true, python: false })).toEqual(['python']);
    });
  });

  describe('getAgentPlatformConfiguration', () => {
    describe('given valid values', () => {
      beforeEach(() => {
        jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
          createFakeWorkspaceConfiguration({
            enabled: false,
          }),
        );
      });

      it('should return the configured value', () => {
        expect(getAgentPlatformConfiguration()).toEqual(
          expect.objectContaining({
            enabled: false,
          }),
        );
      });
    });

    describe('given invalid values', () => {
      beforeEach(() => {
        jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
          createFakeWorkspaceConfiguration({
            enabled: 'false',
          }),
        );
      });

      it('should return default value when configuration is invalid', () => {
        expect(getAgentPlatformConfiguration()).toEqual(
          expect.objectContaining({
            enabled: true,
          }),
        );
      });
    });

    describe('given undefined values', () => {
      beforeEach(() => {
        jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
          createFakeWorkspaceConfiguration({
            enabled: undefined,
          }),
        );
      });

      it('should return default value when configuration is undefined', () => {
        expect(getAgentPlatformConfiguration()).toEqual(
          expect.objectContaining({
            enabled: true,
          }),
        );
      });
    });

    describe.each([
      { connectionType: undefined, expected: 'websocket' },
      { connectionType: 'grpc', expected: 'grpc' },
      { connectionType: 'websocket', expected: 'websocket' },
      { connectionType: 'invalid', expected: 'invalid' },
    ])('given connectionType: $connectionType', ({ connectionType, expected }) => {
      it('should return the configured connectionType', () => {
        jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
          createFakeWorkspaceConfiguration({
            enabled: true,
            connectionType,
          }),
        );

        expect(getAgentPlatformConfiguration()).toEqual({
          enabled: true,
          connectionType: expected,
          defaultNamespace: undefined,
          editFileDiffBehavior: 'foreground',
        });
      });
    });

    describe.each([
      { editFileDiffBehavior: undefined, expected: 'foreground' },
      { editFileDiffBehavior: 'foreground', expected: 'foreground' },
      { editFileDiffBehavior: 'background', expected: 'background' },
      { editFileDiffBehavior: 'none', expected: 'none' },
    ])(
      'given editFileDiffBehavior: $editFileDiffBehavior',
      ({ editFileDiffBehavior, expected }) => {
        it('should return the configured editFileDiffBehavior', () => {
          jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
            createFakeWorkspaceConfiguration({
              enabled: true,
              editFileDiffBehavior,
            }),
          );

          expect(getAgentPlatformConfiguration()).toEqual({
            enabled: true,
            connectionType: 'websocket',
            defaultNamespace: undefined,
            editFileDiffBehavior: expected,
          });
        });
      },
    );
  });

  describe('getDuoCodeSuggestionsLanguages', () => {
    it('should return DUO_CODE_SUGGESTIONS_LANGUAGES with user-configured languages', () => {
      const userConfiguredLanguages = ['foo', 'bar'];

      jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
        createFakeWorkspaceConfiguration({
          additionalLanguages: userConfiguredLanguages,
        }),
      );

      expect(getDuoCodeSuggestionsLanguages()).toEqual([
        ...DUO_CODE_SUGGESTIONS_LANGUAGES,
        ...userConfiguredLanguages,
      ]);
    });

    it('should return default languages when user settings are malformed', () => {
      jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
        createFakeWorkspaceConfiguration({
          additionalLanguages: false,
          enabledSupportedLanguages: null,
        }),
      );

      expect(getDuoCodeSuggestionsLanguages()).toEqual(DUO_CODE_SUGGESTIONS_LANGUAGES);
    });

    it('should not return disabled languages', () => {
      jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
        createFakeWorkspaceConfiguration({
          enabledSupportedLanguages: {
            c: false,
            cpp: true,
            python: false,
          },
        }),
      );

      const actual = getDuoCodeSuggestionsLanguages();
      expect(actual).toContain('cpp');
      expect(actual).not.toContain('c');
      expect(actual).not.toContain('python');
    });

    it('should not return languages both enabled and disabled by the user', () => {
      jest.mocked(vscode.workspace.getConfiguration).mockReturnValueOnce(
        createFakeWorkspaceConfiguration({
          additionalLanguages: ['python'],
          enabledSupportedLanguages: {
            python: false,
          },
        }),
      );

      expect(getDuoCodeSuggestionsLanguages()).not.toContain('python');
    });
  });
});
