import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../platform/web_ide';

export interface GqlProjectWithDuoEnabledInfo {
  duoFeaturesEnabled: boolean;
}

const queryGetProject = gql`
  query GetProject($projectPath: ID!) {
    project(fullPath: $projectPath) {
      duoFeaturesEnabled
    }
  }
`;

export function getProjectCodeSuggestionsEnabled(
  projectPath: string,
): GraphQLRequest<{ project: GqlProjectWithDuoEnabledInfo }> {
  return {
    type: 'graphql',
    query: queryGetProject,
    variables: { projectPath },
  };
}
