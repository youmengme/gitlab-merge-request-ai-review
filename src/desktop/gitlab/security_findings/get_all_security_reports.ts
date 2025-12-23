import { GitLabProject } from '../../../common/platform/gitlab_project';
import { GitLabService } from '../gitlab_service';
import { log } from '../../../common/log';
import { REQUIRED_VERSIONS } from '../../constants';
import {
  GqlSecurityFindingReportComparer,
  getSecurityFindingsReport,
  GetSecurityFindingsReportQuery,
  reportTypes,
} from './api/get_security_finding_report';

/**
 * Merges added and fixed findings from from the two reports.
 * Only `added` and `fixed` properties are merged, other values are used from the `target` report.
 */
const mergeReports = (
  target: GqlSecurityFindingReportComparer,
  source: GqlSecurityFindingReportComparer,
): GqlSecurityFindingReportComparer => {
  if (target?.report && source?.report) {
    return {
      ...target,
      report: {
        ...target.report,
        fixed: [...target.report.fixed, ...source.report.fixed],
        added: [...target.report.added, ...source.report.added],
      },
    };
  }

  return {
    status: 'ERROR',
  };
};

const findingsReport = (
  reports: GetSecurityFindingsReportQuery[],
): GqlSecurityFindingReportComparer[] =>
  reports?.map(r => r?.project.mergeRequest.findingReportsComparer);

const validFindingReports = (
  reports: GetSecurityFindingsReportQuery[],
): GqlSecurityFindingReportComparer[] => findingsReport(reports).filter(r => !hasEmptyReport(r));

const hasEmptyReport = (report: GqlSecurityFindingReportComparer): boolean =>
  report.status === 'ERROR' &&
  Boolean(report.statusReason?.match(/This merge request does not have .* reports/));

const hasParsingReport = (report: GqlSecurityFindingReportComparer): boolean =>
  report.status === 'PARSING';

const hasParsingReports = (reports: GetSecurityFindingsReportQuery[]): boolean =>
  findingsReport(reports).some(r => hasParsingReport(r));

export const getAllSecurityReports = async (
  gitlabService: GitLabService,
  project: GitLabProject,
  mr: RestMr,
): Promise<GqlSecurityFindingReportComparer | undefined> => {
  try {
    await gitlabService.validateVersion(
      'Security Findings',
      REQUIRED_VERSIONS.SECURITY_FINDINGS,
      true,
    );
  } catch (e) {
    log.warn(e);
    return undefined;
  }

  try {
    // We cannot batch queries at the moment, and we can't pass in multiple report types in one query
    const reports = await Promise.all(
      reportTypes.map(t => gitlabService.fetchFromApi(getSecurityFindingsReport(project, mr, t))),
    );

    // Filter out empty reports
    const findings = validFindingReports(reports);

    // Return if any reports currently parsing
    if (hasParsingReports(reports)) return { status: 'PARSING' };

    // Return if no successful reports found
    if (!findings?.length) return undefined;

    // Merge successful reports, return initial value if only one report exists
    return findings.reduce((acc, report) => mergeReports(acc, report));
  } catch (e) {
    log.error('Unable to merge security findings reports.', e);
    return { status: 'ERROR' };
  }
};
