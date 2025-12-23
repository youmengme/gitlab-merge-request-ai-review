import * as vscode from 'vscode';
import { groupBy } from 'lodash';
import { ItemModel } from '../item_model';

import { GqlSecurityFinding } from '../../../gitlab/security_findings/api/get_security_finding_report';
import { ProjectInRepository } from '../../../gitlab/new_project';
import { SecurityFindingSeverityGroup } from './security_finding_severity_group_item';
import { Severity } from './severity_to_icon';
import { SecurityResultsType } from './constants';

export type SecurityFindingGroupType = 'ADDED' | 'FIXED';

export class SecurityFindingsGroupItem extends ItemModel {
  readonly #findings: GqlSecurityFinding[];

  readonly #securityFindingGroupType: SecurityFindingGroupType;

  readonly #projectInRepository: ProjectInRepository;

  readonly #status: SecurityResultsType;

  constructor(
    securityFindingGroupType: SecurityFindingGroupType,
    status: SecurityResultsType,
    findings: GqlSecurityFinding[],
    projectInRepository: ProjectInRepository,
  ) {
    super();
    this.#status = status;
    this.#findings = findings;
    this.#securityFindingGroupType = securityFindingGroupType;
    this.#projectInRepository = projectInRepository;
  }

  getTreeItem(): vscode.TreeItem {
    const label = this.#securityFindingGroupType === 'ADDED' ? 'New findings' : 'Fixed findings';
    const count = this.#findings.length;
    const item = new vscode.TreeItem(
      label,
      count ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );

    if (this.#status === 'COMPLETE') {
      item.description = String(count);
    }
    if (this.#status === 'PARSING' || this.#status === 'PIPELINE_RUNNING') {
      item.description = 'Results Pending...';
    }

    return item;
  }

  async getChildren(): Promise<ItemModel[]> {
    if (this.#status === 'COMPLETE') {
      const findingsBySeverity = groupBy(this.#findings, 'severity');

      return Object.entries(findingsBySeverity)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(
          ([severity, findings]) =>
            new SecurityFindingSeverityGroup(
              findings,
              severity as Severity,
              this.#projectInRepository,
            ),
        );
    }
    return [];
  }
}
