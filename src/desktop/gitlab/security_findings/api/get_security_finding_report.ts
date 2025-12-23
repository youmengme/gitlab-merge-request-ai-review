import { gql } from 'graphql-request';
import { GitLabProject } from '../../../../common/platform/gitlab_project';
import { GraphQLRequest } from '../../../../common/platform/web_ide';
import { GqlVulnerbilitySeverity } from '../../graphql/get_security_finding';

export const reportTypes = [
  'SAST',
  'SECRET_DETECTION',
  'CONTAINER_SCANNING',
  'DEPENDENCY_SCANNING',
  'DAST',
  'COVERAGE_FUZZING',
  'API_FUZZING',
] as const;

export type SecurityReportType = (typeof reportTypes)[number];
export type SecurityReportStatus = 'PARSED' | 'PARSING' | 'ERROR';

export interface GqlSecurityFinding {
  uuid: string;
  title: string;
  description: string;
  severity: GqlVulnerbilitySeverity;
  foundByPipelineIid: string;
}

export interface GqlSecurityReport {
  baseReportCreatedAt: string;
  baseReportOutOfDate: string;
  headReportCreatedAt: string;
  added: GqlSecurityFinding[];
  fixed: GqlSecurityFinding[];
}

export interface GqlSecurityFindingReportComparer {
  status: SecurityReportStatus;
  statusReason?: string;
  report?: GqlSecurityReport;
}

export interface GetSecurityFindingsReportQuery {
  project: {
    mergeRequest: {
      findingReportsComparer: GqlSecurityFindingReportComparer;
    };
  };
}

export const querySecurityFindingReport = gql`
  query getMRSecurityReport(
    $fullPath: ID!
    $mergeRequestIid: String!
    $reportType: ComparableSecurityReportType!
  ) {
    project(fullPath: $fullPath) {
      mergeRequest(iid: $mergeRequestIid) {
        title
        findingReportsComparer(reportType: $reportType) {
          status
          statusReason
          report {
            headReportCreatedAt
            baseReportCreatedAt
            baseReportOutOfDate
            added {
              uuid
              title
              description
              severity
              foundByPipelineIid
            }
            fixed {
              uuid
              title
              description
              severity
              foundByPipelineIid
            }
          }
        }
      }
    }
  }
`;

export const getSecurityFindingsReport: (
  project: GitLabProject,
  mr: RestMr,
  reportType: SecurityReportType,
) => GraphQLRequest<GetSecurityFindingsReportQuery> = (project, mr, reportType) => ({
  type: 'graphql',
  query: querySecurityFindingReport,
  variables: {
    fullPath: project.namespaceWithPath,
    mergeRequestIid: mr.iid.toString(),
    reportType,
  },
});
