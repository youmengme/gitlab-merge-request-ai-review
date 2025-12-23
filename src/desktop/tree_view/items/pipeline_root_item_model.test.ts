import { job, pipeline, projectInRepository } from '../../test_utils/entities';
import { DownstreamPipelinesItemModel } from './downstream_pipelines_item_model';
import { PipelineRootItemModel } from './pipeline_root_item_model';
import { StageItemModel } from './stage_item_model';

describe('PipelineRootItemModel', () => {
  describe('tree item', () => {
    it('hides Downstream item', async () => {
      const item = new PipelineRootItemModel(projectInRepository, pipeline, [job]);

      const children = await item.getChildren();

      expect(children).toHaveLength(1);

      const [jobItem] = children;
      expect(jobItem).toBeInstanceOf(StageItemModel);
    });

    it('shows Downstream item', async () => {
      const bridge: RestBridge = {
        ...job,
        id: 3,
        downstream_pipeline: { ...pipeline, id: 4 },
      };

      const item = new PipelineRootItemModel(projectInRepository, pipeline, [job, bridge]);

      const children = await item.getChildren();

      expect(children).toHaveLength(2);

      const [jobItem, downstreamItem] = children;
      expect(jobItem).toBeInstanceOf(StageItemModel);
      expect(downstreamItem).toBeInstanceOf(DownstreamPipelinesItemModel);
      expect((downstreamItem as DownstreamPipelinesItemModel).bridgeJobs).toStrictEqual([bridge]);
    });
  });
});
