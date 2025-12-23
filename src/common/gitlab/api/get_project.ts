import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../platform/web_ide';
import { GitLabProject } from '../../platform/gitlab_project';
import { getRestIdFromGraphQLId } from './get_rest_id_from_graphql_id';

interface GqlGroup {
  id: string;
}

export interface GqlProject {
  id: string;
  name: string;
  description: string;
  fullPath: string;
  webUrl: string;
  // The group might not be present, for example for personal projects
  group?: GqlGroup;
}

const fragmentProjectDetails = gql`
  fragment projectDetails on Project {
    id
    name
    description
    fullPath
    webUrl
    group {
      id
    }
  }
`;
const queryGetProject = gql`
  ${fragmentProjectDetails}
  query GetProject($namespaceWithPath: ID!) {
    project(fullPath: $namespaceWithPath) {
      ...projectDetails
    }
  }
`;

export const getProject: (
  namespaceWithPath: string,
) => GraphQLRequest<{ project?: GqlProject }> = namespaceWithPath => ({
  type: 'graphql',
  query: queryGetProject,
  variables: { namespaceWithPath },
});

export const convertToGitLabProject: (gqlProject: GqlProject) => GitLabProject = gqlProject => ({
  ...gqlProject,
  gqlId: gqlProject.id,
  namespaceWithPath: gqlProject.fullPath,
  restId: getRestIdFromGraphQLId(gqlProject.id),
  groupRestId: gqlProject.group && getRestIdFromGraphQLId(gqlProject.group.id),
});
