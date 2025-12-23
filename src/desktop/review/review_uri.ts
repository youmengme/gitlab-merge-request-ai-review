import { Uri } from 'vscode';
import { ADDED, DELETED, RENAMED, MODIFIED, REVIEW_URI_SCHEME } from '../constants';
import { jsonStringifyWithSortedKeys } from '../utils/json_stringify_with_sorted_keys';

export type ChangeType = typeof ADDED | typeof DELETED | typeof RENAMED | typeof MODIFIED;

export interface ReviewParams {
  path: string;
  exists: boolean;
  commit?: string;
  // if the review URI only contains the mandatory params, we treat it as an empty file URI (that's used when showing diff of added/deleted file)
  repositoryRoot: string;
  projectId: number;
  mrId: number;
  changeType: ChangeType;
}

export function toReviewUri({
  path,
  exists,
  commit,
  repositoryRoot,
  projectId,
  mrId,
  changeType,
}: ReviewParams): Uri {
  const query = { commit, exists: exists ? '1' : '', repositoryRoot, projectId, mrId, changeType };
  return Uri.file(path).with({
    scheme: REVIEW_URI_SCHEME,
    query: jsonStringifyWithSortedKeys(query),
  });
}

export function fromReviewUri(uri: Uri): ReviewParams {
  const { commit, exists, repositoryRoot, projectId, mrId, changeType } = JSON.parse(uri.query);
  return {
    path: uri.path,
    exists: Boolean(exists),
    commit,
    repositoryRoot,
    projectId,
    mrId,
    changeType,
  };
}

export function isEmptyFileUri(uri: Uri): boolean {
  const params = fromReviewUri(uri);
  return !params.exists || !params.commit;
}
