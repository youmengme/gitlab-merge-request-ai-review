import * as vscode from 'vscode';
import dayjs from 'dayjs';
import { artifact, job, bridgeJob, projectInRepository } from '../../test_utils/entities';
import { VS_COMMANDS } from '../../../common/command_names';
import { toJobLogUri } from '../../ci/job_log_uri';
import { JobItemModel } from './job_item_model';

const fourYearsAgo = dayjs().subtract(4, 'year').toString();
describe('JobItemModel', () => {
  const jobItemModel = new JobItemModel(projectInRepository, job);

  it('returns the provided job', () => {
    expect(jobItemModel.jobs).toEqual([job]);
  });
});

describe('item created by JobItemModel', () => {
  const jobItemModel = new JobItemModel(projectInRepository, {
    ...job,
    name: 'unit test',
    status: 'failed',
    finished_at: fourYearsAgo,
  });

  const jobItem = jobItemModel.getTreeItem();

  it('has label', () => {
    expect(jobItem.label).toBe('unit test');
  });

  it('has icon', () => {
    expect((jobItem.iconPath as vscode.ThemeIcon).id).toBe('error');
  });

  it('has description', () => {
    expect(jobItem.description).toBe('Failed');
  });

  it('has tooltip', () => {
    expect(jobItem.tooltip).toBe('unit test · Failed · 4 years ago');
  });

  it('has a default command for opening the job trace', () => {
    expect(jobItem.command?.command).toBe(VS_COMMANDS.OPEN);
    expect(jobItem.command?.arguments).toEqual([
      toJobLogUri(
        projectInRepository.pointer.repository.rootFsPath,
        job.pipeline.project_id,
        job.id,
      ),
      { preview: true },
    ]);
  });

  it('has contextValue if needs to be started manually', () => {
    const manualItem = new JobItemModel(projectInRepository, {
      ...job,
      started_at: undefined,
      finished_at: undefined,
      status: 'manual',
    }).getTreeItem();
    expect(manualItem.contextValue).toBe('executable-job,pending-job,with-url');
  });

  it('has contextValue if downloadable artifacts exist', () => {
    const itemWithArtifacts = new JobItemModel(projectInRepository, {
      ...job,
      artifacts: [artifact],
    }).getTreeItem();
    expect(itemWithArtifacts.contextValue).toBe('retryable-job,with-artifacts,with-trace,with-url');
  });

  it('has contextValue if log is erased', () => {
    const itemWithArtifacts = new JobItemModel(projectInRepository, {
      ...job,
      erased_at: dayjs().toString(),
    }).getTreeItem();
    expect(itemWithArtifacts.contextValue).toBe('retryable-job,pending-job,with-url');
  });

  describe('showing relative time', () => {
    const threeYearsAgo = dayjs().subtract(3, 'year').toString();
    const twoYearsAgo = dayjs().subtract(2, 'year').toString();

    const testJob = {
      ...job,
      created_at: fourYearsAgo,
      started_at: undefined,
      finished_at: undefined,
    };

    it('uses created_at as a last resort', () => {
      expect(new JobItemModel(projectInRepository, testJob).getTreeItem().tooltip).toMatch(
        '4 years ago',
      );
    });

    it('uses started_at over created_at', () => {
      expect(
        new JobItemModel(projectInRepository, {
          ...testJob,
          started_at: threeYearsAgo,
        }).getTreeItem().tooltip,
      ).toMatch('3 years ago');
    });

    it('finished_at has highest priority', () => {
      expect(
        new JobItemModel(projectInRepository, {
          ...testJob,
          finished_at: twoYearsAgo,
          started_at: threeYearsAgo,
        }).getTreeItem().tooltip,
      ).toMatch('2 years ago');
    });
  });

  describe('handling trigger jobs', () => {
    it('manual trigger job should be marked executable', () => {
      expect(
        new JobItemModel(projectInRepository, {
          ...bridgeJob,
          started_at: undefined,
          finished_at: undefined,
          status: 'manual',
        }).getTreeItem().contextValue,
      ).toContain('executable-job');
    });

    it('finished trigger job should be marked retryable', () => {
      expect(
        new JobItemModel(projectInRepository, {
          ...bridgeJob,
          status: 'success',
          started_at: '2025-07-19T11:44:54.928Z',
          finished_at: '2025-07-19T11:44:54.928Z',
        }).getTreeItem().contextValue,
      ).toContain('retryable-job');
    });

    it('running trigger job should NOT be marked cancellable', () => {
      expect(
        new JobItemModel(projectInRepository, {
          ...bridgeJob,
          status: 'running',
          started_at: '2025-07-19T11:44:54.928Z',
          finished_at: undefined,
        }).getTreeItem().contextValue,
      ).not.toContain('cancellable-job');
    });
  });
});
