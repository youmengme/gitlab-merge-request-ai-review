import { parseGitLabRemote, parseProject, parseProjects } from './git_remote_parser';

describe('git_remote_parser', () => {
  it.each([
    [
      'git@gitlab.com:fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'ssh:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'gitlab-ci@gitlab-mydomain.com:fatihacet/gitlab-vscode-extension.git',
      [
        'gitlab-mydomain.com',
        'gitlab-mydomain.com',
        'ssh:',
        'fatihacet',
        'gitlab-vscode-extension',
      ],
    ],
    [
      'ssh://git@gitlab.com:fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'ssh:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'git://git@gitlab.com:fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'ssh:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'http://git@gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'http:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'http://gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'http:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'https://git@gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'https:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'https://gitlab.com/fatihacet/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'https:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'git@gitlab.com:group/subgroup/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'ssh:', 'group/subgroup', 'gitlab-vscode-extension'],
    ],
    [
      'http://gitlab.com/group/subgroup/gitlab-vscode-extension.git',
      ['gitlab.com', 'gitlab.com', 'http:', 'group/subgroup', 'gitlab-vscode-extension'],
    ],
    [
      'https://gitlab.com/fatihacet/gitlab-vscode-extension',
      ['gitlab.com', 'gitlab.com', 'https:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      'https://gitlab.company.com/fatihacet/gitlab-vscode-extension.git',
      [
        'gitlab.company.com',
        'gitlab.company.com',
        'https:',
        'fatihacet',
        'gitlab-vscode-extension',
      ],
    ],
    [
      'https://gitlab.company.com:8443/fatihacet/gitlab-vscode-extension.git',
      [
        'gitlab.company.com:8443',
        'gitlab.company.com',
        'https:',
        'fatihacet',
        'gitlab-vscode-extension',
      ],
    ],
    [
      // trailing / can be present if user copied the repo URL from the browser navigation bar
      'https://gitlab.company.com:8443/fatihacet/gitlab-vscode-extension/',
      [
        'gitlab.company.com:8443',
        'gitlab.company.com',
        'https:',
        'fatihacet',
        'gitlab-vscode-extension',
      ],
    ],
    [
      // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/309
      // This one is wrong: the host should be example.com:2222
      '[git@example.com:2222]:fatihacet/gitlab-vscode-extension.git',
      ['example.com', 'example.com', 'ssh:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/611
      'git@example.com:2222/fatihacet/gitlab-vscode-extension.git',
      ['example.com', 'example.com', 'ssh:', '2222/fatihacet', 'gitlab-vscode-extension'],
    ],
    [
      // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/644
      // This one is wrong: the host should be example.com:2222
      'ssh://git@example.com:2222/fatihacet/gitlab-vscode-extension.git',
      ['example.com', 'example.com', 'ssh:', 'fatihacet', 'gitlab-vscode-extension'],
    ],
  ])('should parse %s', (remote, parsed) => {
    const [host, hostname, protocol, namespace, projectPath] = parsed;
    expect(parseGitLabRemote(remote, 'https://gitlab.com')).toEqual({
      host,
      hostname,
      protocol,
      namespace,
      projectPath,
      namespaceWithPath: `${namespace}/${projectPath}`,
    });
  });

  // For more details see https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/merge_requests/11
  it('should support self managed GitLab on a custom path', () => {
    expect(
      parseGitLabRemote(
        'https://example.com/gitlab/fatihacet/gitlab-vscode-extension',
        'https://example.com/gitlab',
      ),
    ).toEqual({
      host: 'example.com',
      hostname: 'example.com',
      namespace: 'fatihacet',
      projectPath: 'gitlab-vscode-extension',
      protocol: 'https:',
      namespaceWithPath: 'fatihacet/gitlab-vscode-extension',
    });
  });
  // For more details see: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/103
  it('should parse remote URLs without custom path even if the instance has custom path', () => {
    expect(
      parseGitLabRemote(
        'git@example.com:fatihacet/gitlab-vscode-extension.git',
        'https://example.com/gitlab',
      ),
    ).toEqual({
      host: 'example.com',
      hostname: 'example.com',
      namespace: 'fatihacet',
      projectPath: 'gitlab-vscode-extension',
      protocol: 'ssh:',
      namespaceWithPath: 'fatihacet/gitlab-vscode-extension',
    });
  });

  it('fails to parse remote URL without namespace', () => {
    expect(parseGitLabRemote('git@host:no-namespace-repo.git')).toBeUndefined();
  });

  it('fails to parse relative path', () => {
    expect(parseGitLabRemote('../relative/path')).toBeUndefined();
  });
});

describe('parseProject', () => {
  it('parses project when remote URL matches instance URL host', () => {
    const result = parseProject(
      'git@gitlab.com:gitlab-org/gitlab-vscode-extension.git',
      'https://gitlab.com',
    );

    expect(result).toEqual({
      host: 'gitlab.com',
      hostname: 'gitlab.com',
      namespace: 'gitlab-org',
      projectPath: 'gitlab-vscode-extension',
      namespaceWithPath: 'gitlab-org/gitlab-vscode-extension',
      remoteUrl: 'git@gitlab.com:gitlab-org/gitlab-vscode-extension.git',
      protocol: 'ssh:',
      instanceUrl: 'https://gitlab.com',
    });
  });

  it('parses project when remote ssh URL hostname matches instance URL hostname, but using different ports', () => {
    const result = parseProject(
      'git@example.com:gitlab-org/gitlab-vscode-extension.git',
      'https://example.com:1234',
    );

    expect(result).toEqual({
      host: 'example.com',
      hostname: 'example.com',
      namespace: 'gitlab-org',
      projectPath: 'gitlab-vscode-extension',
      namespaceWithPath: 'gitlab-org/gitlab-vscode-extension',
      remoteUrl: 'git@example.com:gitlab-org/gitlab-vscode-extension.git',
      protocol: 'ssh:',
      instanceUrl: 'https://example.com:1234',
    });
  });

  it('return undefined when remote https URL hostname matches instance URL hostname, but using different ports', () => {
    const result = parseProject(
      'https://example.com:4321/fatihacet/gitlab-vscode-extension.git',
      'https://example.com:1234',
    );

    expect(result).toBeUndefined();
  });

  it('returns undefined when remote URL host does not match instance URL host', () => {
    const result = parseProject(
      'git@gitlab.com:gitlab-org/gitlab-vscode-extension.git',
      'https://example.com',
    );

    expect(result).toBeUndefined();
  });
});

describe('parseProjects', () => {
  it('parses multiple remotes', () => {
    const remoteUrls = [
      'git@gitlab.com:gitlab-org/gitlab-vscode-extension.git',
      'git@example.com:group/project.git',
    ];
    const instanceUrl = 'https://gitlab.com';

    const results = parseProjects(remoteUrls, instanceUrl);

    expect(results).toHaveLength(1);
    expect(results[0]?.namespaceWithPath).toBe('gitlab-org/gitlab-vscode-extension');
  });

  it('filters out non-matching combinations', () => {
    const remoteUrls = ['git@gitlab.com:gitlab-org/gitlab-vscode-extension.git'];
    const instanceUrl = 'https://example.com';

    const results = parseProjects(remoteUrls, instanceUrl);

    expect(results).toHaveLength(0);
  });
});
