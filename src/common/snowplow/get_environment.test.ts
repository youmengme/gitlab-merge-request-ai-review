import { getEnvironment, GitLabEnvironment } from './get_environment';

describe('getEnvironment', () => {
  test.each([
    ['https://gitlab.com', GitLabEnvironment.GITLAB_COM],
    ['http://localhost', GitLabEnvironment.GITLAB_DEVELOPMENT],
    ['https://staging.gitlab.com', GitLabEnvironment.GITLAB_STAGING],
    ['https://dev.gitlab.org', GitLabEnvironment.GITLAB_ORG],
    ['https://custom.gitlab.example.com', GitLabEnvironment.GITLAB_SELF_MANAGED],
  ])('returns correct environment for %s', (url, expected) => {
    expect(getEnvironment(url)).toBe(expected);
  });
});
