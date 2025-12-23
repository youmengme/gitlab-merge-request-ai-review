import * as vscode from 'vscode';
import { Uri } from '../../__mocks__/vscode';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { createFakeWorkspaceConfiguration } from '../../common/test_utils/vscode_fakes';
import { projectInRepository, user } from '../test_utils/entities';
import { promiseFromEvent } from '../utils/promise_from_event';
import { getGitLabService } from './get_gitlab_service';
import { GitLabService } from './gitlab_service';
import { ProtectedBranchProvider } from './protected_branch_provider';
import { GqlProjectAccessLevel } from './api/get_project_access_level';

jest.mock('./get_gitlab_service');

describe('ProtectedBranchProvider', () => {
  let provider: ProtectedBranchProvider;
  let gitlabService: GitLabService;

  beforeEach(() => {
    const uri = Uri.file('/repo');
    provider = new ProtectedBranchProvider(uri, projectInRepository);
    gitlabService = createFakePartial<GitLabService>({
      fetchFromApi: jest.fn(),
      validateVersion: jest.fn().mockResolvedValue(undefined),
    });

    jest.mocked(getGitLabService).mockReturnValue(gitlabService);

    const maxAccessResult: GqlProjectAccessLevel = {
      project: {
        maxAccessLevel: {
          integerValue: 30,
        },
      },
    };
    const protectionResult = [
      {
        name: 'main',
        push_access_levels: [
          {
            access_level: 0,
            deploy_key_id: null,
            user_id: null,
          },
        ],
      },
      {
        name: 'staging',
        push_access_levels: [
          {
            access_level: 60,
            deploy_key_id: null,
            user_id: null,
          },
        ],
      },
      {
        name: 'dev',
        push_access_levels: [
          {
            access_level: 30,
            deploy_key_id: null,
            user_id: null,
          },
        ],
      },
      {
        name: 'deployment',
        push_access_levels: [
          {
            access_level: 0,
            deploy_key_id: null,
            user_id: null,
          },
          {
            access_level: 30,
            deploy_key_id: 1,
            user_id: null,
          },
        ],
      },
      {
        name: 'personal',
        push_access_levels: [
          {
            access_level: 0,
            deploy_key_id: null,
            user_id: null,
          },
          {
            access_level: 30,
            deploy_key_id: null,
            user_id: 1,
          },
        ],
      },
    ];

    jest.mocked(gitlabService.fetchFromApi).mockImplementation(async request => {
      if (request.type === 'graphql') return maxAccessResult;
      if (request.type === 'rest' && request.path === '/user') return { ...user, id: 1 };
      return protectionResult;
    });
  });
  afterEach(() => {
    provider.dispose();
  });

  it('calls the API', async () => {
    const { promise } = promiseFromEvent(provider.onDidChangeBranchProtection);

    const shouldBeEmpty = provider.provideBranchProtection();
    expect(shouldBeEmpty).toHaveLength(0);

    await promise;
    expect(gitlabService.validateVersion).toHaveBeenCalled();
    expect(gitlabService.fetchFromApi).toHaveBeenCalled();

    const { include, exclude } = provider.provideBranchProtection()[0].rules[0];
    expect(include).toContain('main');
    expect(include).toContain('staging');
    expect(exclude).toContain('dev');
    expect(include).toContain('deployment');
    expect(exclude).toContain('personal');
  });

  it('does nothing when disabled', () => {
    jest
      .mocked(vscode.workspace.getConfiguration)
      .mockReturnValue(createFakeWorkspaceConfiguration({ branchProtection: false }));

    const shouldBeEmpty = provider.provideBranchProtection();
    expect(shouldBeEmpty).toHaveLength(0);
    expect(gitlabService.fetchFromApi).not.toHaveBeenCalled();
  });
});
