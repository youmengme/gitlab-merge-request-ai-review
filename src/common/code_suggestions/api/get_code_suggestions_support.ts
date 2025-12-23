import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../platform/web_ide';

export interface GqlCurrentUser {
  ide: {
    codeSuggestionsEnabled: boolean;
  };
}

const queryGetProject = gql`
  query getCodeSuggestionsSupport {
    currentUser {
      ide {
        codeSuggestionsEnabled
      }
    }
  }
`;

export function getCodeSuggestionsSupport(): GraphQLRequest<{ currentUser: GqlCurrentUser }> {
  return {
    type: 'graphql',
    query: queryGetProject,
    variables: {},
  };
}
