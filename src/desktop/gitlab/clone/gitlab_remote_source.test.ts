import { createTokenAccount, restProject } from '../../test_utils/entities';
import { getGitLabServiceForAccount } from '../get_gitlab_service';
import { createFakePartial } from '../../../common/test_utils/create_fake_partial';
import { GitLabService } from '../gitlab_service';
import { createFakeRepository, FakeGitExtension } from '../../test_utils/fake_git_extension';
import { handleError } from '../../../common/errors/handle_error';
import { UserFriendlyError } from '../../../common/errors/user_friendly_error';
import { API } from '../../api/git';
import { convertUrlToWikiUrl, GitLabRemoteSource } from './gitlab_remote_source';
import { NamespacePickerItem, pickNamespace } from './pick_namespace';
import {
  NameAndVisibilityPickerItem,
  pickProjectNameAndVisibility,
} from './pick_project_name_and_visibility';

jest.mock('../get_gitlab_service');
jest.mock('./pick_namespace');
jest.mock('./pick_project_name_and_visibility');
jest.mock('../../../common/errors/handle_error');

describe('convertUrlToWikiUrl', () => {
  test('should convert urls to wiki urls', () => {
    expect(convertUrlToWikiUrl('git@gitlab.com:username/myproject.git')).toBe(
      'git@gitlab.com:username/myproject.wiki.git',
    );
    expect(convertUrlToWikiUrl('https://gitlab.com/username/myproject.git')).toBe(
      'https://gitlab.com/username/myproject.wiki.git',
    );
    expect(convertUrlToWikiUrl('https://gitlab.com/user.git./myproject.git')).toBe(
      'https://gitlab.com/user.git./myproject.wiki.git',
    );
    expect(convertUrlToWikiUrl('https://gitlab.com/user.git./myproject')).toBe(
      'https://gitlab.com/user.git./myproject',
    );
    expect(convertUrlToWikiUrl('wrong')).toBe('wrong');
  });
});

describe('GitLabRemoteSource', () => {
  let fakeExtension: FakeGitExtension;
  let gitlabService: GitLabService;
  beforeEach(async () => {
    fakeExtension = new FakeGitExtension();
    gitlabService = createFakePartial<GitLabService>({
      fetchFromApi: jest.fn(),
    });
    const namespace: NamespacePickerItem = {
      fullPath: 'groupname',
      isGroup: true,
      label: 'groupname',
    };
    const projectName: NameAndVisibilityPickerItem = {
      label: '',
      projectConnection: 'SSH',
      projectName: 'newproject',
      projectVisibility: 'private',
    };

    jest.mocked(getGitLabServiceForAccount).mockReturnValue(gitlabService);
    jest.mocked(pickNamespace).mockResolvedValue(namespace);
    jest.mocked(pickProjectNameAndVisibility).mockResolvedValue(projectName);
  });

  test('can publish repositories', async () => {
    jest.mocked(handleError).mockImplementation(e => {
      throw (e as UserFriendlyError).originalError ?? e;
    });
    jest.mocked(gitlabService.fetchFromApi).mockImplementation(async req => {
      if (req.type === 'rest' && req.path.match('namespace')) {
        return { id: 49 };
      }
      if (req.type === 'rest' && req.method === 'POST' && req.path.match('projects')) {
        expect(req.body).toEqual(expect.objectContaining({ namespace_id: 49 }));
        return restProject;
      }
      throw Error('unmocked api call');
    });

    const provider = new GitLabRemoteSource(
      createTokenAccount(),
      fakeExtension.gitApi as unknown as API,
    );
    const repo = createFakeRepository({ remotes: [], headName: 'main', commit: '1234' });

    await provider.publishRepository(repo);
    expect(pickNamespace).toHaveBeenCalled();
    expect(pickProjectNameAndVisibility).toHaveBeenCalled();

    expect(repo.state.remotes).toContainEqual(
      expect.objectContaining({
        pushUrl: restProject.ssh_url_to_repo,
      }),
    );
  });
});
