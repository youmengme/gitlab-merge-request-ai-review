import { LanguageServerManager } from '../language_server/language_server_manager';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { GitLabInstanceVersionProvider } from './gitlab_instance_version_provider';
import { VersionStateProvider, VersionDetails } from './version_state_provider';

describe('VersionStateProvider', () => {
  const workflowVersion = '3.4.5';
  let versionStateProvider: VersionStateProvider;
  const lsVersionProvider = createFakePartial<LanguageServerManager>({
    onChange: jest.fn(),
    version: '3.3.3',
  });
  const glVersionProvider = createFakePartial<GitLabInstanceVersionProvider>({
    onChange: jest.fn(),
    version: 'gl-instance-version',
  });

  beforeEach(() => {
    versionStateProvider = new VersionStateProvider(
      workflowVersion,
      lsVersionProvider,
      glVersionProvider,
    );
  });

  it('should construct the correct versionStateProvider', () => {
    const expectedState: VersionDetails = {
      vscodeAppName: 'test-app-name',
      vscodeVersion: 'vscode-test-version-0.0',
      extensionVersion: workflowVersion,
      languageServerVersion: lsVersionProvider.version,
      gitlabInstanceVersion: glVersionProvider.version,
    };

    expect(versionStateProvider.state).toEqual(expectedState);
  });

  it('constructs the VersionStateProvider when languageServerVersion is undefined', () => {
    versionStateProvider = new VersionStateProvider(workflowVersion, undefined, glVersionProvider);
    const expectedState: VersionDetails = {
      vscodeAppName: 'test-app-name',
      vscodeVersion: 'vscode-test-version-0.0',
      extensionVersion: workflowVersion,
      languageServerVersion: undefined,
      gitlabInstanceVersion: glVersionProvider.version,
    };
    expect(versionStateProvider.state).toEqual(expectedState);
  });

  it('constructs the VersionStateProvider when gitlabInstanceVersion is undefined', () => {
    versionStateProvider = new VersionStateProvider(workflowVersion, lsVersionProvider, undefined);
    const expectedState: VersionDetails = {
      vscodeAppName: 'test-app-name',
      vscodeVersion: 'vscode-test-version-0.0',
      extensionVersion: workflowVersion,
      languageServerVersion: lsVersionProvider.version,
      gitlabInstanceVersion: undefined,
    };
    expect(versionStateProvider.state).toEqual(expectedState);
  });
});
