import * as vscode from 'vscode';
import { ItemModel } from '../item_model';

import { GqlSecurityFindingReportComparer } from '../../../gitlab/security_findings/api/get_security_finding_report';
import { ProjectInRepository } from '../../../gitlab/new_project';
import { SecurityFindingsGroupItem } from './security_findings_group_item';
import { SecurityResultsType, securityResultsLabels } from './constants';

export class SecurityResultsItemModel extends ItemModel {
  readonly #securityReportComparer?: GqlSecurityFindingReportComparer;

  readonly #securityResultsType: SecurityResultsType;

  readonly #projectInRepository: ProjectInRepository;

  constructor(
    projectInRepository: ProjectInRepository,
    securityResultsType: SecurityResultsType,
    securityReportComparer?: GqlSecurityFindingReportComparer,
  ) {
    super();
    this.#securityReportComparer = securityReportComparer;
    this.#securityResultsType = securityResultsType;
    this.#projectInRepository = projectInRepository;
  }

  isCollapsible(): boolean {
    return Boolean(
      this.#securityReportComparer &&
        (this.#securityResultsType === 'COMPLETE' ||
          this.#securityResultsType === 'PARSING' ||
          this.#securityResultsType === 'PIPELINE_RUNNING'),
    );
  }

  getTreeItem(): vscode.TreeItem {
    if (this.#securityResultsType === 'NO_SCANS_FOUND') {
      return new vscode.TreeItem(securityResultsLabels.NO_SCANS_FOUND);
    }

    const item = new vscode.TreeItem(
      'Security scanning',
      this.isCollapsible()
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    );
    item.description = securityResultsLabels[this.#securityResultsType];
    item.iconPath = new vscode.ThemeIcon('shield');
    return item;
  }

  async getChildren(): Promise<ItemModel[]> {
    const securityFindingGroups: ItemModel[] = [];

    if (this.#securityReportComparer && this.isCollapsible()) {
      const status = this.#securityResultsType;

      securityFindingGroups.push(
        new SecurityFindingsGroupItem(
          'ADDED',
          status,
          this.#securityReportComparer.report?.added || [],
          this.#projectInRepository,
        ),
      );
      securityFindingGroups.push(
        new SecurityFindingsGroupItem(
          'FIXED',
          status,
          this.#securityReportComparer.report?.fixed || [],
          this.#projectInRepository,
        ),
      );
    }

    return securityFindingGroups;
  }
}
