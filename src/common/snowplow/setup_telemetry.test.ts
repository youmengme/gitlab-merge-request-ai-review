import * as vscode from 'vscode';
import { GitLabTelemetryEnvironment } from '../platform/gitlab_telemetry_environment';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { setupTelemetry } from './setup_telemetry';
import { Snowplow } from './snowplow';

jest.mock('./snowplow');

describe('setupTelemetry', () => {
  let telemetryEnvironment: GitLabTelemetryEnvironment;
  let extensionContext: vscode.ExtensionContext;

  beforeEach(() => {
    telemetryEnvironment = createFakePartial<GitLabTelemetryEnvironment>({
      isTelemetryEnabled: jest.fn().mockReturnValue(false),
      // buildIdeExtensionContext varies by environment. Mocking implementation for general testing
      buildIdeExtensionContext: jest.fn().mockImplementation(version => ({
        schema: 'iglu:com.gitlab/ide_extension_version/jsonschema/1-0-0',
        data: {
          ide_name: 'Visual Studio Code',
          ide_vendor: 'Microsoft Corporation',
          ide_version: 'vscode-test-version-0.0',
          extension_name: 'GitLab Workflow',
          extension_version: version,
        },
      })),
    });
    extensionContext = createFakePartial<vscode.ExtensionContext>({
      extension: {
        packageJSON: {},
      },
    });
  });

  const getSnowplowInstanceOptions = () => jest.mocked(Snowplow.getInstance).mock.calls[0][0];

  it('initializes snowplow', async () => {
    setupTelemetry(extensionContext, telemetryEnvironment);
    expect(Snowplow.getInstance).toHaveBeenCalledTimes(1);
    expect(getSnowplowInstanceOptions()).toEqual({
      appId: 'gitlab_ide_extension',
      enabled: expect.any(Function),
      endpoint: 'https://snowplowprd.trx.gitlab.net',
      ideExtensionContext: {
        data: {
          extension_name: 'GitLab Workflow',
          extension_version: 'unknown',
          ide_name: 'Visual Studio Code',
          ide_vendor: 'Microsoft Corporation',
          ide_version: 'vscode-test-version-0.0',
        },
        schema: 'iglu:com.gitlab/ide_extension_version/jsonschema/1-0-0',
      },
      maxItems: 10,
      timeInterval: 5000,
    });
  });

  it('uses extension version when available', () => {
    extensionContext = createFakePartial<vscode.ExtensionContext>({
      extension: {
        packageJSON: {
          version: '3.3.3',
        },
      },
    });

    setupTelemetry(extensionContext, telemetryEnvironment);

    expect(Snowplow.getInstance).toHaveBeenCalledTimes(1);
    expect(getSnowplowInstanceOptions()).toMatchObject({
      ideExtensionContext: {
        data: {
          extension_version: '3.3.3',
        },
      },
    });
  });

  it.each([true, false])('uses telemetry environment for enabled when enabled=%s', isEnabled => {
    jest.mocked(telemetryEnvironment.isTelemetryEnabled).mockReturnValue(isEnabled);
    setupTelemetry(extensionContext, telemetryEnvironment);
    expect(getSnowplowInstanceOptions()?.enabled()).toBe(isEnabled);
  });
});
