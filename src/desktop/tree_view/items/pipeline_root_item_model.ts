import { DownstreamPipelinesItemModel } from './downstream_pipelines_item_model';
import { ItemModel } from './item_model';
import { PipelineItemModel } from './pipeline_item_model';

function hasChildPipeline(job: RestJob): job is RestBridge {
  return 'downstream_pipeline' in job && job.downstream_pipeline !== null;
}

export class PipelineRootItemModel extends PipelineItemModel {
  async getChildren(): Promise<ItemModel[]> {
    const children = await super.getChildren();

    const jobsWithChildPipeline = this.jobs.filter(hasChildPipeline);
    if (jobsWithChildPipeline.length > 0) {
      children.push(
        new DownstreamPipelinesItemModel(this.projectInRepository, jobsWithChildPipeline),
      );
    }
    return children;
  }
}
