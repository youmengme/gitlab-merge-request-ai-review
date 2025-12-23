import { gql } from 'graphql-request';

const positionFragment = gql`
  fragment position on Note {
    position {
      diffRefs {
        baseSha
        headSha
        startSha
      }
      filePath
      positionType
      newLine
      oldLine
      newPath
      oldPath
      positionType
    }
  }
`;

export const noteDetailsFragment = gql`
  ${positionFragment}
  fragment noteDetails on Note {
    id
    createdAt
    system
    author {
      avatarUrl
      name
      username
      webUrl
    }
    body
    bodyHtml
    url
    userPermissions {
      resolveNote
      adminNote
      createNote
    }
    ...position
  }
`;

export const discussionDetailsFragment = gql`
  ${noteDetailsFragment}
  fragment discussionDetails on Discussion {
    replyId
    createdAt
    resolved
    resolvable
    notes {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...noteDetails
      }
    }
  }
`;

export interface GqlProjectResult<T> {
  project?: T;
}

export interface Node<T> {
  pageInfo?: {
    hasNextPage: boolean;
    endCursor: string;
  };
  nodes: T[];
}

interface GqlUser {
  avatarUrl: string | null;
  name: string;
  username: string;
  webUrl: string;
}

export interface GqlBasePosition {
  diffRefs: {
    baseSha: string;
    headSha: string;
    startSha: string;
  };
  filePath: string;
  newPath: string;
  oldPath: string;
}

interface GqlImagePosition extends GqlBasePosition {
  positionType: 'image';
  newLine: null;
  oldLine: null;
}

interface GqlNewPosition extends GqlBasePosition {
  positionType: 'text';
  newLine: number;
  oldLine: null;
}
interface GqlOldPosition extends GqlBasePosition {
  positionType: 'text';
  newLine: null;
  oldLine: number;
}

export type GqlTextPosition = GqlOldPosition | GqlNewPosition;

interface GqlNotePermissions {
  resolveNote: boolean;
  adminNote: boolean;
  createNote: boolean;
}

export interface GqlGenericNote<T extends GqlBasePosition | null> {
  id: string;
  author: GqlUser;
  createdAt: string;
  system: boolean;
  body: string; // TODO: remove this once the SystemNote.vue doesn't require plain text body
  bodyHtml: string;
  url: string;
  userPermissions: GqlNotePermissions;
  position: T;
}

export type GqlTextDiffNote = GqlGenericNote<GqlTextPosition>;
export type GqlImageNote = GqlGenericNote<GqlImagePosition>;
export type GqlOverviewNote = GqlGenericNote<null>;
export type GqlNote = GqlTextDiffNote | GqlImageNote | GqlOverviewNote;
