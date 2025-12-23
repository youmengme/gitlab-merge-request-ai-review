import { Disposable } from 'vscode';
import { BranchState, TagState } from '../current_branch_refresher';
import {
  mr,
  pipeline,
  job,
  issue,
  projectInRepository,
  securityReportComparer,
} from '../test_utils/entities';
import {
  getLocalFeatureFlagService,
  LocalFeatureFlagService,
} from '../../common/feature_flags/local_feature_flag_service';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { CurrentBranchDataProvider } from './current_branch_data_provider';
import { ItemModel } from './items/item_model';
import { PipelineItemModel } from './items/pipeline_item_model';

jest.mock('./items/mr_item_model');
jest.mock('./items/pipeline_item_model');
jest.mock('../../common/utils/extension_configuration');
jest.mock('../../common/feature_flags/local_feature_flag_service');

const isItemModel = (object: unknown): object is ItemModel => {
  if (object !== null && typeof object === 'object' && 'dispose' in object) {
    return typeof (object as ItemModel).dispose === 'function';
  }
  return false;
};

const branchState: BranchState = {
  type: 'branch',
  mr,
  pipeline,
  jobs: [job],
  issues: [issue],
  projectInRepository,
  userInitiated: true,
};

const tagState: TagState = {
  type: 'tag',
  pipeline,
  jobs: [job],
  projectInRepository,
  userInitiated: true,
};

describe('CurrentBranchDataProvider', () => {
  let currentBranchProvider: CurrentBranchDataProvider;
  let pipelineItem: Disposable;
  let mrItem: Disposable;

  describe('instance', () => {
    beforeEach(async () => {
      jest
        .mocked(getLocalFeatureFlagService)
        .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => false }));
      currentBranchProvider = new CurrentBranchDataProvider();
      await currentBranchProvider.refresh(branchState);
      [pipelineItem, mrItem] = (await currentBranchProvider.getChildren(undefined)).filter(
        isItemModel,
      );
    });

    describe('disposing items', () => {
      it('dispose is not called before refresh', () => {
        expect(pipelineItem.dispose).not.toHaveBeenCalled();
        expect(mrItem.dispose).not.toHaveBeenCalled();
      });

      it('disposes previous items when we render valid state', async () => {
        await currentBranchProvider.getChildren(undefined);
        expect(pipelineItem.dispose).toHaveBeenCalled();
        expect(mrItem.dispose).toHaveBeenCalled();
      });

      it('disposes previous branch items when we render tag state', async () => {
        currentBranchProvider.refresh(tagState);
        await currentBranchProvider.getChildren(undefined);
        expect(pipelineItem.dispose).toHaveBeenCalled();
        expect(mrItem.dispose).toHaveBeenCalled();
      });

      it('disposes previous items when we render invalid state', async () => {
        currentBranchProvider.refresh({ type: 'invalid' });
        await currentBranchProvider.getChildren(undefined);
        expect(pipelineItem.dispose).toHaveBeenCalled();
        expect(mrItem.dispose).toHaveBeenCalled();
      });

      it('does not dispose mr item if the refresh is not user initiated', async () => {
        currentBranchProvider.refresh({ ...branchState, userInitiated: false });
        await currentBranchProvider.getChildren(undefined);
        expect(mrItem.dispose).not.toHaveBeenCalled();
      });

      it('reuses the same mr item if the refresh was not user initiated', async () => {
        currentBranchProvider.refresh({ ...branchState, userInitiated: false });
        const [, newMrItem] = await currentBranchProvider.getChildren(undefined);
        expect(newMrItem).toBe(mrItem);
      });
    });

    describe('MR Item', () => {
      it('reuses the same mr item if the refresh was not user initiated', async () => {
        currentBranchProvider.refresh({ ...branchState, userInitiated: false });
        const [, newMrItem] = await currentBranchProvider.getChildren(undefined);
        expect(newMrItem).toBe(mrItem);
      });

      it('renders new MR item if the user initiated the refresh', async () => {
        currentBranchProvider.refresh({ ...branchState, userInitiated: true });
        const [, newMrItem] = await currentBranchProvider.getChildren(undefined);
        expect(newMrItem).not.toBe(mrItem);
      });

      it('if the MR is different, even automatic (not user initiated) refresh triggers rerender', async () => {
        currentBranchProvider.refresh({
          ...branchState,
          mr: { ...mr, id: 99999 },
          userInitiated: false,
        });
        const [, newMrItem] = await currentBranchProvider.getChildren(undefined);
        expect(newMrItem).not.toBe(mrItem);
      });
    });

    describe('Security findings item', () => {
      describe('security scans flag off', () => {
        beforeEach(() => {
          jest
            .mocked(getLocalFeatureFlagService)
            .mockReturnValue(
              createFakePartial<LocalFeatureFlagService>({ isEnabled: () => false }),
            );
        });

        it('does not render item', async () => {
          currentBranchProvider.refresh({
            ...branchState,
            pipeline: { ...pipeline, status: 'running' },
          });

          const [, , , securityItem] = await currentBranchProvider.getChildren(undefined);
          expect(securityItem as ItemModel).toBe(undefined);
        });
      });
      describe('security scans flag on', () => {
        beforeEach(() => {
          jest
            .mocked(getLocalFeatureFlagService)
            .mockReturnValue(createFakePartial<LocalFeatureFlagService>({ isEnabled: () => true }));
        });

        it('renders no scans found', async () => {
          currentBranchProvider.refresh({
            ...branchState,
            pipeline: { ...pipeline, status: 'success' },
            mr: undefined,
            securityFindings: undefined,
          });

          const [, , , securityItem] = await currentBranchProvider.getChildren(undefined);
          expect((securityItem as ItemModel).getTreeItem().label).toBe('No security scans found');
        });

        it('renders scanning state', async () => {
          currentBranchProvider.refresh({
            ...branchState,
            pipeline: { ...pipeline, status: 'running' },
            securityFindings: undefined,
          });

          const [, , , securityItem] = await currentBranchProvider.getChildren(undefined);
          expect((securityItem as ItemModel).getTreeItem().label).toBe('Security scanning');
        });

        it('renders complete state', async () => {
          currentBranchProvider.refresh({
            ...branchState,
            pipeline: { ...pipeline, status: 'success' },
            securityFindings: securityReportComparer,
          });

          const [, , , securityItem] = await currentBranchProvider.getChildren(undefined);
          expect((securityItem as ItemModel).getTreeItem().label).toBe('Security scanning');
        });
      });
    });

    describe('Pipeline item', () => {
      it.each([tagState, branchState])('renders pipeline item for $type state', async state => {
        currentBranchProvider.refresh(state);
        const [pipelineItemModel] = await currentBranchProvider.getChildren(undefined);
        expect(pipelineItemModel).toBeInstanceOf(PipelineItemModel);
      });
    });
  });

  describe('static functions', () => {
    describe('getSecurityReportType', () => {
      it.each`
        pipelineStatus            | securityReportStatus | scanResultsType
        ${'failed'}               | ${'ERROR'}           | ${'PIPELINE_FAILED'}
        ${'canceled'}             | ${'ERROR'}           | ${'PIPELINE_CANCELED'}
        ${'preparing'}            | ${'ERROR'}           | ${'PIPELINE_PREPARING'}
        ${'waiting_for_callback'} | ${'ERROR'}           | ${'PIPELINE_WAITING_FOR_CALLBACK'}
        ${'waiting_for_resource'} | ${'ERROR'}           | ${'PIPELINE_WAITING_FOR_RESOURCE'}
        ${'running'}              | ${'ERROR'}           | ${'PIPELINE_RUNNING'}
        ${'skipped'}              | ${'ERROR'}           | ${'PIPELINE_SKIPPED'}
        ${'success'}              | ${'PARSING'}         | ${'PARSING'}
        ${'success'}              | ${'PARSED'}          | ${'COMPLETE'}
        ${'success'}              | ${'ERROR'}           | ${'PARSE_ERROR'}
      `(
        'returns "$scanResultsType" when pipeline status is "$pipelineStatus" and securty report status is "$securityReportStatus"',
        ({ pipelineStatus, securityReportStatus, scanResultsType }) => {
          const localBranchState: BranchState = {
            ...branchState,
            pipeline: {
              ...pipeline,
              status: pipelineStatus,
            },
            securityFindings: {
              ...securityReportComparer,
              status: securityReportStatus,
            },
          };

          expect(CurrentBranchDataProvider.getSecurityReportType(localBranchState)).toBe(
            scanResultsType,
          );
        },
      );

      it('returns "NO_SCANS_FOUND" when there is no associated merge request', () => {
        const localBranchState: BranchState = {
          ...branchState,
          mr: undefined,
          pipeline: undefined,
          securityFindings: undefined,
        };

        expect(CurrentBranchDataProvider.getSecurityReportType(localBranchState)).toBe(
          'NO_SCANS_FOUND',
        );
      });
    });
  });
});
