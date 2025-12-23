import * as vscode from 'vscode';
import { SYNCED_COMMENT_CONTEXT } from '../constants';
import { GqlTextDiffNote } from '../gitlab/graphql/shared';
import type { GitLabCommentThread } from './gitlab_comment_thread';

interface CommentOptions {
  mode?: vscode.CommentMode;
  body?: string | vscode.MarkdownString;
  note?: GqlTextDiffNote;
}

const renderSuggestions = (body: string, noteUrl: string): string =>
  body.replace(
    /```suggestion:-\d+\+\d+\n((?:\n|.)*?)\n```/g,
    (_, p1) =>
      `---\n\nSuggestion:\n\n\`\`\`diff\n+ ${p1.replace(
        /\n/,
        '\n+ ',
      )}\n\`\`\`\n\n*[open suggestion on the web](${noteUrl})*\n\n---\n\n`,
  );

export class GitLabComment implements vscode.Comment {
  gqlNote: GqlTextDiffNote;

  readonly thread: GitLabCommentThread;

  mode: vscode.CommentMode;

  body: string | vscode.MarkdownString;

  protected constructor(
    gqlNote: GqlTextDiffNote,
    mode: vscode.CommentMode,
    thread: GitLabCommentThread,
    body: string | vscode.MarkdownString,
  ) {
    this.gqlNote = gqlNote;
    this.mode = mode;
    this.thread = thread;
    this.body = body;
  }

  get id(): string {
    return this.gqlNote.id;
  }

  get contextValue(): string | undefined {
    return `${SYNCED_COMMENT_CONTEXT}${
      this.gqlNote.userPermissions.adminNote ? ';canAdmin' : undefined
    }`;
  }

  get author(): vscode.CommentAuthorInformation {
    const { name, avatarUrl } = this.gqlNote.author;
    return {
      name,
      iconPath: avatarUrl !== null ? vscode.Uri.parse(avatarUrl) : undefined,
    };
  }

  renderBody(): GitLabComment {
    return this.#editInPlaceAndReturn({
      body: new vscode.MarkdownString(renderSuggestions(this.gqlNote.body, this.gqlNote.url)),
    });
  }

  setOriginalBody(): GitLabComment {
    return this.#editInPlaceAndReturn({ body: this.gqlNote.body });
  }

  getBodyAsText(): string {
    if (this.body instanceof vscode.MarkdownString) return this.body.value;
    return this.body;
  }

  markBodyAsSubmitted(): GitLabComment {
    return this.#editInPlaceAndReturn({
      note: {
        ...this.gqlNote,
        body: this.getBodyAsText(), // this synchronizes the API response with the latest body
      },
    }).renderBody();
  }

  withMode(mode: vscode.CommentMode): GitLabComment {
    return this.#editInPlaceAndReturn({ mode });
  }

  #editInPlaceAndReturn({ mode, body, note }: CommentOptions) {
    this.gqlNote = note ?? this.gqlNote;
    this.mode = mode ?? this.mode;
    this.body = body ?? this.body;
    return this;
  }

  static fromGqlNote(gqlNote: GqlTextDiffNote, thread: GitLabCommentThread): GitLabComment {
    return new GitLabComment(
      gqlNote,
      vscode.CommentMode.Preview,
      thread,
      gqlNote.body,
    ).renderBody();
  }
}
