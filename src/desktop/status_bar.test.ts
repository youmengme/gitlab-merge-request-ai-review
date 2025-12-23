import * as vscode from 'vscode';
import { project } from '../common/test_utils/entities';
import { createFakePartial } from '../common/test_utils/create_fake_partial';
import { pipeline, mr, issue, job } from './test_utils/entities';
import { USER_COMMANDS } from './command_names';
import { BranchState } from './current_branch_refresher';
import { ProjectInRepository } from './gitlab/new_project';

jest.mock('./git/git_extension_wrapper');
jest.mock('./extension_state');

jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(
  createFakePartial<vscode.WorkspaceConfiguration>({
    get: jest.fn(),
  }),
);

// StatusBar needs to be imported after we mock the configuration because it uses the configuration
// during module initialization
// eslint-disable-next-line import/first
import { StatusBar } from './status_bar';

const createFakeItem = (): vscode.StatusBarItem =>
  ({
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  }) as unknown as vscode.StatusBarItem;

const createBranchInfo = (partialInfo: Partial<BranchState> = {}): BranchState => ({
  type: 'branch',
  projectInRepository: { project, pointer: { repository: {} } } as unknown as ProjectInRepository,
  issues: [],
  jobs: [],
  userInitiated: true,
  ...partialInfo,
});

describe('status_bar', () => {
  let fakeItems: vscode.StatusBarItem[];
  let statusBar: StatusBar;
  const getPipelineItem = () => fakeItems[0];
  const getMrItem = () => fakeItems[1];
  const getClosingIssueItem = () => fakeItems[2];

  beforeEach(() => {
    fakeItems = [];
    jest.mocked(vscode.window.createStatusBarItem).mockImplementation(() => {
      const fakeItem = createFakeItem();
      fakeItems.push(fakeItem);
      return fakeItem;
    });
    statusBar = new StatusBar();
    statusBar.init();
  });

  afterEach(() => {
    statusBar.dispose();
  });

  it('hides all items when the state is not valid', async () => {
    await statusBar.refresh({ type: 'invalid' });
    expect(getPipelineItem().hide).toHaveBeenCalled();
    expect(getMrItem().hide).toHaveBeenCalled();
    expect(getClosingIssueItem().hide).toHaveBeenCalled();
  });

  describe('pipeline item', () => {
    it('initializes the pipeline item with success', async () => {
      await statusBar.refresh(createBranchInfo({ pipeline }));
      expect(getPipelineItem().show).toHaveBeenCalled();
      expect(getPipelineItem().hide).not.toHaveBeenCalled();
      expect(getPipelineItem().text).toBe('$(check) Pipeline passed');
    });

    it('prints jobs for running pipeline', async () => {
      const jobs = [
        {
          ...job,
          status: 'running',
          name: 'Unit Tests',
        },
        {
          ...job,
          status: 'running',
          name: 'Integration Tests',
        },
        {
          ...job,
          status: 'success',
          name: 'Lint',
        },
      ] as RestJob[];
      await statusBar.refresh(
        createBranchInfo({ pipeline: { ...pipeline, status: 'running' }, jobs }),
      );
      expect(getPipelineItem().text).toBe('$(pulse) Pipeline running');
    });

    it('sorts by created time (starts with newer) and deduplicates jobs for running pipeline', async () => {
      const jobs = [
        {
          ...job,
          status: 'running',
          name: 'Integration Tests',
          created_at: '2021-07-19T12:00:00.000Z',
        },
        {
          ...job,
          status: 'running',
          name: 'Unit Tests',
          created_at: '2021-07-19T10:00:00.000Z',
        },
        {
          ...job,
          status: 'running',
          name: 'Unit Tests',
          created_at: '2021-07-19T11:00:00.000Z',
        },
      ] as RestJob[];
      await statusBar.refresh(
        createBranchInfo({ pipeline: { ...pipeline, status: 'running' }, jobs }),
      );
      expect(getPipelineItem().text).toBe('$(pulse) Pipeline running');
    });

    it('shows no pipeline text when there is no pipeline', async () => {
      await statusBar.refresh(createBranchInfo());
      expect(getPipelineItem().text).toBe('No pipeline');
    });

    it.each`
      status        | itemText
      ${'running'}  | ${'$(pulse) Pipeline running'}
      ${'success'}  | ${'$(check) Pipeline passed'}
      ${'pending'}  | ${'$(clock) Pipeline pending'}
      ${'failed'}   | ${'$(x) Pipeline failed'}
      ${'canceled'} | ${'$(circle-slash) Pipeline canceled'}
      ${'skipped'}  | ${'$(diff-renamed) Pipeline skipped'}
    `('shows $itemText for pipeline with status $status', async ({ status, itemText }) => {
      await statusBar.refresh(createBranchInfo({ pipeline: { ...pipeline, status } }));
      expect(getPipelineItem().text).toBe(itemText);
    });
  });

  describe('MR item', () => {
    it('shows MR item', async () => {
      await statusBar.refresh(createBranchInfo({ mr }));
      expect(getMrItem().show).toHaveBeenCalled();
      expect(getMrItem().hide).not.toHaveBeenCalled();
      expect(getMrItem().text).toBe('$(git-pull-request) !2000');
      const command = getMrItem().command as vscode.Command;
      expect(command.command).toBe('gl.showRichContent');
      expect(command.arguments?.[0]).toEqual(mr);
    });

    it('shows create MR text when there is no MR', async () => {
      await statusBar.refresh(createBranchInfo());
      expect(getMrItem().text).toBe('$(git-pull-request) Create MR');
      expect(getMrItem().command).toBe(USER_COMMANDS.OPEN_CREATE_NEW_MR);
    });
  });

  describe('MR closing issue item', () => {
    it('shows closing issue for an MR', async () => {
      await statusBar.refresh(createBranchInfo({ mr, issues: [issue] }));
      expect(getClosingIssueItem().show).toHaveBeenCalled();
      expect(getClosingIssueItem().hide).not.toHaveBeenCalled();
      expect(getClosingIssueItem().text).toBe('$(code) #1000');
      const command = getClosingIssueItem().command as vscode.Command;
      expect(command.command).toBe('gl.showRichContent');
      expect(command.arguments?.[0]).toEqual(issue);
    });

    it('shows no issue when there is not a closing issue', async () => {
      await statusBar.refresh(createBranchInfo({ mr, issues: [] }));
      expect(getClosingIssueItem().text).toBe('$(code) No issue');
      expect(getClosingIssueItem().command).toBe(undefined);
    });

    it('hides the item when there is is no MR', async () => {
      await statusBar.refresh(createBranchInfo());
      expect(getClosingIssueItem().hide).toHaveBeenCalled();
    });
  });
});
