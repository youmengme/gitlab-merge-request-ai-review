import { GITLAB_COM_URL } from '../constants';

export const GITLAB_STAGING_URL: string = 'https://staging.gitlab.com';
export const GITLAB_ORG_URL: string = 'https://dev.gitlab.org';
export const GITLAB_DEVELOPMENT_URL: string = 'http://localhost';

export enum GitLabEnvironment {
  GITLAB_COM = 'production',
  GITLAB_STAGING = 'staging',
  GITLAB_ORG = 'org',
  GITLAB_DEVELOPMENT = 'development',
  GITLAB_SELF_MANAGED = 'self-managed',
}

export const getEnvironment: (instanceUrl: string) => GitLabEnvironment = instanceUrl => {
  switch (instanceUrl) {
    case GITLAB_COM_URL:
      return GitLabEnvironment.GITLAB_COM;
    case GITLAB_DEVELOPMENT_URL:
      return GitLabEnvironment.GITLAB_DEVELOPMENT;
    case GITLAB_STAGING_URL:
      return GitLabEnvironment.GITLAB_STAGING;
    case GITLAB_ORG_URL:
      return GitLabEnvironment.GITLAB_ORG;
    default:
      return GitLabEnvironment.GITLAB_SELF_MANAGED;
  }
};
