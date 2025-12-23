import * as vscode from 'vscode';
import { log } from '../log';
import { DiagnosticsService } from './diagnostics_service';

export const DIAGNOSTICS_URI = vscode.Uri.parse('gitlab-diagnostics:/GitLab Diagnostics.md');

export class DiagnosticsDocumentProvider implements vscode.TextDocumentContentProvider {
  #eventEmitter = new vscode.EventEmitter<vscode.Uri>();

  onDidChange = this.#eventEmitter.event;

  #service: DiagnosticsService;

  constructor(service: DiagnosticsService) {
    this.#service = service;
    this.#service.onChange(() => this.#eventEmitter.fire(DIAGNOSTICS_URI));
  }

  // Note: The reason this is checked is to ensure that the file tab is correctly labeled
  // and that a .md file is used to render markdown properly.
  #validateURI(uri: vscode.Uri): void {
    if (uri.toString() !== DIAGNOSTICS_URI.toString()) {
      // Note: Diagnostics can still return without a URI match, but the text
      // might not render as markdown
      log.warn(`Invalid URI: Expected ${DIAGNOSTICS_URI}, but got ${uri}`);
    }
  }

  provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
    this.#validateURI(uri);

    try {
      return this.#generateDiagnosticsContent();
    } catch (e) {
      log.error('Failed to render diagnostics', e);
      return `Error when rendering diagnostics: ${e.message}`;
    }
  }

  #generateDiagnosticsContent(): string {
    const documentTitle = '# GitLab Workflow Diagnostics';
    const formattedSections = this.#service
      .getSections()
      .map(section => `## ${section.title}\n\n${section.content}`)
      .join('\n\n');

    return `${documentTitle}\n\n${formattedSections}`;
  }
}
