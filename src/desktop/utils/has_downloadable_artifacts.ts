import { isArtifactDownloadable } from './is_artifact_downloadable';

export function hasDownloadableArtifacts(jobs: RestJob[]): boolean {
  return Boolean(jobs.find(j => j.artifacts?.find(isArtifactDownloadable)));
}
