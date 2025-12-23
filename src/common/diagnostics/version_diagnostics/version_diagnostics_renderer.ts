import { DiagnosticsRenderer, DiagnosticsSection } from '../diagnostics_service';
import { VersionDetails, VersionDetailsStateKey } from '../../state/version_state_provider';

const createVersionDiagnosticsSection = (details: VersionDetails): DiagnosticsSection => {
  return {
    title: 'Versions',
    content: [
      `- IDE: ${details.vscodeAppName} (${details.vscodeVersion})`,
      `- Extension: GitLab Workflow version (${details.extensionVersion})`,
      `- Language Server version: ${details.languageServerVersion ?? 'Not available'}`,
      `- GitLab instance version: ${details.gitlabInstanceVersion ?? 'Not available'}`,
    ].join('\n'),
  };
};

export class VersionDiagnosticsRenderer implements DiagnosticsRenderer<[VersionDetails]> {
  keys = [VersionDetailsStateKey] as const;

  render([versionDetails]: [VersionDetails]): DiagnosticsSection[] {
    return [createVersionDiagnosticsSection(versionDetails)];
  }
}
export { VersionDetailsStateKey };
