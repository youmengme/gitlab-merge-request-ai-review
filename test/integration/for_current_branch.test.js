const assert = require('assert');
const dayjs = require('dayjs');
const { graphql, HttpResponse } = require('msw');
const {
  CurrentBranchDataProvider,
} = require('../../src/desktop/tree_view/current_branch_data_provider');
const { CurrentBranchRefresher } = require('../../src/desktop/current_branch_refresher');
const closingIssueResponse = require('./fixtures/rest/closing_issue.json');
const openIssueResponse = require('./fixtures/rest/open_issue.json');
const pipelinesResponse = require('./fixtures/rest/pipelines.json');
const openMergeRequestResponse = require('./fixtures/rest/open_mr.json');
const securtyFindingsResponse = require('./fixtures/graphql/security_findings.json');
const {
  getServer,
  createQueryJsonEndpoint,
  createJsonEndpoint,
} = require('./test_infrastructure/mock_server');

describe('GitLab tree view for current branch', () => {
  let server;
  let dataProvider;
  let refresher;

  const fourYearsAgo = dayjs().subtract(4, 'year');

  const pipelinesResponseWithFixedDate = [
    { ...pipelinesResponse[0], updated_at: fourYearsAgo.toISOString() },
    ...pipelinesResponse.slice(1, pipelinesResponse.length),
  ];

  const pipelinesEndpoint = createQueryJsonEndpoint('/projects/278964/pipelines', {
    '?ref=master': pipelinesResponseWithFixedDate,
  });
  const pipelinesForMrEndpoint = createJsonEndpoint(
    '/projects/278964/merge_requests/33824/pipelines',
    pipelinesResponseWithFixedDate,
  );

  const mrEndpoint = createQueryJsonEndpoint('/projects/278964/merge_requests', {
    '?state=opened&source_branch=master': [openMergeRequestResponse],
  });
  const closingIssuesEndpoint = createJsonEndpoint(
    '/projects/278964/merge_requests/33824/closes_issues',
    [closingIssueResponse],
  );
  const issueEndpoint = createJsonEndpoint('/projects/278964/issues/219925', openIssueResponse);

  const getMRSecurityReportQuery = graphql.query('getMRSecurityReport', () =>
    HttpResponse.json({ data: securtyFindingsResponse }),
  );

  beforeEach(() => {
    dataProvider = new CurrentBranchDataProvider();
    refresher = new CurrentBranchRefresher();
    refresher.init();
    refresher.onStateChanged(e => dataProvider.refresh(e));
  });

  afterEach(() => {
    server.close();
  });

  it('shows detached pipeline and mr for the current branch', async () => {
    server = getServer([pipelinesForMrEndpoint, mrEndpoint, getMRSecurityReportQuery]);
    await refresher.refresh();
    const forCurrentBranch = await dataProvider.getChildren();
    assert.deepStrictEqual(
      forCurrentBranch.map(i => dataProvider.getTreeItem(i).label),
      [
        'Pipeline #47',
        '!33824 · Web IDE - remove unused actions (mappings)',
        'No closing issue found',
        'Security scanning',
      ],
    );
  });

  it('shows standard pipeline, mr and closing issue for the current branch', async () => {
    server = getServer([
      pipelinesEndpoint,
      mrEndpoint,
      issueEndpoint,
      closingIssuesEndpoint,
      getMRSecurityReportQuery,
    ]);
    await refresher.refresh();
    const forCurrentBranch = await dataProvider.getChildren();
    assert.deepStrictEqual(
      forCurrentBranch.map(i => dataProvider.getTreeItem(i).label),
      [
        'Pipeline #47',
        '!33824 · Web IDE - remove unused actions (mappings)',
        '#219925 · Change primary button for editing on files',
        'Security scanning',
      ],
    );
  });

  it('handles error for pipeline API request', async () => {
    server = getServer([
      mrEndpoint,
      issueEndpoint,
      closingIssuesEndpoint,
      getMRSecurityReportQuery,
    ]);
    await refresher.refresh();
    const forCurrentBranch = await dataProvider.getChildren();
    assert.deepStrictEqual(
      forCurrentBranch.map(i => dataProvider.getTreeItem(i).label),
      [
        'No pipeline found',
        '!33824 · Web IDE - remove unused actions (mappings)',
        '#219925 · Change primary button for editing on files',
        'Security scanning',
      ],
    );
  });

  it('handles error for MR API request', async () => {
    server = getServer([pipelinesEndpoint, getMRSecurityReportQuery]);
    await refresher.refresh();
    const forCurrentBranch = await dataProvider.getChildren();
    assert.deepStrictEqual(
      forCurrentBranch.map(i => dataProvider.getTreeItem(i).label),
      [
        'Pipeline #47',
        'No merge request found',
        'No closing issue found',
        'No security scans found',
      ],
    );
  });

  it('handles error for issue API request', async () => {
    server = getServer([pipelinesEndpoint, mrEndpoint, getMRSecurityReportQuery]);
    await refresher.refresh();
    const forCurrentBranch = await dataProvider.getChildren();
    assert.deepStrictEqual(
      forCurrentBranch.map(i => dataProvider.getTreeItem(i).label),
      [
        'Pipeline #47',
        '!33824 · Web IDE - remove unused actions (mappings)',
        'No closing issue found',
        'Security scanning',
      ],
    );
  });
});
