import { gql } from 'graphql-request';
import { GitLabProject } from '../../../../common/platform/gitlab_project';
import { GraphQLRequest } from '../../../../common/platform/web_ide';

export type GqlSecurityFinding = {
  project: {
    id: string;
    pipeline: {
      id: string;
      securityReportFinding: {
        id: string;
        title: string;
        description: string;
        severity: string;
      };
    };
  };
};

export type GqlsecurityReportFinding =
  GqlSecurityFinding['project']['pipeline']['securityReportFinding'];

export const querySecurityFinding = gql`
  query pipelineFinding($fullPath: ID!, $pipelineId: ID!, $findingUuid: String!) {
    project(fullPath: $fullPath) {
      id
      pipeline(iid: $pipelineId) {
        id
        name
        securityReportFinding(uuid: $findingUuid) {
          title
          description
          descriptionHtml
          severity
          scanner {
            name
          }
          reportType
          location {
            ... on VulnerabilityLocationContainerScanning {
              image
              operatingSystem
            }
            ... on VulnerabilityLocationSast {
              startLine
              endLine
              file
              blobPath
            }
            ... on VulnerabilityLocationDependencyScanning {
              blobPath
              file
            }
            ... on VulnerabilityLocationSecretDetection {
              startLine
              endLine
              file
              blobPath
            }
            ... on VulnerabilityLocationCoverageFuzzing {
              startLine
              endLine
              file
              blobPath
              crashAddress
              crashType
              stacktraceSnippet
              vulnerableMethod
              vulnerableClass
            }
            ... on VulnerabilityLocationDast {
              hostname
              path
            }
          }
          identifiers {
            name
            url
          }
          solution
        }
      }
    }
  }
`;

export const getSecurityFinding: (
  project: GitLabProject,
  pipelineId: string,
  findingUuid: string,
) => GraphQLRequest<GqlSecurityFinding> = (project, pipelineId, findingUuid) => ({
  type: 'graphql',
  query: querySecurityFinding,
  variables: {
    fullPath: project.namespaceWithPath,
    pipelineId,
    findingUuid,
  },
});
