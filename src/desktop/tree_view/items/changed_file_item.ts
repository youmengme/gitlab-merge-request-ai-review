import { posix as path } from 'path';
import * as vscode from 'vscode';
import { isEmptyFileUri, toReviewUri, ChangeType } from '../../review/review_uri';
import { VS_COMMANDS } from '../../../common/command_names';
import {
  ADDED,
  DELETED,
  RENAMED,
  MODIFIED,
  CHANGE_TYPE_QUERY_KEY,
  HAS_COMMENTS_QUERY_KEY,
} from '../../constants';

export type HasCommentsFn = (reviewUri: vscode.Uri) => boolean;

export const getChangeType = (file: RestDiffFile): ChangeType => {
  if (file.new_file) return ADDED;
  if (file.deleted_file) return DELETED;
  if (file.renamed_file) return RENAMED;
  return MODIFIED;
};

// All extensions supported by VS Code's built-in Media Previewer.
// https://github.com/microsoft/vscode/blob/ba38f8a5eeb81c05dbdade3e1657e233d770f717/extensions/media-preview/package.json
const mediaExtensions = [
  '.jpg',
  '.jpe',
  '.jpeg',
  '.png',
  '.bmp',
  '.gif',
  '.ico',
  '.webp',
  '.avif',
  '.mp3',
  '.wav',
  '.ogg',
  '.oga',
  '.mp4',
  '.webm',
];
const looksLikeMedia = (filePath: string) =>
  mediaExtensions.includes(path.extname(filePath).toLowerCase());

const getBaseAndHeadUri = (
  mr: RestMr,
  mrVersion: RestMrVersion,
  file: RestDiffFile,
  repositoryPath: string,
) => {
  const commonParams = {
    repositoryRoot: repositoryPath,
    changeType: getChangeType(file),
    projectId: mr.project_id,
    mrId: mr.id,
  };
  const baseFileUri = toReviewUri({
    ...commonParams,
    path: file.old_path,
    exists: !file.new_file,
    commit: mrVersion.base_commit_sha,
  });
  const headFileUri = toReviewUri({
    ...commonParams,
    path: file.new_path,
    exists: !file.deleted_file,
    commit: mrVersion.head_commit_sha,
  });
  return { baseFileUri, headFileUri };
};

export class ChangedFileItem extends vscode.TreeItem {
  headFileUri: vscode.Uri;

  baseFileUri: vscode.Uri;

  constructor(
    mr: RestMr,
    mrVersion: RestMrVersion,
    file: RestDiffFile,
    repositoryPath: string,
    hasComment: HasCommentsFn,
    shownInList = true,
  ) {
    super(vscode.Uri.file(file.new_path));
    if (shownInList) {
      // we don't need the folder information if the item is in tree view
      this.description = path.dirname(`/${file.new_path}`).split('/').slice(1).join('/');
    }
    this.contextValue = 'changed-file-item';
    const uris = getBaseAndHeadUri(mr, mrVersion, file, repositoryPath);
    this.headFileUri = uris.headFileUri;
    this.baseFileUri = uris.baseFileUri;
    const headIsEmpty = isEmptyFileUri(uris.headFileUri);
    const baseIsEmpty = isEmptyFileUri(uris.baseFileUri);
    const hasComments = hasComment(this.baseFileUri) || hasComment(this.headFileUri);
    const query = new URLSearchParams([
      [CHANGE_TYPE_QUERY_KEY, getChangeType(file)],
      [HAS_COMMENTS_QUERY_KEY, String(hasComments)],
    ]).toString();
    this.resourceUri = this.resourceUri?.with({ query });

    if (looksLikeMedia(uris.headFileUri.path) && (headIsEmpty || baseIsEmpty)) {
      this.command = {
        title: 'Show changes',
        command: VS_COMMANDS.OPEN,
        arguments: [headIsEmpty ? this.baseFileUri : this.headFileUri],
      };
    } else {
      this.command = {
        title: 'Show changes',
        command: VS_COMMANDS.DIFF,
        arguments: [
          this.baseFileUri,
          this.headFileUri,
          `${path.basename(file.new_path)} (!${mr.iid})`,
        ],
      };
    }
  }
}
