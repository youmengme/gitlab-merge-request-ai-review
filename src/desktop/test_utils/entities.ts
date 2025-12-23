import { GitRemote, GitRepository } from '../git/new_git';
import { CustomQueryType } from '../../common/gitlab/custom_query_type';
import { ProjectInRepository } from '../gitlab/new_project';
import { ReviewParams as ReviewUriParams } from '../review/review_uri';
import { makeAccountId, OAuthAccount, TokenAccount } from '../../common/platform/gitlab_account';
import { GqlSecurityReportFinding } from '../gitlab/graphql/get_security_finding';
import { GqlProjectWithRepoInfo } from '../gitlab/api/get_projects_with_repository_info';
import {
  GqlSecurityFindingReportComparer,
  GqlSecurityFinding,
} from '../gitlab/security_findings/api/get_security_finding_report';
import { project } from '../../common/test_utils/entities';
import { createFakeRepository } from './fake_git_extension';

export const issue: RestIssuable = {
  id: 1,
  iid: 1000,
  title: 'Issuable Title',
  project_id: 9999,
  web_url: 'https://gitlab.example.com/group/project/issues/1000',
  author: {
    avatar_url:
      'https://secure.gravatar.com/avatar/6042a9152ada74d9fb6a0cdce895337e?s=80&d=identicon',
    name: 'Tomas Vik',
  },
  references: {
    full: 'gitlab-org/gitlab#1000',
  },
  severity: 'severityLevel1',
  name: 'Issuable Name',
};

export const mr: RestMr = {
  ...issue,
  id: 2,
  iid: 2000,
  web_url: 'https://gitlab.example.com/group/project/merge_requests/2000',
  references: {
    full: 'gitlab-org/gitlab!2000',
  },
  sha: '69ad609e8891b8aa3db85a35cd2c5747705bd76a',
  source_project_id: 9999,
  target_project_id: 9999,
  source_branch: 'feature-a',
};

export const diffFile: RestDiffFile = {
  old_path: 'old_file.js',
  new_path: 'new_file.js',
  new_file: false,
  deleted_file: false,
  renamed_file: true,
  diff: '@@ -0,0 +1,7 @@\n+new file 2\n+\n+12\n+34\n+56\n+\n+,,,\n',
};

export const mrVersion: RestMrVersion = {
  id: 3,
  base_commit_sha: 'aaaaaaaa',
  head_commit_sha: 'bbbbbbbb',
  start_commit_sha: 'cccccccc',
  diffs: [diffFile],
};

export const customQuery = {
  name: 'Query name',
  type: CustomQueryType.ISSUE,
  maxResults: 10,
  scope: 'all',
  state: 'closed',
  wip: undefined,
  draft: 'no',
  confidential: false,
  excludeSearchIn: 'all',
  orderBy: 'created_at',
  sort: 'desc',
  searchIn: 'all',
  noItemText: 'No item',
};

export const pipeline: RestPipeline = {
  status: 'success',
  updated_at: '2021-02-12T12:06:17Z',
  id: 123456,
  iid: 1,
  project_id: 567890,
  sha: 'aaaaaaaa',
  ref: 'main',
  web_url: 'https://example.com/foo/bar/pipelines/46',
};

export const job: RestJob = {
  id: 1,
  name: 'Unit tests',
  status: 'success',
  stage: 'test',
  created_at: '2021-07-19T11:44:54.928Z',
  started_at: '2021-07-19T11:44:54.928Z',
  finished_at: '2021-07-19T11:44:54.928Z',
  allow_failure: false,
  web_url: 'https://example.com/foo/bar/jobs/68',
  pipeline: {
    project_id: 5678,
  },
};

export const bridgeJob: RestBridge = {
  id: 1,
  name: 'Unit tests',
  status: 'manual',
  stage: 'test',
  created_at: '2021-07-19T11:44:54.928Z',
  started_at: undefined,
  finished_at: undefined,
  allow_failure: false,
  web_url: 'https://example.com/foo/bar/jobs/68',
  pipeline: {
    project_id: 5678,
  },
  downstream_pipeline: {
    id: 2345,
    iid: 2,
    status: 'running',
    ref: 'feature-branch',
    updated_at: '2021-07-19T12:00:00.000Z',
    project_id: 6789,
    sha: 'bbbbbbbb',
    web_url: 'https://example.com/foo/bar/pipelines/2345',
  },
};

export const externalStatus: RestJob = {
  id: 0,
  name: 'external:build',
  status: 'success',
  stage: '',
  created_at: '2022-10-08T11:44:54.928Z',
  started_at: '2022-10-08T11:44:54.928Z',
  finished_at: '2022-10-08T11:44:54.928Z',
  allow_failure: false,
  target_url: 'https://example.com/builds/100',
  pipeline: {
    project_id: 6789,
  },
};

export const artifact: RestArtifact = {
  file_type: 'junit',
  filename: 'junit.xml',
  size: 1024,
};

export const reviewUriParams: ReviewUriParams = {
  mrId: mr.id,
  projectId: mr.project_id,
  repositoryRoot: '/',
  path: 'new_path.js',
  exists: true,
  commit: mr.sha,
  changeType: 'modified',
};

export const projectWithRepositoryInfo: GqlProjectWithRepoInfo = {
  id: 'gid://gitlab/Project/5261717',
  name: 'gitlab-vscode-extension',
  description: '',
  httpUrlToRepo: 'https://gitlab.com/gitlab-org/gitlab-vscode-extension.git',
  sshUrlToRepo: 'git@gitlab.com:gitlab-org/gitlab-vscode-extension.git',
  fullPath: 'gitlab-org/gitlab-vscode-extension',
  repository: {
    empty: false,
    rootRef: 'main',
  },
};

export const createTokenAccount = (
  instanceUrl = 'https://gitlab.com',
  userId = 1,
  token = 'abc',
): TokenAccount => ({
  id: makeAccountId(instanceUrl, userId),
  username: `user${userId}`,
  instanceUrl,
  token,
  type: 'token',
});

export const createOAuthAccount = (
  instanceUrl = 'https://gitlab.com',
  userId = 1,
  token = 'abc',
): OAuthAccount => ({
  id: makeAccountId(instanceUrl, userId),
  username: `user${userId}`,
  instanceUrl,
  token,
  type: 'oauth',
  scopes: ['api'],
  refreshToken: 'def',
  expiresAtTimestampInSeconds: Math.floor(new Date().getTime() / 1000) + 1000, // valid token
});

export const gitRepository = {
  rootFsPath: '/path/to/repo',
  rawRepository: createFakeRepository(),
} as GitRepository;

export const projectInRepository: ProjectInRepository = {
  project,
  pointer: {
    repository: gitRepository,
    remote: { name: 'name' } as GitRemote,
    urlEntry: { type: 'both', url: 'git@gitlab.com:gitlab-org/gitlab-vscode-extension' },
  },
  account: createTokenAccount(),
};

export const restProject: RestProject = {
  ssh_url_to_repo: 'sshurl',
  http_url_to_repo: 'httpurl',
  web_url: 'weburl',
};

export const user: RestUser = {
  email: 'test@user.com',
  id: 123,
  state: 'active',
  username: 'test-user',
};

export const securityFindingAdded: GqlSecurityFinding[] = [
  {
    uuid: '1ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2021-2256 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'INFO',
    foundByPipelineIid: '34',
  },
  {
    uuid: '2ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'LOW',
    foundByPipelineIid: '34',
  },
  {
    uuid: '3ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'MEDIUM',
    foundByPipelineIid: '34',
  },
  {
    uuid: '4ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'HIGH',
    foundByPipelineIid: '34',
  },
  {
    uuid: '5ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'CRITICAL',
    foundByPipelineIid: '34',
  },
  {
    uuid: '6ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'UNKNOWN',
    foundByPipelineIid: '34',
  },
];

export const securityFindingFixed: GqlSecurityFinding[] = [
  {
    uuid: '7ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'INFO',
    foundByPipelineIid: '34',
  },
  {
    uuid: '8ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'LOW',
    foundByPipelineIid: '34',
  },
  {
    uuid: '9ae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'MEDIUM',
    foundByPipelineIid: '34',
  },
  {
    uuid: 'fae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'HIGH',
    foundByPipelineIid: '34',
  },
  {
    uuid: 'be0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'CRITICAL',
    foundByPipelineIid: '34',
  },
  {
    uuid: 'cae0b693-2b75-5724-92cf-6b35f53a53fd',
    title: 'CVE-2022-22576 in curl-7.79.1-1.amzn2.0.1',
    description: 'sd',
    severity: 'UNKNOWN',
    foundByPipelineIid: '34',
  },
];

export const securityReportComparer: GqlSecurityFindingReportComparer = {
  status: 'PARSED',
  report: {
    baseReportCreatedAt: '2023-04-18T02:10:10.460Z',
    baseReportOutOfDate: '2023-04-18T02:10:10.460Z',
    headReportCreatedAt: '2023-04-18T02:10:10.460Z',
    added: securityFindingAdded,
    fixed: securityFindingFixed,
  },
};

export const securityReportFinding: GqlSecurityReportFinding = {
  project: {
    id: 'gid://gitlab/Project/23921884',
    pipeline: {
      id: 'gid://gitlab/Ci::Pipeline/875580836',
      securityReportFinding: {
        id: 'da3c6db0-f38f-5b01-b82f-8f36094a025c',
        vulnerability: {
          id: 'gid://gitlab/Vulnerability/34594691',
          title: 'Cross Site Scripting (Reflected)',
          description:
            "Cross-site Scripting (XSS) is an attack technique that involves echoing attacker-supplied code into a user's browser instance. A browser instance can be a standard web browser client, or a browser object embedded in a software product such as the browser within WinAmp, an RSS reader, or an email client. The code itself is usually written in HTML/JavaScript, but may also extend to VBScript, ActiveX, Java, Flash, or any other browser-supported technology. When an attacker gets a user's browser to execute his/her code, the code will run within the security context (or zone) of the hosting web site. With this level of privilege, the code has the ability to read, modify and transmit any sensitive data accessible by the browser. A Cross-site Scripted user could have his/her account hijacked (cookie theft), their browser redirected to another location, or possibly shown fraudulent content delivered by the web site they are visiting. Cross-site Scripting attacks essentially compromise the trust relationship between a user and the web site. Applications utilizing browser object instances which load content from the file system may execute code under the local machine zone allowing for system compromise. There are three types of Cross-site Scripting attacks: non-persistent, persistent and DOM-based. Non-persistent attacks and DOM-based attacks require a user to either visit a specially crafted link laced with malicious code, or visit a malicious web page containing a web form, which when posted to the vulnerable site, will mount the attack. Using a malicious form will oftentimes take place when the vulnerable resource only accepts HTTP POST requests. In such a case, the form can be submitted automatically, without the victim's knowledge (e.g. by using JavaScript). Upon clicking on the malicious link or submitting the malicious form, the XSS payload will get echoed back and will get interpreted by the user's browser and execute. Another technique to send almost arbitrary requests (GET and POST) is by using an embedded client, such as Adobe Flash. Persistent attacks occur when the malicious code is submitted to a web site where it's stored for a period of time. Examples of an attacker's favorite targets often include message board posts, web mail messages, and web chat software. The unsuspecting user is not required to interact with any additional site/link (e.g. an attacker site or a malicious link sent via email), just simply view the web page containing the code.",
          descriptionHtml:
            "<p data-sourcepos=\"1:1-1:2498\" dir=\"auto\">Cross-site Scripting (XSS) is an attack technique that involves echoing attacker-supplied code into a user's browser instance. A browser instance can be a standard web browser client, or a browser object embedded in a software product such as the browser within WinAmp, an RSS reader, or an email client. The code itself is usually written in HTML/JavaScript, but may also extend to VBScript, ActiveX, Java, Flash, or any other browser-supported technology. When an attacker gets a user's browser to execute his/her code, the code will run within the security context (or zone) of the hosting web site. With this level of privilege, the code has the ability to read, modify and transmit any sensitive data accessible by the browser. A Cross-site Scripted user could have his/her account hijacked (cookie theft), their browser redirected to another location, or possibly shown fraudulent content delivered by the web site they are visiting. Cross-site Scripting attacks essentially compromise the trust relationship between a user and the web site. Applications utilizing browser object instances which load content from the file system may execute code under the local machine zone allowing for system compromise. There are three types of Cross-site Scripting attacks: non-persistent, persistent and DOM-based. Non-persistent attacks and DOM-based attacks require a user to either visit a specially crafted link laced with malicious code, or visit a malicious web page containing a web form, which when posted to the vulnerable site, will mount the attack. Using a malicious form will oftentimes take place when the vulnerable resource only accepts HTTP POST requests. In such a case, the form can be submitted automatically, without the victim's knowledge (e.g. by using JavaScript). Upon clicking on the malicious link or submitting the malicious form, the XSS payload will get echoed back and will get interpreted by the user's browser and execute. Another technique to send almost arbitrary requests (GET and POST) is by using an embedded client, such as Adobe Flash. Persistent attacks occur when the malicious code is submitted to a web site where it's stored for a period of time. Examples of an attacker's favorite targets often include message board posts, web mail messages, and web chat software. The unsuspecting user is not required to interact with any additional site/link (e.g. an attacker site or a malicious link sent via email), just simply view the web page containing the code.</p>",
          severity: 'HIGH',
          project: {
            id: 'gid://gitlab/Project/23921884',
            fullPath: 'gitlab-org/security-products/demos/dast/dvwa',
            nameWithNamespace: 'GitLab.org / security-products / Demos / DAST / DVWA',
          },
          reportType: 'DAST',
          scanner: {
            id: 'gid://gitlab/Representation::VulnerabilityScannerEntry/72498',
            name: 'OWASP Zed Attack Proxy (ZAP)',
          },
          identifiers: [
            {
              name: 'Cross Site Scripting (Reflected)',
              url: 'https://github.com/zaproxy/zaproxy/blob/w2019-01-14/docs/scanners.md',
            },
            {
              name: 'CWE-79',
              url: 'https://cwe.mitre.org/data/definitions/79.html',
            },
          ],
        },
      },
    },
  },
};
