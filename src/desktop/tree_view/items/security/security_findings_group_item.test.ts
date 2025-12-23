import {
  securityFindingAdded,
  securityFindingFixed,
  projectInRepository,
} from '../../../test_utils/entities';
import { SecurityFindingsGroupItem } from './security_findings_group_item';

describe('SecurityFindingsGroupItem', () => {
  describe('tree item', () => {
    it.each`
      resultType            | groupType  | label               | description
      ${'PIPELINE_RUNNING'} | ${'ADDED'} | ${'New findings'}   | ${'Results Pending...'}
      ${'PARSING'}          | ${'ADDED'} | ${'New findings'}   | ${'Results Pending...'}
      ${'COMPLETE'}         | ${'ADDED'} | ${'New findings'}   | ${'6'}
      ${'PIPELINE_RUNNING'} | ${'FIXED'} | ${'Fixed findings'} | ${'Results Pending...'}
      ${'PARSING'}          | ${'FIXED'} | ${'Fixed findings'} | ${'Results Pending...'}
      ${'COMPLETE'}         | ${'FIXED'} | ${'Fixed findings'} | ${'6'}
    `(
      'with status "$resultType", with groupType "$groupType", with label "$label", with description "$description"',
      ({ resultType, groupType, label, description }) => {
        const item = new SecurityFindingsGroupItem(
          groupType,
          resultType,
          securityFindingAdded,
          projectInRepository,
        ).getTreeItem();

        expect(item.label).toBe(label);
        expect(item.description).toBe(description);
      },
    );
  });

  describe('getChildren()', () => {
    it.each([
      ['info', 1],
      ['low', 1],
      ['medium', 1],
      ['high', 1],
      ['critical', 1],
      ['unknown', 1],
    ])('renders %s severity dropdown', async (severity, count) => {
      const children = await new SecurityFindingsGroupItem(
        'FIXED',
        'COMPLETE',
        securityFindingFixed,
        projectInRepository,
      ).getChildren();

      const itemLabel = `${count} ${severity} severity`;
      const item = children
        .find(child => child.getTreeItem().label === itemLabel)
        ?.getTreeItem().label;
      expect(item).toBe(itemLabel);
    });
  });
});
