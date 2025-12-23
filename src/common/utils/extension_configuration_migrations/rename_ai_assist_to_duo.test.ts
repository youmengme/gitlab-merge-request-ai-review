import * as vscode from 'vscode';
import { createFakeWorkspaceConfiguration } from '../../test_utils/vscode_fakes';
import { ConfigInspectionResult, renameAiAssistToDuo } from './rename_ai_assist_to_duo';

describe('renameAiAssistToDuo', () => {
  let mockConfig: vscode.WorkspaceConfiguration;

  function mockWorkspaceConfiguration(
    config: Partial<vscode.WorkspaceConfiguration>,
    inspectionProperty: string,
  ) {
    mockConfig = createFakeWorkspaceConfiguration(config);
    jest.mocked(mockConfig.update).mockResolvedValue(undefined);
    jest.mocked(mockConfig.inspect).mockImplementation(key => {
      return {
        [inspectionProperty]: config[key],
      } as ConfigInspectionResult;
    });

    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig);
  }

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe.each([
    { configurationTarget: vscode.ConfigurationTarget.Global, inspectionProperty: 'globalValue' },
    {
      configurationTarget: vscode.ConfigurationTarget.Workspace,
      inspectionProperty: 'workspaceValue',
    },
    {
      configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
      inspectionProperty: 'workspaceFolderValue',
    },
  ])('for "$inspectionProperty" config', ({ configurationTarget, inspectionProperty }) => {
    describe('when old namespace does not have any values', () => {
      beforeEach(() => mockWorkspaceConfiguration({}, inspectionProperty));

      it('does not perform any migrations', async () => {
        await renameAiAssistToDuo();

        expect(mockConfig.update).not.toHaveBeenCalled();
      });
    });

    describe('when old namespace has values', () => {
      describe('which are valid', () => {
        beforeEach(() =>
          mockWorkspaceConfiguration(
            {
              'gitlab.aiAssistedCodeSuggestions.enabled': true,
              'gitlab.aiAssistedCodeSuggestions.openTabsContext': false,
              'gitlab.aiAssistedCodeSuggestions.enabledSupportedLanguages': {
                java: true,
                python: false,
              },
              'gitlab.aiAssistedCodeSuggestions.additionalLanguages': ['ruby', 'go'],
              'gitlab.aiAssistedCodeSuggestions.fooBarWowSoUnknown': true,
            },
            inspectionProperty,
          ),
        );

        it('does not migrate unknown configuration', async () => {
          await renameAiAssistToDuo();

          expect(mockConfig.update).not.toHaveBeenCalledWith(
            'gitlab.aiAssistedCodeSuggestions.fooBarWowSoUnknown',
            expect.anything(),
            expect.anything(),
          );
          // 4 add + 4 remove for valid items, no 11th call for unknown item
          expect(mockConfig.update).toHaveBeenCalledTimes(8);
        });

        it('migrates "enabled" configuration', async () => {
          await renameAiAssistToDuo();

          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.duoCodeSuggestions.enabled',
            true,
            configurationTarget,
          );
          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.aiAssistedCodeSuggestions.enabled',
            undefined,
            configurationTarget,
          );
        });

        it('migrates "openTabsContext" configuration', async () => {
          await renameAiAssistToDuo();

          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.duoCodeSuggestions.openTabsContext',
            false,
            configurationTarget,
          );
          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.aiAssistedCodeSuggestions.openTabsContext',
            undefined,
            configurationTarget,
          );
        });

        it('migrates "enabledSupportedLanguages" configuration', async () => {
          await renameAiAssistToDuo();

          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.duoCodeSuggestions.enabledSupportedLanguages',
            { java: true, python: false },
            configurationTarget,
          );
          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.aiAssistedCodeSuggestions.enabledSupportedLanguages',
            undefined,
            configurationTarget,
          );
        });

        it('migrates "additionalLanguages" configuration', async () => {
          await renameAiAssistToDuo();

          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.duoCodeSuggestions.additionalLanguages',
            ['ruby', 'go'],
            configurationTarget,
          );
          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.aiAssistedCodeSuggestions.additionalLanguages',
            undefined,
            configurationTarget,
          );
        });
      });

      describe('which are invalid', () => {
        it('removes invalid old configuration', async () => {
          mockWorkspaceConfiguration(
            {
              'gitlab.aiAssistedCodeSuggestions.enabled': 'not a boolean',
            },
            inspectionProperty,
          );

          await renameAiAssistToDuo();

          expect(mockConfig.update).toHaveBeenCalledWith(
            'gitlab.aiAssistedCodeSuggestions.enabled',
            undefined,
            configurationTarget,
          );
        });

        it('does not migrate invalid boolean value', async () => {
          mockWorkspaceConfiguration(
            {
              'gitlab.aiAssistedCodeSuggestions.enabled': 'not a boolean',
            },
            inspectionProperty,
          );

          await renameAiAssistToDuo();

          expect(mockConfig.update).not.toHaveBeenCalledWith(
            'gitlab.duoCodeSuggestions.enabled',
            'not a boolean',
            configurationTarget,
          );
          expect(mockConfig.update).toHaveBeenCalledTimes(1);
        });

        it('does not migrate invalid array value', async () => {
          mockWorkspaceConfiguration(
            {
              'gitlab.aiAssistedCodeSuggestions.additionalLanguages': 'not an array',
            },
            inspectionProperty,
          );

          await renameAiAssistToDuo();

          expect(mockConfig.update).not.toHaveBeenCalledWith(
            'gitlab.duoCodeSuggestions.additionalLanguages',
            'not an array',
            configurationTarget,
          );
          expect(mockConfig.update).toHaveBeenCalledTimes(1);
        });

        it('does not migrate invalid object value', async () => {
          mockWorkspaceConfiguration(
            {
              'gitlab.aiAssistedCodeSuggestions.enabledSupportedLanguages': ['not', 'an', 'object'],
            },
            inspectionProperty,
          );

          await renameAiAssistToDuo();

          expect(mockConfig.update).not.toHaveBeenCalledWith(
            'gitlab.duoCodeSuggestions.enabledSupportedLanguages',
            ['not', 'an', 'object'],
            configurationTarget,
          );
          expect(mockConfig.update).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('when both old and new namespaces have values', () => {
      beforeEach(() =>
        mockWorkspaceConfiguration(
          {
            'gitlab.aiAssistedCodeSuggestions.enabled': false,
            'gitlab.duoCodeSuggestions.enabled': true,
            'gitlab.duoCodeSuggestions.openTabsContext': false,
          },
          inspectionProperty,
        ),
      );

      it('removes old config values which already exist in the new namespace', async () => {
        await renameAiAssistToDuo();

        expect(mockConfig.update).toHaveBeenCalledWith(
          'gitlab.aiAssistedCodeSuggestions.enabled',
          undefined,
          configurationTarget,
        );
      });

      it('does not replace existing new values with old', async () => {
        await renameAiAssistToDuo();

        expect(mockConfig.update).not.toHaveBeenCalledWith(
          'gitlab.duoCodeSuggestions.enabled',
          false,
          configurationTarget,
        );

        expect(mockConfig.update).toHaveBeenCalledTimes(1);
      });

      it('does not modify other config values in the new namespace', async () => {
        await renameAiAssistToDuo();

        expect(mockConfig.update).not.toHaveBeenCalledWith(
          'gitlab.duoCodeSuggestions.openTabsContext',
          expect.anything(),
          expect.anything(),
        );
        expect(mockConfig.update).toHaveBeenCalledTimes(1);
      });
    });
  });
});
