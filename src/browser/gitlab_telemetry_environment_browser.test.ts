import * as vscode from 'vscode';
import { WebIDEExtension } from '../common/platform/web_ide';
import { createFakePartial } from '../common/test_utils/create_fake_partial';
import { IDE_EXTENSION_VERSION_SCHEMA_URL } from '../common/snowplow/snowplow_options';
import { GitLabTelemetryEnvironmentBrowser } from './gitlab_telemetry_environment_browser';

describe('GitLabTelemetryEnvironmentBrowser', () => {
  let subject: GitLabTelemetryEnvironmentBrowser;
  let webIDEExtensionMock: WebIDEExtension;

  beforeEach(async () => {
    webIDEExtensionMock = createFakePartial<WebIDEExtension>({
      isTelemetryEnabled: jest.fn(),
    });
    jest.mocked(vscode.extensions.getExtension).mockReturnValueOnce(
      createFakePartial<vscode.Extension<WebIDEExtension>>({
        exports: webIDEExtensionMock,
      }),
    );
    subject = new GitLabTelemetryEnvironmentBrowser(webIDEExtensionMock);
  });

  describe('isTelemetryEnabled', () => {
    it.each`
      telemetryStatus
      ${true}
      ${false}
    `(
      'returns telemetry $telemetryStatus when the Web IDE extension isTelemetryEnabled returns $telemetryStatus',
      async ({ telemetryStatus }) => {
        jest.mocked(webIDEExtensionMock.isTelemetryEnabled).mockReturnValueOnce(telemetryStatus);

        expect(subject.isTelemetryEnabled()).toBe(telemetryStatus);
      },
    );
  });

  it('buildIdeExtensionContext build webIDE specific context', () => {
    expect(subject.buildIdeExtensionContext('1.0.0')).toStrictEqual({
      schema: IDE_EXTENSION_VERSION_SCHEMA_URL,
      data: {
        ide_name: 'GitLab Web IDE',
        ide_vendor: 'GitLab Inc.',
        ide_version: 'vscode-test-version-0.0',
        extension_name: 'GitLab Workflow',
        extension_version: '1.0.0',
      },
    });
  });
});
