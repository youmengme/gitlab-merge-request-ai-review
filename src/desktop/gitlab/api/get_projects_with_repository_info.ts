import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../../common/platform/web_ide';

const fragmentProjectDetails = gql`
  fragment projectDetails on Project {
    id
    name
    description
    httpUrlToRepo
    sshUrlToRepo
    fullPath
    repository {
      rootRef
      empty
    }
  }
`;

export interface GqlProjectWithRepoInfo {
  id: string;
  name: string;
  description: string;
  httpUrlToRepo: string;
  sshUrlToRepo: string;
  fullPath: string;
  repository?: {
    rootRef: string;
    empty: boolean;
  };
}

const queryGetProjects = gql`
  ${fragmentProjectDetails}
  query GetProjectsWithRepositoryInfo(
    $search: String
    $membership: Boolean
    $limit: Int
    $searchNamespaces: Boolean
  ) {
    projects(
      search: $search
      membership: $membership
      first: $limit
      searchNamespaces: $searchNamespaces
    ) {
      nodes {
        ...projectDetails
      }
    }
  }
`;

const queryGetProject = gql`
  ${fragmentProjectDetails}
  query GetProjectWithRepositoryInfo($namespaceWithPath: ID!) {
    project(fullPath: $namespaceWithPath) {
      ...projectDetails
    }
  }
`;

export interface GetProjectsOptions {
  search?: string;
  membership: boolean;
  limit?: number;
  searchNamespaces?: boolean;
}

const SEARCH_LIMIT = 30;

const getProjectsDefaultOptions = {
  membership: true,
  limit: SEARCH_LIMIT,
  searchNamespaces: true,
};

export const getProjectsWithRepositoryInfo: (
  options: Partial<GetProjectsOptions>,
) => GraphQLRequest<{ projects: { nodes: GqlProjectWithRepoInfo[] } }> = options => ({
  type: 'graphql',
  query: queryGetProjects,
  variables: { ...getProjectsDefaultOptions, ...options },
});

export const getProjectWithRepositoryInfo: (
  namespaceWithPath: string,
) => GraphQLRequest<{ project?: GqlProjectWithRepoInfo }> = namespaceWithPath => ({
  type: 'graphql',
  query: queryGetProject,
  variables: { namespaceWithPath },
  resultPath: 'project',
});
