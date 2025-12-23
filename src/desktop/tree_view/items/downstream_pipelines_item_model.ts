import * as vscode from 'vscode';
import { ProjectInRepository } from '../../gitlab/new_project';
import { getPipelineMetadata } from '../../gitlab/ci_status_metadata';
import { compareBy } from '../../../common/utils/compare_by';
import { notNullOrUndefined } from '../../../common/utils/not_null_or_undefined';
import { log } from '../../../common/log';
import { getGitLabService } from '../../gitlab/get_gitlab_service';
import { PipelineItemModel } from './pipeline_item_model';
import { ItemModel } from './item_model';

function hasChildPipeline(job: RestJob): job is RestBridge {
  return 'downstream_pipeline' in job && job.downstream_pipeline !== null;
}

const getDownstreamJobs = async (
  projectInRepository: ProjectInRepository,
  pipeline?: RestPipeline,
): Promise<RestJob[]> => {
  if (!pipeline) return [];
  try {
    const projectId = pipeline.project_id;
    const service = getGitLabService(projectInRepository);

    const pipelinePromise = service.getJobsForPipeline(pipeline.id, projectId);
    const bridgesPromise = service.getTriggerJobsForPipeline(pipeline.id, projectId);
    const statusPromise = service.getExternalStatusForCommit(pipeline.sha, pipeline.ref, projectId);
    return [...(await pipelinePromise), ...(await bridgesPromise), ...(await statusPromise)];
  } catch (e) {
    log.error('Failed to fetch jobs for downstream pipeline.', e);
    return [];
  }
};

export class DownstreamPipelinesItemModel extends ItemModel {
  projectInRepository: ProjectInRepository;

  bridgeJobs: RestBridge[];

  constructor(projectInRepository: ProjectInRepository, bridgeJobs: RestBridge[]) {
    super();
    this.projectInRepository = projectInRepository;
    this.bridgeJobs = [...bridgeJobs].sort(compareBy('id'));
  }

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'Downstream pipelines',
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    const [mostSevereStatusMetadata] = this.bridgeJobs
      .map(j => j.downstream_pipeline)
      .filter(notNullOrUndefined)
      .map(p => getPipelineMetadata(p))
      .sort(compareBy('priority'))
      .reverse();
    item.iconPath = mostSevereStatusMetadata?.icon;
    if (mostSevereStatusMetadata?.name) {
      item.tooltip = `${item.label} · ${mostSevereStatusMetadata.name}`;
    }
    return item;
  }

  async getChildren(): Promise<ItemModel[]> {
    const jobsWithDownstream = await Promise.all(
      this.bridgeJobs.map(async job => {
        const downstreamJobs = await getDownstreamJobs(
          this.projectInRepository,
          job.downstream_pipeline,
        );
        return {
          bridgeJob: job,
          downstreamJobs,
        };
      }),
    );

    return jobsWithDownstream.flatMap(({ bridgeJob, downstreamJobs }) => {
      const pipelineItem = new PipelineItemModel(
        this.projectInRepository,
        bridgeJob.downstream_pipeline,
        downstreamJobs,
        bridgeJob.name,
      );

      const jobsWithChildPipeline = downstreamJobs.filter(hasChildPipeline);

      if (jobsWithChildPipeline.length > 0) {
        return [
          pipelineItem,
          new DownstreamPipelinesItemModel(this.projectInRepository, jobsWithChildPipeline),
        ];
      }

      return [pipelineItem];
    });
  }
}
