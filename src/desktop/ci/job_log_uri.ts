import { Uri } from 'vscode';
import { JOB_LOG_URI_SCHEME } from '../constants';
import { jsonStringifyWithSortedKeys } from '../utils/json_stringify_with_sorted_keys';

export function toJobLogUri(repositoryRoot: string, projectId: number, job: number): Uri {
  const query = { repositoryRoot, projectId, job };
  // The Uri's path is used only as a display label.
  return Uri.parse(`${JOB_LOG_URI_SCHEME}:Job ${job}`).with({
    query: jsonStringifyWithSortedKeys(query),
  });
}

export function fromJobLogUri(uri: Uri): {
  repositoryRoot: string;
  projectId: number;
  job: number;
} {
  const { repositoryRoot, projectId, job } = JSON.parse(uri.query);
  return { repositoryRoot, projectId, job };
}
