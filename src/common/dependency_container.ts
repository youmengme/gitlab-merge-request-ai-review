import { LSGitProvider } from './git/ls_git_provider';
import { GitLabPlatformManager } from './platform/gitlab_platform';
import { GitLabTelemetryEnvironment } from './platform/gitlab_telemetry_environment';

export interface DependencyContainer {
  readonly gitLabTelemetryEnvironment: GitLabTelemetryEnvironment;
  readonly gitLabPlatformManager: GitLabPlatformManager;
  readonly lsGitProvider: LSGitProvider;
}
