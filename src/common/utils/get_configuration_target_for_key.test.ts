import * as vscode from 'vscode';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { getConfigurationTargetForKey } from './get_configuration_target_for_key';

type ConfigurationInspection = Omit<ReturnType<vscode.WorkspaceConfiguration['inspect']>, 'key'>;

const CONFIG_KEY = 'lorem';

describe('utils/get_configuration_target_for_key', () => {
  const createFakeConfiguration = (mockKey: string, mockInspection: ConfigurationInspection) =>
    createFakePartial<vscode.WorkspaceConfiguration>({
      inspect(key: string) {
        if (key === mockKey) {
          return {
            ...mockInspection,
            key: mockKey,
          };
        }

        return undefined;
      },
    });

  it.each`
    mockInspection                         | expectation
    ${undefined}                           | ${vscode.ConfigurationTarget.Global}
    ${{ workspaceFolderValue: false }}     | ${vscode.ConfigurationTarget.WorkspaceFolder}
    ${{ workspaceFolderLanguageValue: 0 }} | ${vscode.ConfigurationTarget.WorkspaceFolder}
    ${{ workspaceValue: true }}            | ${vscode.ConfigurationTarget.Workspace}
    ${{ workspaceLanguageValue: false }}   | ${vscode.ConfigurationTarget.Workspace}
    ${{ defaultValue: true }}              | ${vscode.ConfigurationTarget.Global}
  `('with $mockInspection, result is $expectation', ({ mockInspection, expectation }) => {
    const config = createFakeConfiguration(CONFIG_KEY, mockInspection);

    const result = getConfigurationTargetForKey(config, CONFIG_KEY);

    expect(result).toEqual(expectation);
  });
});
