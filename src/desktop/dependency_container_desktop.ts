import { DependencyContainer } from '../common/dependency_container';
import { LSGitProviderDesktop } from './git/ls_git_provider';
import { gitlabPlatformManagerDesktop } from './gitlab/gitlab_platform_desktop';
import { GitLabTelemetryEnvironmentDesktop } from './gitlab/gitlab_telemetry_environment_desktop';

export const createDependencyContainer = (): DependencyContainer => ({
  gitLabPlatformManager: gitlabPlatformManagerDesktop,
  gitLabTelemetryEnvironment: new GitLabTelemetryEnvironmentDesktop(),
  lsGitProvider: new LSGitProviderDesktop(),
});
