/**
 * Slimmed-down version of the Issuable, returned for example by
 * https://docs.gitlab.com/api/merge_requests/#list-issues-that-close-on-merge
 */
interface MinimalRestIssuable {
  id: number;
  iid: number;
  title: string;
  project_id: number;
  author: { name: string; avatar_url: string | null };
}
/**
 * An issuable instance repesents one of these entities:
 *  - Merge Request
 *  - Issue
 *  - Epic
 *  - Snippet
 */
interface RestIssuable extends MinimalRestIssuable {
  web_url: string;
  references: {
    full: string; // e.g. "gitlab-org/gitlab#219925"
  };
  severity: string;
  name: string;
}

interface RestMr extends RestIssuable {
  sha: string;
  source_project_id: number;
  target_project_id: number;
  source_branch: string;
}

interface RestMrVersion {
  id: number;
  head_commit_sha: string;
  base_commit_sha: string;
  start_commit_sha: string;
  diffs: RestDiffFile[];
}

interface RestDiffFile {
  new_path: string;
  old_path: string;
  deleted_file: boolean;
  new_file: boolean;
  renamed_file: boolean;
  diff: string;
}

interface RestVulnerability {
  location?: {
    file: string;
  };
  web_url: string;
  severity: string;
  name: string;
}

type SnippetVisibility = 'private' | 'public';

interface RestPipeline {
  status:
    | 'running'
    | 'pending'
    | 'success'
    | 'failed'
    | 'canceling'
    | 'canceled'
    | 'skipped'
    | 'waiting_for_resource'
    | 'waiting_for_callback'
    | 'preparing';
  updated_at: string;
  id: number;
  iid: number;
  ref: string | null;
  sha: string;
  source?: string;
  project_id: number;
  web_url: string;
  name?: string;
}

interface RestArtifact {
  file_type: string;
  size: number;
  filename: string;
  file_format?: string;
}

interface RestJobPipeline {
  project_id: number;
}

interface RestJob {
  id: number;
  name: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  erased_at?: string;
  status:
    | 'created'
    | 'pending'
    | 'running'
    | 'failed'
    | 'success'
    | 'canceling'
    | 'canceled'
    | 'skipped'
    | 'manual';
  stage: string;
  artifacts?: RestArtifact[];
  allow_failure: boolean;
  web_url?: string;
  pipeline: RestJobPipeline;

  // Used by Commit Status
  target_url?: string;
  description?: string;
}

interface RestBridge extends RestJob {
  downstream_pipeline: RestPipeline;
}

interface RestPendingBridge extends RestJob {
  downstream_pipeline: null;
}

// Incomplete reference of the GitLab user model
interface RestUser {
  id: number;
  username: string;
  email: string;
  state: string;
}

interface RestRepositoryFile {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
}

interface RestRepositoryTreeEntry {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  mode: string;
}

/**
 * GET /projects/:id/repository/branches
 *
 * The following properties exist on the GitLab response but are not used:
 * - merged
 * - protected
 * - default
 * - developers_can_push
 * - developers_can_merge
 * - can_push
 * - web_url
 * - commit
 */
interface RestBranch {
  name: string;
}

/**
 * GET /projects/:id/repository/tags
 *
 * The following properties exist on the GitLab response but are not used:
 * - commit
 * - release
 * - target
 * - message
 * - protected
 */
interface RestTag {
  name: string;
}

type ProjectVisibility = 'public' | 'internal' | 'private';

interface RestProject {
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  web_url: string;
}

interface RestProtectedBranch {
  name: string;
  push_access_levels?: {
    access_level: number;
    deploy_key_id: number | null;
    user_id: number | null;
  }[];
}
