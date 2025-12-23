import vscode from 'vscode';

export const REVIEW_URI_SCHEME = 'gl-review';
export const MERGED_YAML_URI_SCHEME = 'gl-merged-ci-yaml';
export const JOB_LOG_URI_SCHEME = 'gl-job-log';
export const REMOTE_URI_SCHEME = 'gitlab-remote';

export const ADDED = 'added' as const;
export const DELETED = 'deleted' as const;
export const RENAMED = 'renamed' as const;
export const MODIFIED = 'modified' as const;
export const DO_NOT_SHOW_YAML_SUGGESTION = 'DO_NOT_SHOW_YAML_SUGGESTION';
export const DISMISSED_CODE_SUGGESTIONS_PROMO = 'DISMISSED_CODE_SUGGESTIONS_PROMO';
export const WEBVIEW_WORKFLOW = 'glWorkflow';
export const WEBVIEW_PENDING_JOB = 'gitlab.waitForPendingJob';
export const WEBVIEW_SECURITY_FINDING = 'gitlab.viewSecurityFinding';

export const CHANGE_TYPE_QUERY_KEY = 'changeType';
export const HAS_COMMENTS_QUERY_KEY = 'hasComments';
export const PATCH_TITLE_PREFIX = 'patch: ';
export const PATCH_FILE_SUFFIX = '.patch';

export const OAUTH_REDIRECT_URI = `${vscode.env.uriScheme}://gitlab.gitlab-workflow/authentication`;

/** Synced comment is stored in the GitLab instance */
export const SYNCED_COMMENT_CONTEXT = 'synced-comment';
/** Failed comment is only stored in the extension, it failed to be created in GitLab */
export const FAILED_COMMENT_CONTEXT = 'failed-comment';

export const REQUIRED_VERSIONS = {
  // NOTE: This needs to _always_ be a 3 digits
  CI_CONFIG_VALIDATIONS: '13.6.0',
  MR_DISCUSSIONS: '13.9.0',
  MR_MERGE_QUICK_ACTION: '14.9.0', // https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/545
  SECURITY_FINDINGS: '16.1.0',
  BRANCH_PROTECTION: '16.9.0',
};
