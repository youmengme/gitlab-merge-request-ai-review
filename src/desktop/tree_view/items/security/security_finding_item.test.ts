import * as vscode from 'vscode';
import { securityFindingFixed, projectInRepository } from '../../../test_utils/entities';
import { SecurityFindingItem } from './security_finding_item';
import { severityToIcon, Severity } from './severity_to_icon';

const TEST_FINDING = securityFindingFixed[0];

describe('SecurityFindingItem', () => {
  it.each<Severity>(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'])(
    'renders %s severity',
    severity => {
      const item = new SecurityFindingItem(TEST_FINDING, severity, projectInRepository);

      expect(item.label).toBe(TEST_FINDING.title);
      expect(item.iconPath).toEqual(severityToIcon(severity));

      const command = item.command as vscode.Command;
      expect(command.command).toBe('gl.viewSecurityFinding');
      expect(command.arguments?.[0]).toEqual(TEST_FINDING);
    },
  );
});
