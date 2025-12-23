import { VersionDetails } from '../../state/version_state_provider';
import { VersionDiagnosticsRenderer } from './version_diagnostics_renderer';

describe('VersionDiagnosticsRenderer', () => {
  let mockVersionDiagnosticsRenderer: VersionDiagnosticsRenderer;
  let mockVersionDetails: VersionDetails;
  let mockVersionTitle: string;

  beforeEach(() => {
    mockVersionDiagnosticsRenderer = new VersionDiagnosticsRenderer();
    mockVersionDetails = {
      vscodeAppName: 'Test App',
      vscodeVersion: '1.2.3',
      extensionVersion: '1.2.3',
      languageServerVersion: '1.2.3',
      gitlabInstanceVersion: '1.2.3',
    };
    mockVersionTitle = 'Versions';
  });

  it('formats versions section information', () => {
    const result = mockVersionDiagnosticsRenderer.render([mockVersionDetails]);
    const expectedContent = `- IDE: ${mockVersionDetails.vscodeAppName} (${mockVersionDetails.vscodeVersion})\n- Extension: GitLab Workflow version (${mockVersionDetails.extensionVersion})\n- Language Server version: ${mockVersionDetails.languageServerVersion}\n- GitLab instance version: ${mockVersionDetails.gitlabInstanceVersion}`;

    expect(result[0].title).toBe(mockVersionTitle);
    expect(result[0].content).toBe(expectedContent);
  });

  it('formats versions section information when optional version providers are undefined', () => {
    mockVersionDetails.languageServerVersion = undefined;
    mockVersionDetails.gitlabInstanceVersion = undefined;
    const result = mockVersionDiagnosticsRenderer.render([mockVersionDetails]);
    const expectedContent = `- IDE: ${mockVersionDetails.vscodeAppName} (${mockVersionDetails.vscodeVersion})\n- Extension: GitLab Workflow version (${mockVersionDetails.extensionVersion})\n- Language Server version: Not available\n- GitLab instance version: Not available`;

    expect(result[0].title).toBe(mockVersionTitle);
    expect(result[0].content).toBe(expectedContent);
  });
});
