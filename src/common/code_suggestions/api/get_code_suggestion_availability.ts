import { gql } from 'graphql-request';
import { GraphQLRequest } from '../../platform/web_ide';

export interface GqlCodeSuggestionsAvailable {
  currentUser: {
    duoCodeSuggestionsAvailable: boolean;
  };
}

const querySuggestionsAvailable = gql`
  query suggestionsAvailable {
    currentUser {
      duoCodeSuggestionsAvailable
    }
  }
`;

export function getSuggestionsAvailability(): GraphQLRequest<GqlCodeSuggestionsAvailable> {
  return {
    type: 'graphql',
    query: querySuggestionsAvailable,
    variables: {},
  };
}
