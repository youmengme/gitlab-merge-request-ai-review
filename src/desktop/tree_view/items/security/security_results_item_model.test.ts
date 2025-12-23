import { securityReportComparer, projectInRepository } from '../../../test_utils/entities';
import {
  GqlSecurityFinding,
  GqlSecurityFindingReportComparer,
} from '../../../gitlab/security_findings/api/get_security_finding_report';
import { SecurityResultsItemModel } from './security_results_item_model';

describe('SecurityResultsItemModel', () => {
  describe('tree item', () => {
    it.each`
      resultType                         | label                        | description                        | iconPath
      ${'NO_SCANS_FOUND'}                | ${'No security scans found'} | ${undefined}                       | ${undefined}
      ${'PIPELINE_FAILED'}               | ${'Security scanning'}       | ${'Pipeline failed'}               | ${{ id: 'shield' }}
      ${'PIPELINE_CANCELED'}             | ${'Security scanning'}       | ${'Pipeline canceled'}             | ${{ id: 'shield' }}
      ${'PIPELINE_SKIPPED'}              | ${'Security scanning'}       | ${'Pipeline skipped'}              | ${{ id: 'shield' }}
      ${'PIPELINE_WAITING_FOR_CALLBACK'} | ${'Security scanning'}       | ${'Pipeline waiting for callback'} | ${{ id: 'shield' }}
      ${'PIPELINE_WAITING_FOR_RESOURCE'} | ${'Security scanning'}       | ${'Pipeline waiting for resource'} | ${{ id: 'shield' }}
      ${'PIPELINE_RUNNING'}              | ${'Security scanning'}       | ${'Pipeline in progress'}          | ${{ id: 'shield' }}
      ${'PARSING'}                       | ${'Security scanning'}       | ${'Parsing in progress'}           | ${{ id: 'shield' }}
      ${'PARSE_ERROR'}                   | ${'Security scanning'}       | ${'Parsing error'}                 | ${{ id: 'shield' }}
      ${'COMPLETE'}                      | ${'Security scanning'}       | ${'Complete'}                      | ${{ id: 'shield' }}
    `(
      'has status "$resultType", with label "$label", with description "$description", with $iconPath icon',
      ({ resultType, label, description, iconPath }) => {
        const item = new SecurityResultsItemModel(
          projectInRepository,
          resultType,
          securityReportComparer,
        ).getTreeItem();
        expect(item.label).toBe(label);
        expect(item.description).toBe(description);
        expect(item.iconPath).toEqual(iconPath);
      },
    );
  });

  describe('children', () => {
    it.each`
      resultType                         | childrenCount
      ${'NO_SCANS_FOUND'}                | ${0}
      ${'PIPELINE_FAILED'}               | ${0}
      ${'PIPELINE_CANCELED'}             | ${0}
      ${'PIPELINE_SKIPPED'}              | ${0}
      ${'PIPELINE_WAITING_FOR_CALLBACK'} | ${0}
      ${'PIPELINE_WAITING_FOR_RESOURCE'} | ${0}
      ${'PIPELINE_RUNNING'}              | ${2}
      ${'PARSING'}                       | ${2}
      ${'PARSE_ERROR'}                   | ${0}
      ${'COMPLETE'}                      | ${2}
    `(
      'has status "$resultType", with $childrenCount children',
      async ({ resultType, childrenCount }) => {
        const children = await new SecurityResultsItemModel(
          projectInRepository,
          resultType,
          securityReportComparer,
        ).getChildren();
        expect(children).toHaveLength(childrenCount);
      },
    );

    it('renders added and fixed dropdowns', async () => {
      const children = await new SecurityResultsItemModel(
        projectInRepository,
        'COMPLETE',
        securityReportComparer,
      ).getChildren();
      expect(children).toHaveLength(2);
      expect(children.map(x => x.getTreeItem().label)).toEqual(['New findings', 'Fixed findings']);
    });

    it('renders added and fixed dropdowns when no vulnerability present', async () => {
      const children = await new SecurityResultsItemModel(projectInRepository, 'COMPLETE', <
        GqlSecurityFindingReportComparer
      >{
        ...securityReportComparer,
        report: {
          ...securityReportComparer.report,
          fixed: <GqlSecurityFinding[]>[],
          added: <GqlSecurityFinding[]>[],
        },
      }).getChildren();
      expect(children).toHaveLength(2);
      expect(children.map(x => x.getTreeItem().label)).toEqual(['New findings', 'Fixed findings']);
      expect(children.map(x => x.getTreeItem().description)).toEqual(['0', '0']);
    });
  });
});
