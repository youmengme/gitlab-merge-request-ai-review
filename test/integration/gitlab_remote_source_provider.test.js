const assert = require('assert');
const { graphql, HttpResponse } = require('msw');
const { GitLabRemoteSource } = require('../../src/desktop/gitlab/clone/gitlab_remote_source');
const { accountService } = require('../../src/desktop/accounts/account_service');
const projectsResponse = require('./fixtures/graphql/projects_with_repository_info.json');
const { getServer } = require('./test_infrastructure/mock_server');

const validateRemoteSource = remoteSources => {
  assert.strictEqual(remoteSources.length, 1);

  const [remoteSource] = remoteSources;
  assert.strictEqual(remoteSource.name, '$(repo) gitlab-org/gitlab');
  assert.strictEqual(remoteSource.description, 'The GitLab Project');
  assert.deepStrictEqual(remoteSource.url, [
    'git@test.gitlab.com:gitlab-org/gitlab.git',
    'https://test.gitlab.com/gitlab-org/gitlab.git',
  ]);
  assert.deepStrictEqual(remoteSource.wikiUrl, [
    'git@test.gitlab.com:gitlab-org/gitlab.wiki.git',
    'https://test.gitlab.com/gitlab-org/gitlab.wiki.git',
  ]);
  assert.strictEqual(remoteSource.project.id, 'gid://gitlab/Project/278964');
};

describe('GitLab Remote Source', () => {
  let server;

  const [account] = accountService.getAllAccounts();

  before(async () => {
    server = getServer([
      graphql.query('GetProjectsWithRepositoryInfo', ({ variables }) => {
        if (variables.search === 'GitLab') return HttpResponse.json({ data: projectsResponse });
        if (variables.search === 'nonexistent')
          return HttpResponse.json({ data: { projects: { nodes: [] } } });
        return HttpResponse.json({ data: projectsResponse });
      }),
    ]);
  });

  after(async () => {
    server.close();
  });

  it('projects are fetched with full search', async () => {
    const sourceProvider = new GitLabRemoteSource(account);

    const remoteSources = await sourceProvider.getRemoteSources();

    validateRemoteSource(remoteSources);
  });

  it('project search returns one result', async () => {
    const sourceProvider = new GitLabRemoteSource(account);

    const remoteSources = await sourceProvider.getRemoteSources('GitLab');

    validateRemoteSource(remoteSources);
  });

  it('projects search with nonexistent project returns no result', async () => {
    const sourceProvider = new GitLabRemoteSource(account);

    assert.deepStrictEqual(
      await sourceProvider.getRemoteSources('nonexistent'),
      [],
      'search for "nonexistent" repository should return no result',
    );
  });
});
