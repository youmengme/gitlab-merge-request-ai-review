import { GraphQLClient } from 'graphql-request';
import fetch from '../../common/fetch_logged';
import { testSnippet1 } from '../../../test/integration/fixtures/graphql/snippets';
import { DEFAULT_FETCH_RESPONSE } from '../../common/__mocks__/fetch_logged';
import { CustomQueryType } from '../../common/gitlab/custom_query_type';
import { CustomQuery } from '../../common/gitlab/custom_query';
import { externalStatus, mr, securityReportFinding } from '../test_utils/entities';
import { testCredentials } from '../test_utils/test_credentials';
import { getProject } from '../../common/gitlab/api/get_project';
import { gqlProject, project } from '../../common/test_utils/entities';
import { GetRequest, PostRequest } from '../../common/platform/web_ide';
import { UnsupportedVersionError } from '../errors/unsupported_version_error';
import { createFakeFetchFromApi } from '../../common/test_utils/create_fake_fetch_from_api';
import { currentUserRequest } from '../../common/gitlab/api/get_current_user';
import { connectToCable } from '../../common/gitlab/api/action_cable';
import { FetchError } from '../../common/errors/fetch_error';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import {
  extensionConfigurationService,
  ExtensionConfiguration,
} from '../../common/utils/extension_configuration_service';
import { getAuthenticationConfiguration } from '../utils/extension_configuration';
import { getHttpAgentOptions } from './http/get_http_agent_options';
import { GitLabService } from './gitlab_service';

jest.mock('graphql-request');
jest.mock('../accounts/account_service');
jest.mock('../../common/fetch_logged');
jest.mock('../../common/utils/extension_configuration');
jest.mock('../../desktop/utils/extension_configuration');
jest.mock('./http/get_http_agent_options');
jest.mock('../../common/gitlab/api/action_cable');

const crossFetchCallArgument = () => (fetch as jest.Mock).mock.calls[0][0];
const crossFetchResponse = (response?: unknown, headers?: Record<string, string>) =>
  createFakePartial<Response>({
    ok: true,
    headers: createFakePartial<Headers>({
      get: (name: string) => headers?.[name] ?? null,
    }),
    json: async () => response,
  });

const mockGetAuthenticationConfiguration = jest.mocked(getAuthenticationConfiguration);

describe('gitlab_service', () => {
  let service: GitLabService;

  beforeEach(() => {
    jest.mocked(getHttpAgentOptions).mockReturnValue({});
    // Default stub for authentication configuration
    mockGetAuthenticationConfiguration.mockReturnValue({
      oauthClientIds: {
        'https://gitlab.com': 'default-client-id',
        'https://other-instance.com': 'some-client-id',
      },
    });
    service = new GitLabService(testCredentials());
  });

  const EXAMPLE_PROJECT_ID = 12345;

  describe('GraphQL client initialization', () => {
    it.each`
      instanceUrl                   | endpointUrl
      ${'https://test.com'}         | ${'https://test.com/api/graphql'}
      ${'https://test.com/gitlab'}  | ${'https://test.com/gitlab/api/graphql'}
      ${'https://test.com/gitlab/'} | ${'https://test.com/gitlab/api/graphql'}
    `('creates endpoint url from $instanceUrl', async ({ instanceUrl, endpointUrl }) => {
      service = new GitLabService(testCredentials(instanceUrl));
      jest.mocked(GraphQLClient).mockReturnValue(
        createFakePartial<GraphQLClient>({
          request: async () => ({ project: gqlProject }),
        }),
      );

      await service.fetchFromApi(getProject('group/project'));

      expect(GraphQLClient).toHaveBeenCalledWith(endpointUrl, expect.anything());
    });
  });

  describe('getSnippetContent uses REST for older GitLab versions', () => {
    it.each`
      rawPath                                                                                           | branch
      ${'/gitlab-org/gitlab-vscode-extension/-/snippets/111/raw/master/okr.md'}                         | ${'master'}
      ${'/gitlab-org/gitlab-vscode-extension/-/snippets/111/raw/main/okr.md'}                           | ${'main'}
      ${'/gitlab-org/security/gitlab-vscode-extension/-/snippets/222/raw/customBranch/folder/test1.js'} | ${'customBranch'}
    `('parses the repository branch from blob rawPath', async ({ rawPath, branch }) => {
      service.getVersion = async () => '14.0.0';
      const snippet = testSnippet1;
      const blob = snippet.blobs.nodes[0];

      await service.getSnippetContent(snippet, { ...blob, rawPath });

      expect(crossFetchCallArgument()).toMatch(`/files/${branch}/`);
    });
  });

  describe('getFileContent', () => {
    describe('fetch request', () => {
      it.each`
        ref                                                    | encodedRef
        ${'feature/ch38/add-fn-para-criar-novo-usuário'}       | ${'feature%2Fch38%2Fadd-fn-para-criar-novo-usu%C3%A1rio'}
        ${'förbättra-användarupplevelsen-av-chattkomponenten'} | ${'f%C3%B6rb%C3%A4ttra-anv%C3%A4ndarupplevelsen-av-chattkomponenten'}
        ${'erhöhe-preis-auf-dreißig-euro'}                     | ${'erh%C3%B6he-preis-auf-drei%C3%9Fig-euro'}
        ${'fix-error-400-when-on-a-branch'}                    | ${'fix-error-400-when-on-a-branch'}
      `('makes a request and escapes ref $ref', async ({ ref, encodedRef }) => {
        const baseUrl =
          'https://gitlab.example.com/api/v4/projects/12345/repository/files/README.md/raw?ref=';
        const altService = new GitLabService(testCredentials());
        const result = await altService.getFileContent('README.md', ref, EXAMPLE_PROJECT_ID);

        expect(fetch).toHaveBeenCalledWith(`${baseUrl}${encodedRef}`, expect.anything());

        expect(result.toString()).toBe(DEFAULT_FETCH_RESPONSE);
      });

      it.each`
        file                                           | encodedFile
        ${'README.md'}                                 | ${'README.md'}
        ${'src/com/example/App.java'}                  | ${'src%2Fcom%2Fexample%2FApp.java'}
        ${'.settings/Production Settings/windows.ini'} | ${'.settings%2FProduction%20Settings%2Fwindows.ini'}
      `('makes a request and escapes file $file', async ({ file, encodedFile }) => {
        const url = `https://gitlab.example.com/api/v4/projects/12345/repository/files/${encodedFile}/raw?ref=main`;
        const result = await service.getFileContent(file, 'main', EXAMPLE_PROJECT_ID);

        expect(fetch).toBeCalledTimes(1);
        expect((fetch as jest.Mock).mock.calls[0][0]).toBe(url);

        expect(result.toString()).toBe(DEFAULT_FETCH_RESPONSE);
      });
    });

    it('encodes the project path', async () => {
      await service.getFileContent('foo', 'bar', 'baz/bat');
      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/baz%2Fbat/repository/files/foo/raw?ref=bar',
        expect.anything(),
      );
    });
  });

  describe('getSecurityFinding', () => {
    it('returns the security finding', async () => {
      const report = await service.getSecurityFinding(mr);
      expect(report).toEqual(securityReportFinding);
    });
  });

  describe('getFile', () => {
    it('constructs the correct URL', async () => {
      await service.getFile('foo', 'bar', 12345);
      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/12345/repository/files/foo?ref=bar',
        expect.anything(),
      );
    });

    it('encodes the project, path, and ref', async () => {
      await service.getFile('path/to/file', 'feat/123', 'group/project');
      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/group%2Fproject/repository/files/path%2Fto%2Ffile?ref=feat%2F123',
        expect.anything(),
      );
    });
  });

  describe('getTree', () => {
    beforeEach(() => {
      jest.mocked(fetch).mockResolvedValue(crossFetchResponse([]));
    });
    it('constructs the correct URL', async () => {
      await service.getTree('foo', 'bar', 12345);
      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/12345/repository/tree?ref=bar&path=foo',
        expect.anything(),
      );
    });

    it('encodes the project, path, and ref', async () => {
      await service.getTree('path/to/file', 'feat/123', 'group/project');
      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/projects/group%2Fproject/repository/tree?ref=feat%2F123&path=path%2Fto%2Ffile',
        expect.anything(),
      );
    });
  });

  describe('fetchIssueables', () => {
    beforeEach(() => {
      jest.mocked(fetch).mockResolvedValue(crossFetchResponse([]));
      jest
        .spyOn(extensionConfigurationService, 'getConfiguration')
        .mockReturnValue(createFakePartial<ExtensionConfiguration>({}));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    const defaultParams: CustomQuery = {
      name: 'test query',
      noItemText: 'no items',
      type: CustomQueryType.MR,
      scope: 'all',
      state: 'opened',
      wip: undefined,
      draft: '',
      searchIn: '',
      confidential: false,
      excludeLabels: undefined,
      excludeMilestone: undefined,
      excludeAuthor: undefined,
      excludeAssignee: undefined,
      excludeSearch: undefined,
      excludeSearchIn: '',
      labels: undefined,
      milestone: undefined,
      search: undefined,
      createdBefore: undefined,
      createdAfter: undefined,
      updatedBefore: undefined,
      updatedAfter: undefined,
      orderBy: '',
      sort: '',
      maxResults: 20,
      reportTypes: undefined,
      severityLevels: undefined,
      confidenceLevels: undefined,
    };

    const getFetchedUrl = () => jest.mocked(fetch).mock.calls[0][0];
    const getFetchedParams = () =>
      new URLSearchParams(jest.mocked(fetch).mock.calls[0][0].toString());

    describe('handles types', () => {
      it.each`
        type                             | scope               | expectation
        ${CustomQueryType.VULNERABILITY} | ${'all'}            | ${'all'}
        ${CustomQueryType.VULNERABILITY} | ${'dismissed'}      | ${'dismissed'}
        ${CustomQueryType.ISSUE}         | ${'all'}            | ${'all'}
        ${CustomQueryType.ISSUE}         | ${'assigned_to_me'} | ${'assigned_to_me'}
        ${CustomQueryType.ISSUE}         | ${'created_by_me'}  | ${'created_by_me'}
        ${CustomQueryType.MR}            | ${'all'}            | ${'all'}
        ${CustomQueryType.MR}            | ${'assigned_to_me'} | ${'assigned_to_me'}
        ${CustomQueryType.MR}            | ${'created_by_me'}  | ${'created_by_me'}
      `('sets scope based on type: $type', async ({ type, scope, expectation }) => {
        await service.getIssuables({ ...defaultParams, scope, type }, project);
        expect(getFetchedUrl()).toContain(expectation);
      });

      it.each`
        type                             | scope    | queries                                | path
        ${CustomQueryType.EPIC}          | ${'all'} | ${{ include_ancestor_groups: 'true' }} | ${'/groups/9970/epics'}
        ${CustomQueryType.VULNERABILITY} | ${'all'} | ${{ scope: 'all' }}                    | ${'/projects/5261717/vulnerability_findings'}
        ${CustomQueryType.MR}            | ${'all'} | ${{ scope: 'all' }}                    | ${'/projects/5261717/merge_requests'}
      `('sets path based on type: $type', async ({ type, scope, queries, path }) => {
        await service.getIssuables({ ...defaultParams, scope, type }, project);
        const url = getFetchedUrl();
        expect(url).toContain(path);
        Object.entries(queries).forEach(([key, query]) => {
          expect(getFetchedParams().get(key)).toEqual(query);
        });
      });
    });

    describe('author parameters', () => {
      it('sets no author parameter', async () => {
        await service.getIssuables({ ...defaultParams, type: CustomQueryType.ISSUE }, project);
        expect(getFetchedParams().get('author_username')).toBeNull();
        expect(getFetchedParams().get('author_id')).toBeNull();
      });

      it('sets author_username parameter', async () => {
        await service.getIssuables(
          { ...defaultParams, type: CustomQueryType.ISSUE, author: 'testuser' },
          project,
        );
        expect(getFetchedParams().get('author_username')).toEqual('testuser');
        expect(getFetchedParams().get('author_id')).toBeNull();
      });

      it('sets author_id parameter if author is found', async () => {
        service.getFirstUserByUsername = async () => ({ id: 1 }) as RestUser;
        await service.getIssuables(
          { ...defaultParams, type: CustomQueryType.MR, author: 'testuser' },
          project,
        );
        expect(getFetchedParams().get('author_username')).toBeNull();
        expect(getFetchedParams().get('author_id')).toEqual('1');
      });
    });

    describe('current user', () => {
      it('replaces <current_user> with the current user name', async () => {
        service.fetchFromApi = createFakeFetchFromApi({
          request: currentUserRequest,
          response: { username: 'testuser' },
        });
        await service.getIssuables(
          {
            ...defaultParams,
            type: CustomQueryType.ISSUE,
            excludeAuthor: '<current_user>',
            excludeAssignee: '<current_user>',
            reviewer: '<current_user>',
          },
          project,
        );
        expect(getFetchedParams().get('not[author_username]')).toEqual('testuser');
        expect(getFetchedParams().get('not[assignee_username]')).toEqual('testuser');
        expect(getFetchedParams().get('reviewer_username')).toEqual('testuser');
      });
    });

    describe('assignee parameters', () => {
      it('sets assignee_username parameter', async () => {
        await service.getIssuables(
          { ...defaultParams, type: CustomQueryType.ISSUE, assignee: 'testuser' },
          project,
        );
        expect(getFetchedParams().get('assignee_username')).toEqual('testuser');
        expect(getFetchedParams().get('assignee_id')).toBeNull();
      });

      it('sets assignee_id parameter if assignee is found', async () => {
        service.getFirstUserByUsername = async () => ({ id: 1 }) as RestUser;
        await service.getIssuables(
          { ...defaultParams, type: CustomQueryType.MR, assignee: 'testuser' },
          project,
        );
        expect(getFetchedParams().get('assignee_username')).toBeNull();
        expect(getFetchedParams().get('assignee_id')).toEqual('1');
      });

      it.each(['Any', 'None'])('Uses %s directly', async param => {
        await service.getIssuables(
          { ...defaultParams, type: CustomQueryType.MR, assignee: param },
          project,
        );
        expect(getFetchedParams().get('assignee_id')).toEqual(param);
      });
    });

    describe('reviewer parameters', () => {
      it('sets reviewer_username parameter', async () => {
        await service.getIssuables(
          { ...defaultParams, type: CustomQueryType.ISSUE, reviewer: 'reviewer' },
          project,
        );
        expect(getFetchedParams().get('reviewer_username')).toEqual('reviewer');
      });

      it.each(['Any', 'None'])('Uses %s directly', async param => {
        await service.getIssuables(
          { ...defaultParams, type: CustomQueryType.MR, reviewer: param },
          project,
        );
        expect(getFetchedParams().get('reviewer_id')).toEqual(param);
      });
    });

    describe('searchIn parameters', () => {
      it('sets "all" parameter', async () => {
        await service.getIssuables({ ...defaultParams, searchIn: 'all' }, project);
        expect(getFetchedParams().get('in')).toEqual('title,description');
      });

      it('sets "in" parameter', async () => {
        await service.getIssuables({ ...defaultParams, searchIn: 'title' }, project);
        expect(getFetchedParams().get('in')).toEqual('title');
      });
    });

    describe('WIP/Draft', () => {
      it('sets wip parameter from `draft` property', async () => {
        await service.getIssuables({ ...defaultParams, draft: 'yes' }, project);
        expect(getFetchedParams().get('wip')).toEqual('yes');
      });

      it('sets wip parameter from `wip` alias', async () => {
        await service.getIssuables({ ...defaultParams, wip: 'yes' }, project);
        expect(getFetchedParams().get('wip')).toEqual('yes');
      });

      it('sets wip parameter from `wip` property if both `draft` and `wip` are set', async () => {
        await service.getIssuables({ ...defaultParams, wip: 'yes', draft: 'no' }, project);
        expect(getFetchedParams().get('wip')).toEqual('yes');
      });
    });

    describe('misc query parameters', () => {
      it('sets query parameters', async () => {
        await service.getIssuables(
          {
            ...defaultParams,
            type: CustomQueryType.ISSUE,
            confidential: true,
            excludeLabels: ['label1', 'label2'],
            excludeMilestone: 'excludeMilestone',
            excludeAuthor: 'excludeAuthor',
            excludeAssignee: 'excludeAssignee',
            excludeSearch: 'excludeSearch',
            excludeSearchIn: 'excludeSearchIn',
            labels: ['label1', 'label2'],
            milestone: 'milestone',
            search: 'search',
            createdBefore: '2020-10-11T03:45:40Z',
            createdAfter: '2018-11-01T03:45:40Z',
            updatedBefore: '2020-10-30T03:45:40Z',
            updatedAfter: '2018-11-01T03:45:40Z',
            orderBy: 'orderBy',
            sort: 'sort',
            maxResults: 20,
            reportTypes: ['reportType1', 'reportType2'],
            severityLevels: ['severityLevel1', 'severityLevel2'],
            confidenceLevels: ['confidenceLevel1', 'confidenceLevel2'],
          },
          project,
        );
        const params = getFetchedParams();

        expect(params.get('confidential')).toEqual('true');
        expect(params.get('not[labels]')).toEqual('label1,label2');
        expect(params.get('not[milestone]')).toEqual('excludeMilestone');
        expect(params.get('not[author_username]')).toEqual('excludeAuthor');
        expect(params.get('not[assignee_username]')).toEqual('excludeAssignee');
        expect(params.get('not[search]')).toEqual('excludeSearch');
        expect(params.get('not[in]')).toEqual('excludeSearchIn');
        expect(params.get('labels')).toEqual('label1,label2');
        expect(params.get('milestone')).toEqual('milestone');
        expect(params.get('search')).toEqual('search');
        expect(params.get('created_before')).toEqual('2020-10-11T03:45:40Z');
        expect(params.get('created_after')).toEqual('2018-11-01T03:45:40Z');
        expect(params.get('updated_before')).toEqual('2020-10-30T03:45:40Z');
        expect(params.get('updated_after')).toEqual('2018-11-01T03:45:40Z');
        expect(params.get('order_by')).toEqual('orderBy');
        expect(params.get('sort')).toEqual('sort');
        expect(params.get('per_page')).toEqual('20');
        expect(params.get('report_type')).toEqual('reportType1,reportType2');
        expect(params.get('severity')).toEqual('severityLevel1,severityLevel2');
        expect(params.get('confidence')).toEqual('confidenceLevel1,confidenceLevel2');
      });
    });
  });

  describe('fetchFromApi', () => {
    beforeEach(() => {
      jest.mocked(fetch).mockResolvedValue(crossFetchResponse());
    });

    describe('with GET request', () => {
      const request: GetRequest<string> = {
        method: 'GET',
        type: 'rest',
        path: '/project',
        headers: { test: 'header' },
      };

      it('handles custom headers', async () => {
        await service.fetchFromApi(request);
        expect(fetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/project',
          expect.objectContaining({
            headers: expect.objectContaining({ test: 'header' }),
          }),
        );
      });
    });

    describe('with POST request', () => {
      const request: PostRequest<string> = {
        method: 'POST',
        type: 'rest',
        path: '/project',
        headers: { test: 'header' },
      };

      it('handles custom headers', async () => {
        await service.fetchFromApi(request);
        expect(fetch).toHaveBeenCalledWith(
          'https://gitlab.example.com/api/v4/project',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ test: 'header' }),
          }),
        );
      });
    });
  });

  describe('fetchAllPages', () => {
    it('handles a non-empty query', async () => {
      jest.mocked(fetch).mockResolvedValue(crossFetchResponse());
      await service.fetchAllPages('/project', { foo: 'bar' });
      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.example.com/api/v4/project?foo=bar',
        expect.anything(),
      );
    });

    it('handles pagination', async () => {
      jest.mocked(fetch).mockImplementation(async url => {
        if (url === 'https://gitlab.example.com/api/v4/project')
          return crossFetchResponse(['a', 'b'], { 'x-total-pages': '2' });
        if (url === 'https://gitlab.example.com/api/v4/project?page=2')
          return crossFetchResponse(['c', 'd'], { 'x-total-pages': '2' });
        throw new Error(`unexpected URL: ${url}`);
      });
      await expect(service.fetchAllPages('/project')).resolves.toEqual(['a', 'b', 'c', 'd']);
    });

    it('throws a HelpError if the token is expired', async () => {
      const url = '/project';
      jest.mocked(fetch).mockResolvedValue(
        createFakePartial<Response>({
          ok: false,
          url: 'https://example.com/api/v4/project',
          status: 500,
          text: async () => '',
        }),
      );
      await expect(service.fetchAllPages(url)).rejects.toBeInstanceOf(FetchError);
    });
  });

  describe('getExternalStatusForCommit', () => {
    it('sets the stage', async () => {
      expect(externalStatus.stage).not.toBe('external');
      jest.mocked(fetch).mockResolvedValue(crossFetchResponse([externalStatus]));
      const result = await service.getExternalStatusForCommit('aaaaaaaa', null, 1);
      expect(result[0].stage).toBe('external');
    });
  });

  describe('exchangeToken', () => {
    afterEach(() => {
      jest.resetModules();
      mockGetAuthenticationConfiguration.mockReset();
    });

    it('succeeds with valid client ID and parameters', async () => {
      jest.mocked(fetch).mockResolvedValue(
        crossFetchResponse({
          access_token: 'new-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          created_at: 1234567890,
        }),
      );

      const result = await GitLabService.exchangeToken(
        {
          instanceUrl: 'https://gitlab.com',
          grantType: 'refresh_token',
          refreshToken: 'abc',
        },
        'valid-client-id',
      );

      expect(result).toEqual({
        access_token: 'new-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        created_at: 1234567890,
      });
    });

    it('succeeds when valid client ID is provided', async () => {
      jest.mocked(fetch).mockResolvedValue(
        crossFetchResponse({
          access_token: 'new-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          created_at: 1234567890,
        }),
      );

      const result = await GitLabService.exchangeToken(
        {
          instanceUrl: 'https://gitlab.com',
          grantType: 'refresh_token',
          refreshToken: 'abc',
        },
        'valid-client-id',
      );

      expect(result).toEqual({
        access_token: 'new-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        created_at: 1234567890,
      });
    });

    it('handles multiple instances with different client IDs', async () => {
      const instanceConfigs = {
        'https://gitlab.com': 'gitlab-com-client-id',
        'https://self-managed.example.com': 'self-managed-client-id',
        'https://dedicated.gitlab.com': 'dedicated-client-id',
      };

      jest.mocked(fetch).mockResolvedValue(
        crossFetchResponse({
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          created_at: 1234567890,
        }),
      );

      // Test each instance
      for (const [instanceUrl, expectedClientId] of Object.entries(instanceConfigs)) {
        // eslint-disable-next-line no-await-in-loop
        await GitLabService.exchangeToken(
          {
            instanceUrl,
            grantType: 'authorization_code',
            code: 'test-code',
            codeVerifier: 'test-verifier',
          },
          expectedClientId,
        );

        // Verify the correct client_id was used in the request body
        const lastCall = jest.mocked(fetch).mock.calls[jest.mocked(fetch).mock.calls.length - 1];
        const requestBody = lastCall[1]?.body as string;
        expect(requestBody).toContain(`client_id=${expectedClientId}`);
      }
    });

    it('fails when the request fails with invalid grant', async () => {
      jest.mocked(fetch).mockResolvedValue(
        createFakePartial<Response>({
          ok: false,
          status: 400,
          text: async () => `{ "error": "invalid_grant" }`,
        }),
      );

      const result = GitLabService.exchangeToken(
        {
          instanceUrl: 'https://gitlab.com',
          grantType: 'refresh_token',
          refreshToken: 'abc',
        },
        'valid-client-id',
      );

      await expect(result).rejects.toThrow();
      await result.catch((e: FetchError) => {
        expect(e).toBeInstanceOf(FetchError);
        expect(e.status).toBe(400);
        expect(e.isInvalidToken()).toBe(true);
      });
    });

    it('fails with generic error when the request fails', async () => {
      jest.mocked(fetch).mockResolvedValue(
        createFakePartial<Response>({
          ok: false,
          status: 400,
          text: async () => `{ "reason": "error" }`,
        }),
      );

      const result = GitLabService.exchangeToken(
        {
          instanceUrl: 'https://gitlab.com',
          grantType: 'refresh_token',
          refreshToken: 'abc',
        },
        'valid-client-id',
      );

      await expect(result).rejects.toThrow();
      await result.catch((e: FetchError) => {
        expect(e).toBeInstanceOf(FetchError);
        expect(e.status).toBe(400);
        expect(e.isInvalidToken()).toBe(false);
      });
    });

    it('handles authorization_code grant type correctly', async () => {
      jest.mocked(fetch).mockResolvedValue(
        crossFetchResponse({
          access_token: 'new-token',
          refresh_token: 'new-refresh-token',
          expires_in: 7200,
          created_at: 1234567890,
        }),
      );

      await GitLabService.exchangeToken(
        {
          instanceUrl: 'https://self-managed.example.com',
          grantType: 'authorization_code',
          code: 'auth-code-123',
          codeVerifier: 'code-verifier-456',
        },
        'self-managed-client-id',
      );

      const lastCall = jest.mocked(fetch).mock.calls[jest.mocked(fetch).mock.calls.length - 1];
      const requestBody = lastCall[1]?.body as string;

      expect(requestBody).toContain('client_id=self-managed-client-id');
      expect(requestBody).toContain('grant_type=authorization_code');
      expect(requestBody).toContain('code=auth-code-123');
      expect(requestBody).toContain('code_verifier=code-verifier-456');
      expect(requestBody).toContain('redirect_uri=');
    });

    it('handles refresh_token grant type correctly', async () => {
      jest.mocked(fetch).mockResolvedValue(
        crossFetchResponse({
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          created_at: 1234567890,
        }),
      );

      await GitLabService.exchangeToken(
        {
          instanceUrl: 'https://dedicated.gitlab.com',
          grantType: 'refresh_token',
          refreshToken: 'old-refresh-token',
        },
        'dedicated-client-id',
      );

      const lastCall = jest.mocked(fetch).mock.calls[jest.mocked(fetch).mock.calls.length - 1];
      const requestBody = lastCall[1]?.body as string;

      expect(requestBody).toContain('client_id=dedicated-client-id');
      expect(requestBody).toContain('grant_type=refresh_token');
      expect(requestBody).toContain('refresh_token=old-refresh-token');
      expect(requestBody).toContain('redirect_uri=');
    });
  });

  describe('validateVersion', () => {
    const TEST_CURRENT_VERSION = '10.1.2';
    const TEST_FEATURE_NAME = 'Test Feature Name';
    const TEST_NEXT_VERSION = '10.2.0';
    const TEST_PREV_VERSION = '10.1.1';
    const mock = jest.spyOn(GitLabService.prototype, 'getVersionAndEdition');

    afterAll(() => {
      mock.mockRestore();
    });

    it('rejects when current version is less than feature version', async () => {
      mock.mockImplementation(() => Promise.resolve({ version: TEST_CURRENT_VERSION }));

      const featureVersion = TEST_NEXT_VERSION;

      await expect(service.validateVersion(TEST_FEATURE_NAME, featureVersion)).rejects.toThrow(
        new UnsupportedVersionError(TEST_FEATURE_NAME, TEST_CURRENT_VERSION, featureVersion),
      );
    });

    it('rejects when expecting Enterprise Edition', async () => {
      mock.mockImplementation(() =>
        Promise.resolve({ version: TEST_CURRENT_VERSION, enterprise: false }),
      );

      const featureVersion = TEST_PREV_VERSION;

      await expect(
        service.validateVersion(TEST_FEATURE_NAME, featureVersion, true),
      ).rejects.toThrow();
    });

    it('resolves when current version is gte than feature version', async () => {
      mock.mockImplementation(() =>
        Promise.resolve({ version: TEST_CURRENT_VERSION, enterprise: true }),
      );

      const featureVersion = TEST_PREV_VERSION;

      await expect(
        service.validateVersion(TEST_FEATURE_NAME, featureVersion, true),
      ).resolves.toBeUndefined();
    });
  });

  describe('connectToCable', () => {
    it('connects to ActionCable with Authorization headers', async () => {
      await service.connectToCable();

      expect(connectToCable).toHaveBeenCalledWith(testCredentials().instanceUrl, {
        headers: expect.objectContaining({
          Origin: testCredentials().instanceUrl,
          Authorization: `Bearer ${testCredentials().token}`,
        }),
      });
    });
  });
});
