import { getFileContent } from '../git/get_file_content';
import { getProjectRepository, GitLabProjectRepository } from '../gitlab/gitlab_project_repository';
import { projectInRepository } from '../test_utils/entities';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { MODIFIED } from '../constants';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { GitLabService } from '../gitlab/gitlab_service';
import { ReviewParams, toReviewUri } from './review_uri';
import { ReviewFileSystem } from './review_file_system';

jest.mock('../gitlab/get_gitlab_service');
jest.mock('../git/get_file_content');
jest.mock('../gitlab/gitlab_project_repository');

describe('ReviewFileSystem', () => {
  const fileSystem = new ReviewFileSystem();

  const reviewUriParams: ReviewParams = {
    commit: 'abcdef',
    path: '/review',
    exists: true,
    projectId: 1234,
    mrId: 2345,
    repositoryRoot: 'path/to/workspace',
    changeType: MODIFIED,
  };

  beforeEach(() => {
    jest.mocked(getProjectRepository).mockReturnValue(
      createFakePartial<GitLabProjectRepository>({
        getProjectOrFail: jest.fn().mockReturnValue(projectInRepository),
      }),
    );
  });

  it('provides file content from a git repository', async () => {
    jest.mocked(getFileContent).mockResolvedValue(Buffer.from('Test text', 'utf-8'));

    const result = await fileSystem.readFile(toReviewUri(reviewUriParams));
    expect(result.toString()).toBe('Test text');
  });

  it('falls back to the API provider if file does not exist in the git repository', async () => {
    jest.mocked(getFileContent).mockResolvedValue(null);

    jest.mocked(getGitLabService).mockReturnValue(
      createFakePartial<GitLabService>({
        getFileContent: () => Promise.resolve(Buffer.from('Api content', 'utf-8').buffer),
      }),
    );

    const result = await fileSystem.readFile(toReviewUri(reviewUriParams));
    expect(result.toString()).toContain('Api content');
  });
});
