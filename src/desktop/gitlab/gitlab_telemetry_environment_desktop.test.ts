import * as vscode from 'vscode';
import { createTelemetryChangeTrigger } from '../../common/test_utils/vscode_fakes';
import { IDE_EXTENSION_VERSION_SCHEMA_URL } from '../../common/snowplow/snowplow_options';
import { GitLabTelemetryEnvironmentDesktop } from './gitlab_telemetry_environment_desktop';

describe('GitLabTelemetryEnvironmentDesktop', () => {
  let telemetryEnvironmentDesktop: GitLabTelemetryEnvironmentDesktop;
  const triggerTelemetrySettingChange = createTelemetryChangeTrigger();
  describe('isTelemetryEnabled', () => {
    it.each`
      telemetryStatus
      ${true}
      ${false}
    `(
      'returns $telemetryStatus when vscode.env.isTelemetryEnabled is $telemetryStatus',
      ({ telemetryStatus }) => {
        Object.assign(vscode.env, { isTelemetryEnabled: telemetryStatus });
        telemetryEnvironmentDesktop = new GitLabTelemetryEnvironmentDesktop();

        expect(telemetryEnvironmentDesktop.isTelemetryEnabled()).toBe(telemetryStatus);
      },
    );
  });

  it('emits telemetry state change on VSCode setting change', async () => {
    const isTelemetryEnabled = true;

    const telemetryChangeListener = jest.fn();

    telemetryEnvironmentDesktop.onDidChangeTelemetryEnabled(isEnabled =>
      telemetryChangeListener(isEnabled),
    );
    await triggerTelemetrySettingChange(isTelemetryEnabled);
    expect(telemetryChangeListener).toHaveBeenCalledWith(isTelemetryEnabled);
  });

  it('buildIdeExtensionContext build desktop specific context', () => {
    expect(telemetryEnvironmentDesktop.buildIdeExtensionContext('1.0.0')).toStrictEqual({
      schema: IDE_EXTENSION_VERSION_SCHEMA_URL,
      data: {
        ide_name: 'Visual Studio Code',
        ide_vendor: 'Microsoft Corporation',
        ide_version: 'vscode-test-version-0.0',
        extension_name: 'GitLab Workflow',
        extension_version: '1.0.0',
      },
    });
  });
});
