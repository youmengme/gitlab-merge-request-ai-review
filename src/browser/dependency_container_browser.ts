import { DependencyContainer } from '../common/dependency_container';
import { DefaultLSGitProvider } from '../common/git/ls_git_provider';
import { WebIDEExtension } from '../common/platform/web_ide';
import { createGitLabPlatformManagerBrowser } from './gitlab_platform_browser';
import { GitLabTelemetryEnvironmentBrowser } from './gitlab_telemetry_environment_browser';

export const createDependencyContainer = async (
  webIdeExtension: WebIDEExtension,
): Promise<DependencyContainer> => ({
  gitLabPlatformManager: await createGitLabPlatformManagerBrowser(webIdeExtension),
  gitLabTelemetryEnvironment: new GitLabTelemetryEnvironmentBrowser(webIdeExtension),
  lsGitProvider: new DefaultLSGitProvider(),
});
