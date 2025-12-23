import assert from 'assert';
import * as vscode from 'vscode';
import { pipeline, job, projectInRepository } from '../../test_utils/entities';
import { VS_COMMANDS } from '../../../common/command_names';
import { getGitLabService } from '../../gitlab/get_gitlab_service';
import { GitLabService } from '../../gitlab/gitlab_service';
import { createFakePartial } from '../../../common/test_utils/create_fake_partial';
import { DownstreamPipelinesItemModel } from './downstream_pipelines_item_model';
import { PipelineItemModel } from './pipeline_item_model';

jest.mock('../../gitlab/get_gitlab_service');

describe('DownstreamItemModel', () => {
  const bridges: RestBridge[] = [
    {
      ...job,
      name: 'Trigger job 1',
      status: 'success',
      downstream_pipeline: {
        ...pipeline,
        id: 100,
        web_url: 'https://example.com/foo/bar/pipelines/100',
        source: 'pipeline',
        status: 'pending',
      },
    },
    {
      ...job,
      status: 'success',
      downstream_pipeline: {
        ...pipeline,
        source: 'parent_pipeline',
        status: 'running',
      },
    },
  ];

  let mockService: GitLabService;

  beforeEach(() => {
    mockService = createFakePartial<GitLabService>({
      getJobsForPipeline: jest.fn().mockResolvedValue([]),
      getTriggerJobsForPipeline: jest.fn().mockResolvedValue([]),
      getExternalStatusForCommit: jest.fn().mockResolvedValue([]),
    });

    jest.mocked(getGitLabService).mockReturnValue(mockService);
  });

  describe('tree item', () => {
    it('takes tooltip and icon after the job with highest priority (e.g. running)', () => {
      const item = new DownstreamPipelinesItemModel(projectInRepository, bridges).getTreeItem();

      expect(item.tooltip).toContain('Running');
      expect((item.iconPath as vscode.ThemeIcon).id).toBe('play');
    });
  });

  describe('getChildren', () => {
    it('returns pipeline items for downstream pipelines', async () => {
      const children = await new DownstreamPipelinesItemModel(
        projectInRepository,
        bridges,
      ).getChildren();

      expect(children.length).toBe(2);

      const items = children.map(child => (child as PipelineItemModel).pipeline);
      expect(items).toStrictEqual(bridges.map(bridge => bridge.downstream_pipeline));
    });

    it('displays the job name', async () => {
      const [first] = await new DownstreamPipelinesItemModel(
        projectInRepository,
        bridges,
      ).getChildren();
      expect(first.getTreeItem().label).toContain(bridges[0].name);
    });

    it('opens the browser when selected', async () => {
      const [first] = await new DownstreamPipelinesItemModel(
        projectInRepository,
        bridges,
      ).getChildren();
      const { command } = first.getTreeItem();
      expect(command?.command).toBe(VS_COMMANDS.OPEN);

      assert(command?.arguments);
      const [uri] = command.arguments;
      expect(uri.toString()).toBe(bridges[0].downstream_pipeline.web_url);
    });

    it('displays a tooltip', async () => {
      const [first, second] = await new DownstreamPipelinesItemModel(
        projectInRepository,
        bridges,
      ).getChildren();
      expect(first.getTreeItem().tooltip).toContain('Multi-project');
      expect(second.getTreeItem().tooltip).toContain('Child pipeline');
    });

    it('displays nested jobs from pipeline structure', async () => {
      // Setup child job with its own downstream pipeline
      const nestedJob = {
        ...job,
        id: 200,
        name: 'Nested trigger job',
        downstream_pipeline: {
          ...pipeline,
          id: 300,
          status: 'success',
        },
      };

      // Setup response data for a happy path scenario
      mockService = createFakePartial<GitLabService>({
        getJobsForPipeline: jest.fn().mockImplementation(pipelineId => {
          if (pipelineId === bridges[0].downstream_pipeline.id) {
            return Promise.resolve([nestedJob]);
          }
          return Promise.resolve([]);
        }),
        getTriggerJobsForPipeline: jest.fn().mockResolvedValue([]),
        getExternalStatusForCommit: jest.fn().mockResolvedValue([]),
      });

      jest.mocked(getGitLabService).mockReturnValue(mockService);

      // Get the children
      const model = new DownstreamPipelinesItemModel(projectInRepository, bridges);

      const children = await model.getChildren();

      // Should include 3 items:
      // - Original pipeline items + nested downstream model
      expect(children.length).toBe(3);

      // Verify that at least one item is a DownstreamPipelinesItemModel (for nested pipeline)
      const hasDownstreamModel = children.some(
        child => child instanceof DownstreamPipelinesItemModel,
      );
      expect(hasDownstreamModel).toBe(true);

      // Verify the service methods were called with correct parameters
      expect(mockService.getJobsForPipeline).toHaveBeenCalledWith(
        bridges[0].downstream_pipeline.id,
        bridges[0].downstream_pipeline.project_id,
      );
      expect(mockService.getTriggerJobsForPipeline).toHaveBeenCalledWith(
        bridges[0].downstream_pipeline.id,
        bridges[0].downstream_pipeline.project_id,
      );
      expect(mockService.getExternalStatusForCommit).toHaveBeenCalledWith(
        bridges[0].downstream_pipeline.sha,
        bridges[0].downstream_pipeline.ref,
        bridges[0].downstream_pipeline.project_id,
      );
    });

    it('handles API failures gracefully', async () => {
      // For the "sad path" test, only fail one API call
      // to avoid unrelated error logs in test output
      mockService = createFakePartial<GitLabService>({
        getJobsForPipeline: jest.fn().mockRejectedValue(new Error('API error')),
        getTriggerJobsForPipeline: jest.fn().mockResolvedValue([]),
        getExternalStatusForCommit: jest.fn().mockResolvedValue([]),
      });

      jest.mocked(getGitLabService).mockReturnValue(mockService);

      // Get the children
      const model = new DownstreamPipelinesItemModel(projectInRepository, bridges);

      // Should not throw errors
      const children = await model.getChildren();

      // Should include the original pipeline items despite API errors
      expect(children.length).toBe(2);
      expect(children[0]).toBeInstanceOf(PipelineItemModel);
      expect(children[1]).toBeInstanceOf(PipelineItemModel);
    });
  });
});
