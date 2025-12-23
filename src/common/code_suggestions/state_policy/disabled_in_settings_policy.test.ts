import * as vscode from 'vscode';
import {
  createConfigurationChangeTrigger,
  createFakeWorkspaceConfiguration,
} from '../../test_utils/vscode_fakes';
import { DISABLED_VIA_SETTINGS, DisabledInSettingsPolicy } from './disabled_in_settings_policy';

describe('DisabledInSettingsPolicy', () => {
  let triggerSettingsRefresh: () => void;
  let policy: DisabledInSettingsPolicy;

  beforeEach(() => {
    triggerSettingsRefresh = createConfigurationChangeTrigger();
    jest
      .mocked(vscode.workspace.getConfiguration)
      .mockReturnValue(createFakeWorkspaceConfiguration({ enabled: true }));
    policy = new DisabledInSettingsPolicy();
  });

  it('has DISABLED_VIA_SETTINGS state', () => {
    expect(policy.state).toBe(DISABLED_VIA_SETTINGS);
  });

  it('is not engaged when the setting is enabled', () => {
    expect(policy.engaged).toBe(false);
  });

  it('is engaged when the setting is disabled', () => {
    jest
      .mocked(vscode.workspace.getConfiguration)
      .mockReturnValue(createFakeWorkspaceConfiguration({ enabled: false }));

    triggerSettingsRefresh();

    expect(policy.engaged).toBe(true);
  });

  it('triggers on change event when the engaged state changes', () => {
    jest
      .mocked(vscode.workspace.getConfiguration)
      .mockReturnValue(createFakeWorkspaceConfiguration({ enabled: false }));

    const listener = jest.fn();
    policy.onEngagedChange(listener);

    triggerSettingsRefresh();

    expect(listener).toHaveBeenCalledWith(true);
  });
});
