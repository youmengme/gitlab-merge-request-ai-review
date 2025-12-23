import * as vscode from 'vscode';
import { CONFIG_NAMESPACE } from '../constants';
import { createFakePartial } from './create_fake_partial';

export const createFakeWorkspaceConfiguration = (
  config: Record<string, unknown>,
): vscode.WorkspaceConfiguration => {
  return createFakePartial<vscode.WorkspaceConfiguration>({
    ...config,
    get: jest.fn(section => config[section]),
    inspect: jest.fn(),
    update: jest.fn(),
  });
};

export const setFakeWorkspaceConfiguration = (config: Record<string, unknown>) => {
  const configuration = createFakeWorkspaceConfiguration(config);

  jest.mocked(vscode.workspace.getConfiguration).mockImplementation(section => {
    if (section === CONFIG_NAMESPACE) {
      return configuration;
    }

    return createFakeWorkspaceConfiguration({});
  });
};

type VoidFunction = () => void;

export const createConfigurationChangeTrigger = () => {
  const settingsRefreshTriggers: VoidFunction[] = [];

  jest.mocked(vscode.workspace.onDidChangeConfiguration).mockImplementation(listener => {
    settingsRefreshTriggers.push(() => listener({ affectsConfiguration: () => true }));

    return { dispose: () => {} };
  });

  return async () => {
    if (!settingsRefreshTriggers.length) {
      throw new Error('no setting change listeners were registered');
    }

    await Promise.all(
      settingsRefreshTriggers.map(async trigger => {
        await trigger();
      }),
    );
  };
};

export const createActiveColorThemeChangeTrigger = () => {
  const triggers: ((e: vscode.ColorTheme) => void)[] = [];

  jest.mocked(vscode.window.onDidChangeActiveColorTheme).mockImplementation(listener => {
    triggers.push(listener);
    return { dispose: () => {} };
  });

  return async (e: vscode.ColorTheme) => {
    if (!triggers.length) {
      throw new Error('no setting change listeners were registered');
    }

    await Promise.all(
      triggers.map(async trigger => {
        await trigger(e);
      }),
    );
  };
};

export const createActiveTextEditorChangeTrigger = () => {
  let triggerTextEditorChange: ((te: vscode.TextEditor) => Promise<void> | void) | undefined;

  jest.mocked(vscode.window.onDidChangeActiveTextEditor).mockImplementation(listener => {
    triggerTextEditorChange = async te => listener(te);
    return { dispose: () => {} };
  });
  return async (te: vscode.TextEditor) => {
    if (!triggerTextEditorChange) {
      throw new Error('no active editor change listeners were registered');
    }
    await triggerTextEditorChange(te);
  };
};

export const createTelemetryChangeTrigger = () => {
  let triggerTelemetryChange: ((enabled: boolean) => Promise<void> | void) | undefined;

  jest.mocked(vscode.env.onDidChangeTelemetryEnabled).mockImplementation(listener => {
    triggerTelemetryChange = async enabled => listener(enabled);
    return {
      dispose: () => {},
    };
  });
  return async (enabled: boolean) => {
    if (!triggerTelemetryChange) {
      throw new Error('no telemetry change listeners were registered');
    }
    await triggerTelemetryChange(enabled);
  };
};
