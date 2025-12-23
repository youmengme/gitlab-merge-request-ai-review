import vscode from 'vscode';
import { expect } from '@jest/globals';
import { createFakePartial } from '../common/test_utils/create_fake_partial';
import {
  showAdvancedSearchInput,
  showMergeRequestSearchInput,
  showIssueSearchInput,
  SearchLevelItem,
  SearchLevel,
} from './search_input';
import { projectInRepository } from './test_utils/entities';
import * as openers from './commands/openers';

declare module 'expect' {
  interface Matchers<R> {
    toBeEquivalentUrl(expectedUrl: string): R;
  }
}

const sortSearchQuery = (search: string) =>
  search.slice(0, search.indexOf('?') + 1) +
  search
    .slice(search.indexOf('?') + 1)
    .split('&')
    .sort()
    .join('&');

function toBeEquivalentUrl(
  this: jest.MatcherUtils,
  actual: string,
  expected: string,
): jest.CustomMatcherResult {
  const pass = this.equals(sortSearchQuery(actual), sortSearchQuery(expected));
  if (pass) {
    return {
      message: () =>
        `expected ${this.utils.printReceived(actual)} not to match ${this.utils.printExpected(
          expected,
        )}`,
      pass: true,
    };
  }
  return {
    message: () =>
      `expected ${this.utils.printReceived(actual)} to match ${this.utils.printExpected(expected)}`,
    pass: false,
  };
}

expect.extend({
  toBeEquivalentUrl,
});

describe('search input', () => {
  const title = 'my awesome search';
  const search = title;
  const milestone = '9.5';
  const label = 'discussion';
  const labels = 'frontend, performance';
  const labelsValue = ['discussion', 'frontend', 'performance'];
  const author = 'developerFace';
  const assignee = author;
  const selfAuthor = 'me';
  const selfAssignee = selfAuthor;
  const scope = 'created-by-me';
  const selfAuthorValue = scope;
  const selfAssigneeValue = 'assigned-to-me';

  const selfManagedInstanceSearchScopes = {
    Code: 'blobs',
    Issues: 'issues',
    'Merge Requests': 'merge_requests',
    Wiki: 'wiki_blobs',
    Commits: 'commits',
    Comments: 'notes',
    Milestones: 'milestones',
    Users: 'users',
    Projects: 'projects',
  };

  const gitlabComSearchScopes = {
    Issues: 'issues',
    'Merge Requests': 'merge_requests',
    Comments: 'notes',
    Milestones: 'milestones',
    Users: 'users',
    Projects: 'projects',
  };

  const projectSearchScopes = {
    Code: 'blobs',
    Issues: 'issues',
    'Merge Requests': 'merge_requests',
    Wiki: 'wiki_blobs',
    Commits: 'commits',
    Comments: 'notes',
    Milestones: 'milestones',
    Users: 'users',
  };

  const projectSearchLevel = {
    label: 'Project',
    searchLevel: 'project',
    description: 'The search includes only the current project in results',
  };

  const instanceSearchLevel = {
    label: 'Instance',
    searchLevel: 'instance',
    description: 'The search includes all projects in results',
  };

  const openUrlSpy = jest.spyOn(openers, 'openUrl');
  const projectSearchKeys = Object.keys(projectSearchScopes);
  const gitlabComSearchKeys = Object.keys(gitlabComSearchScopes);
  const selfManagedInstanceSearchKeys = Object.keys(selfManagedInstanceSearchScopes);

  const mockGetUserSearchInput = (searchInput: string) => {
    jest.mocked(vscode.window.showInputBox).mockImplementation(async () => searchInput);
  };

  const mockAdvanceSearchQuickPicks = (searchLevel: SearchLevel, searchScope: string) =>
    jest
      .mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce(
        createFakePartial<SearchLevelItem>({
          searchLevel,
        }),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(searchScope as any); // showQuickPick has a bunch of overloads, somehow Thenable<string> return type is not picked up here as a valid one.

  beforeEach(() => {
    jest.mocked(vscode.window.showInputBox).mockImplementation(async () => 'my awesome search');
  });

  describe('showAdvancedSearchInput', () => {
    it('contains a project id when search at the project level', async () => {
      const searchLevel = 'project';
      const searchScope = 'Code';
      const expectedUrl =
        `${projectInRepository.account.instanceUrl}/` +
        `search?search=${search.split(' ').join('+')}` +
        `&project_id=${projectInRepository.project.restId}` +
        `&scope=blobs`;
      mockAdvanceSearchQuickPicks(searchLevel, searchScope);
      await showAdvancedSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedUrl);
    });
    it('does not set project id when search at the instance level', async () => {
      const searchLevel = 'instance';
      const searchScope = 'Issues';
      const expectedUrl =
        `${projectInRepository.account.instanceUrl}/` +
        `search?search=${search.split(' ').join('+')}` +
        `&scope=issues`;

      mockAdvanceSearchQuickPicks(searchLevel, searchScope);
      await showAdvancedSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedUrl);
    });
    it('presents the proper search scopes for instance level searches', async () => {
      const searchLevel = 'instance';
      const searchScope = 'Code';
      const mockedPicks = mockAdvanceSearchQuickPicks(searchLevel, searchScope);
      await showAdvancedSearchInput(projectInRepository);

      expect(mockedPicks.mock.calls).toEqual([
        [
          [projectSearchLevel, instanceSearchLevel],
          {
            title: 'Search this project or the whole GitLab instance?',
          },
        ],
        [
          Object.keys(gitlabComSearchScopes),
          {
            title: 'Search scope',
          },
        ],
      ]);
    });
    it('presents the proper search scopes for project level searches', async () => {
      const searchLevel = 'project';
      const searchScope = 'Users';
      const mockedPicks = mockAdvanceSearchQuickPicks(searchLevel, searchScope);
      await showAdvancedSearchInput(projectInRepository);
      expect(mockedPicks).lastCalledWith(projectSearchKeys, expect.any(Object));
    });
    it('presents the proper search scopes for gitlab.com instance level searches', async () => {
      const searchLevel = 'instance';
      const searchScope = 'Code';
      const mockedPicks = mockAdvanceSearchQuickPicks(searchLevel, searchScope);
      await showAdvancedSearchInput(projectInRepository);
      expect(mockedPicks).lastCalledWith(gitlabComSearchKeys, expect.any(Object));
    });
    it('presents the proper search scopes for self managed instance level searches', async () => {
      const searchLevel = 'instance';
      const searchScope = 'Code';
      const mockedPicks = mockAdvanceSearchQuickPicks(searchLevel, searchScope);
      projectInRepository.account.instanceUrl = 'https://someprivate.gitlab.com';
      await showAdvancedSearchInput(projectInRepository);
      expect(mockedPicks).lastCalledWith(selfManagedInstanceSearchKeys, expect.any(Object));
    });
  });
  describe('showMergeRequestSearchInput', () => {
    it('opens a basic text search', async () => {
      const expectedSearchUrl =
        `${projectInRepository.project.webUrl}` +
        `/merge_requests?search=${search.split(' ').join('+')}`;
      await showMergeRequestSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSearchUrl);
    });
    it('supports filtered search', async () => {
      const expectedSearchUrl =
        `${projectInRepository.project.webUrl}` +
        `/merge_requests?search=${title.split(' ').join('+')}` +
        `&labels=${labelsValue.join('%2C')}` +
        `&milestone_title=${milestone}` +
        `&scope=${scope}` +
        `&assignee_username=${assignee}` +
        `&author_username=${author}`;
      mockGetUserSearchInput(
        `title: ${title} ` +
          `label: ${label} ` +
          `labels: ${labels} ` +
          `milestone: ${milestone} ` +
          `scope: ${scope} ` +
          `assignee: ${assignee} ` +
          `author: ${author} `,
      );
      await showMergeRequestSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSearchUrl);
    });
    it('finds merge requests assigned to me', async () => {
      const expectedSelfAssignedSearchResult = `${projectInRepository.project.webUrl}/merge_requests?scope=${selfAssigneeValue}`;
      mockGetUserSearchInput(`assignee: ${selfAssignee}`);
      await showMergeRequestSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSelfAssignedSearchResult);
    });
    it('finds self created merge requests', async () => {
      const expectedSelfAssignedSearchResult = `${projectInRepository.project.webUrl}/merge_requests?scope=${selfAuthorValue}`;
      mockGetUserSearchInput(`author: ${selfAuthor}`);
      await showMergeRequestSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSelfAssignedSearchResult);
    });
  });
  describe('showIssueSearchInput', () => {
    it('opens a basic text search', async () => {
      const expectedSearchUrl = `${projectInRepository.project.webUrl}/issues?search=${search
        .split(' ')
        .join('+')}`;
      await showIssueSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSearchUrl);
    });
    it('supports filter searching', async () => {
      const expectedSearchUrl =
        `${projectInRepository.project.webUrl}` +
        `/issues?search=${title.split(' ').join('+')}` +
        `&labels=${labelsValue.join('%2C')}` +
        `&milestone_title=${milestone}` +
        `&scope=${scope}` +
        `&assignee_username%5B%5D=${assignee}` +
        `&author_username=${author}`;
      mockGetUserSearchInput(
        `title: ${title} ` +
          `label: ${label} ` +
          `labels: ${labels} ` +
          `milestone: ${milestone} ` +
          `scope: ${scope} ` +
          `assignee: ${assignee} ` +
          `author: ${author} `,
      );
      await showIssueSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSearchUrl);
    });
    it('finds issues assigned to me', async () => {
      const expectedSelfAssignedSearchResult = `${projectInRepository.project.webUrl}/issues?scope=${selfAssigneeValue}`;
      mockGetUserSearchInput(`assignee: ${selfAssignee}`);
      await showIssueSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSelfAssignedSearchResult);
    });
    it('finds self created issues', async () => {
      const expectedSelfAssignedSearchResult = `${projectInRepository.project.webUrl}/issues?scope=${selfAuthorValue}`;
      mockGetUserSearchInput(`author: ${selfAuthor}`);
      await showIssueSearchInput(projectInRepository);
      expect(openUrlSpy.mock.calls[0][0]).toBeEquivalentUrl(expectedSelfAssignedSearchResult);
    });
  });
});
