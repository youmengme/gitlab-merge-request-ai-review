import * as vscode from 'vscode';
import { mr, projectInRepository } from '../../test_utils/entities';
import {
  discussionOnDiff,
  noteOnDiffBody,
  multipleNotes,
} from '../../../../test/integration/fixtures/graphql/discussions';
import * as mrVersion from '../../../../test/integration/fixtures/rest/mr_version.json';
import { CommentingRangeProvider } from '../../review/commenting_range_provider';
import { fromReviewUri } from '../../review/review_uri';
import { DELETED, CHANGE_TYPE_QUERY_KEY, HAS_COMMENTS_QUERY_KEY } from '../../constants';
import { setSidebarViewState, SidebarViewState } from '../sidebar_view_state';
import { getGitLabService } from '../../gitlab/get_gitlab_service';
import { GitLabService } from '../../gitlab/gitlab_service';
import { createFakePartial } from '../../../common/test_utils/create_fake_partial';
import { ChangedFolderItem } from './changed_folder_item';
import { ChangedFileItem } from './changed_file_item';
import { MrItemModel } from './mr_item_model';

jest.mock('../../gitlab/get_gitlab_service');

const createCommentControllerMock = vscode.comments
  .createCommentController as jest.Mock<vscode.CommentController>;

describe('MrItemModel', () => {
  let item: MrItemModel;
  let commentThread: vscode.CommentThread;
  let canUserCommentOnMr = false;
  let commentController: vscode.CommentController;
  let gitLabService: GitLabService;

  const createCommentThreadMock = jest.fn();

  beforeEach(() => {
    gitLabService = createFakePartial<GitLabService>({
      getDiscussions: jest.fn().mockResolvedValue([discussionOnDiff, multipleNotes]),
      getMrDiff: jest.fn().mockResolvedValue({ diffs: [] }),
      canUserCommentOnMr: jest.fn(async () => canUserCommentOnMr),
    });
    jest.mocked(getGitLabService).mockReturnValue(gitLabService);
    item = new MrItemModel(mr, projectInRepository);
    commentThread = {} as vscode.CommentThread;

    commentController = createFakePartial<vscode.CommentController>({
      createCommentThread: createCommentThreadMock.mockReturnValue(commentThread),
      dispose: jest.fn(),
    });
    createCommentControllerMock.mockReturnValue(commentController);
  });

  afterEach(() => {
    createCommentControllerMock.mockReset();
    createCommentThreadMock.mockReset();
  });

  describe('MR item context', () => {
    it('should return return correct context when MR comes from the same project', () => {
      item = new MrItemModel(
        { ...mr, source_project_id: 1234, target_project_id: 1234 },
        projectInRepository,
      );
      expect(item.getTreeItem().contextValue).toBe('web-openable;mr-item-from-same-project');
    });

    it('should return return correct context when MR comes from a fork', () => {
      item = new MrItemModel(
        { ...mr, source_project_id: 5678, target_project_id: 1234 },
        projectInRepository,
      );
      expect(item.getTreeItem().contextValue).toBe('web-openable;mr-item-from-fork');
    });
  });

  it('should add comment thread to VS Code', async () => {
    await item.getChildren();
    expect(createCommentControllerMock).toBeCalledWith(
      'gitlab-mr-gitlab-org/gitlab!2000',
      'Issuable Title',
    );
    const [, range] = createCommentThreadMock.mock.calls[0];
    expect(range.start.line).toBe(47);
    expect(commentThread.comments.length).toBe(1);
    const firstComment = commentThread.comments[0];
    expect(firstComment.author.name).toBe('Tomas Vik');
    expect(firstComment.mode).toBe(vscode.CommentMode.Preview);
    expect(firstComment.body).toEqual(new vscode.MarkdownString(noteOnDiffBody));
  });

  it('should associate the thread with the correct URI', async () => {
    const discussionPosition = discussionOnDiff.notes.nodes[0].position;

    // used to determine the changeType in the comment URI
    gitLabService.getMrDiff = jest.fn().mockResolvedValue({
      diffs: [
        {
          old_path: discussionPosition.oldPath,
          new_path: '',
          a_mode: '100644',
          b_mode: '0',
          new_file: false,
          renamed_file: false,
          deleted_file: true,
          diff: '',
        },
      ],
    });

    await item.getChildren();

    const [uri] = createCommentThreadMock.mock.calls[0];
    const { mrId, projectId, repositoryRoot, commit, path, changeType } = fromReviewUri(uri);
    expect(mrId).toBe(mr.id);
    expect(projectId).toBe(mr.project_id);
    expect(repositoryRoot).toBe(projectInRepository.pointer.repository.rootFsPath);

    expect(commit).toBe(discussionPosition.diffRefs.baseSha);
    expect(path).toBe(discussionPosition.oldPath);
    expect(changeType).toBe(DELETED);
  });

  it('should return changed file items as children', async () => {
    gitLabService.getMrDiff = jest.fn().mockResolvedValue(mrVersion);
    await setSidebarViewState(SidebarViewState.ListView);
    const [, changedItem] = await item.getChildren();
    expect(changedItem.resourceUri?.path).toBe('.deleted.yml');
    expect(changedItem.resourceUri?.query).toMatch(`${CHANGE_TYPE_QUERY_KEY}=deleted`);
    expect(changedItem.resourceUri?.query).toMatch(`${HAS_COMMENTS_QUERY_KEY}=false`);
  });

  it('should return changed file items in tree view', async () => {
    gitLabService.getMrDiff = jest.fn().mockResolvedValue(mrVersion);
    await setSidebarViewState(SidebarViewState.TreeView);
    const [, folderItem, fileItem] = await item.getChildren();

    expect(folderItem).toBeInstanceOf(ChangedFolderItem);
    expect(folderItem.label).toBe('src');

    expect(fileItem).toBeInstanceOf(ChangedFileItem);
    expect(fileItem.resourceUri?.path).toBe('.deleted.yml');
    expect(fileItem.resourceUri?.query).toMatch(`${CHANGE_TYPE_QUERY_KEY}=${DELETED}`);
    expect(fileItem.resourceUri?.query).toMatch(`${HAS_COMMENTS_QUERY_KEY}=false`);
  });

  it('should handle error when getting child items', async () => {
    gitLabService.getMrDiff = jest.fn().mockRejectedValue(new Error());
    const children = await item.getChildren();

    // returns the overview item instead of throwing
    expect(children.length).toBe(1);
  });

  describe('commenting range', () => {
    it('should not add a commenting range provider if user does not have permission to comment', async () => {
      canUserCommentOnMr = false;

      await item.getChildren();

      expect(commentController.commentingRangeProvider).toBe(undefined);
    });

    it('should add a commenting range provider if user has permission to comment', async () => {
      canUserCommentOnMr = true;

      await item.getChildren();

      expect(commentController.commentingRangeProvider).toBeInstanceOf(CommentingRangeProvider);
    });

    it('keeps the same commentController regardless how many times we call getChildren', async () => {
      await item.getChildren();

      expect(createCommentControllerMock).toHaveBeenCalledTimes(1);

      await item.getChildren();

      expect(createCommentControllerMock).toHaveBeenCalledTimes(1);
      expect(commentController.dispose).not.toHaveBeenCalled();
    });
  });
});
