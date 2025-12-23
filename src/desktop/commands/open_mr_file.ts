import * as path from 'path';
import assert from 'assert';
import { promises as fs } from 'fs';
import * as vscode from 'vscode';
import { VS_COMMANDS } from '../../common/command_names';
import { fromReviewUri, isEmptyFileUri } from '../review/review_uri';
import { removeLeadingSlash } from '../utils/remove_leading_slash';
import { getProjectRepository } from '../gitlab/gitlab_project_repository';
import { mrCache } from '../gitlab/mr_cache';
import { ChangedFileItem } from '../tree_view/items/changed_file_item';
import { findDiffWithPath } from '../review/utils/find_diff_with_path';

/** returns true if file exists, false if it doesn't */
const tryToOpen = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath); // throws if file doesn't exist
  } catch (e) {
    return false;
  }
  await vscode.commands.executeCommand(VS_COMMANDS.OPEN, vscode.Uri.file(filePath));
  return true;
};

const openMrFileFromUri = async (uri: vscode.Uri): Promise<void> => {
  const params = fromReviewUri(uri);
  assert(params.path);
  const projectInRepository = getProjectRepository().getProjectOrFail(params.repositoryRoot);
  const cachedMr = mrCache.getMr(params.mrId, projectInRepository);
  assert(cachedMr);
  const diff = findDiffWithPath(cachedMr.mrVersion.diffs, removeLeadingSlash(params.path));
  assert(diff, 'Extension did not find the file in the MR, please refresh the side panel.');
  const getFullPath = (relative: string) => path.join(params.repositoryRoot, relative);
  const opened =
    (await tryToOpen(getFullPath(diff.new_path))) || (await tryToOpen(getFullPath(diff.old_path)));
  if (!opened)
    await vscode.window.showWarningMessage(
      `The file ${params.path} doesn't exist in your local project`,
    );
};

export const openMrFile = async (param: ChangedFileItem | vscode.Uri): Promise<void> => {
  if (param instanceof ChangedFileItem) {
    if (!isEmptyFileUri(param.headFileUri)) return openMrFileFromUri(param.headFileUri);
    if (!isEmptyFileUri(param.baseFileUri)) return openMrFileFromUri(param.baseFileUri);
    throw new Error("unexpected state, both files in a diff can't be empty");
  } else {
    return openMrFileFromUri(param);
  }
};
