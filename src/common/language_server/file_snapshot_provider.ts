import * as vscode from 'vscode';
import { createInterfaceId } from '@gitlab/needle';
import { log } from '../log';

const getFileContent = async (uri: vscode.Uri): Promise<{ content: string; source: string }> => {
  const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());

  if (openDoc) {
    return { content: openDoc.getText(), source: 'open document' };
  }

  const content = await vscode.workspace.fs.readFile(uri);
  return { content: Buffer.from(content).toString('utf8'), source: 'file system' };
};

const toSnapshotUri = (fileUri: vscode.Uri): vscode.Uri => {
  const fileName = fileUri.path.split('/').pop() || 'untitled';
  const fileExtension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
  const fullPath = fileUri.path || fileName;

  // Remove the last instance of the extension from the file path
  const trimmedPath = fileExtension ? fullPath.substring(0, fullPath.lastIndexOf('.')) : fullPath;

  // Create URI for snapshot content with same file extension for syntax highlighting
  const snapshotFileName = `${trimmedPath}-snapshot${fileExtension}`;
  return vscode.Uri.parse(`${FileSnapshotProviderImpl.SCHEME}:${snapshotFileName}`);
};

interface Snapshot {
  usedTimes: number;
  content: string;
}

export interface FileSnapshotProvider extends vscode.TextDocumentContentProvider {
  takeSnapshot(fileUri: vscode.Uri): Promise<vscode.Disposable>;
  hasContent(fileUri: vscode.Uri): boolean;
  getContent(fileUri: vscode.Uri): string;
  snapshotUri(fileUri: vscode.Uri): vscode.Uri;
}

export const FileSnapshotProvider = createInterfaceId<FileSnapshotProvider>('FileSnapshotProvider');

export class FileSnapshotProviderImpl implements FileSnapshotProvider {
  static readonly SCHEME = 'gitlab-snapshot';

  #snapshots = new Map<string, Snapshot>();

  #snapshotPromises = new Map<string, Promise<void>>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.#snapshots.get(uri.toString())?.content || '';
  }

  /** records the content of the file or throws, it returns a Disposable which, when invoked, deletes the file content from the provider */
  async takeSnapshot(fileUri: vscode.Uri): Promise<vscode.Disposable> {
    const snapshotUriString = toSnapshotUri(fileUri).toString();
    const existingSnapshot = this.#snapshots.get(snapshotUriString);

    if (existingSnapshot) {
      this.#snapshots.set(snapshotUriString, {
        ...existingSnapshot,
        usedTimes: existingSnapshot.usedTimes + 1,
      });
      return { dispose: () => this.#disposeSnapshot(snapshotUriString) };
    }

    // We need to make sure that only one snapshot creation happens at the same time, we do that with map of Promises
    let creationPromise = this.#snapshotPromises.get(snapshotUriString);
    if (!creationPromise) {
      creationPromise = this.#createSnapshot(fileUri, snapshotUriString);
      this.#snapshotPromises.set(snapshotUriString, creationPromise);
    }

    await creationPromise;

    // Increment usage count after creation
    const snapshot = this.#snapshots.get(snapshotUriString);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotUriString} was not found after creation`);
    }

    this.#snapshots.set(snapshotUriString, {
      ...snapshot,
      usedTimes: snapshot.usedTimes + 1,
    });

    return { dispose: () => this.#disposeSnapshot(snapshotUriString) };
  }

  async #createSnapshot(fileUri: vscode.Uri, snapshotUriString: string): Promise<void> {
    const { content, source } = await getFileContent(fileUri);

    // the takeSnapshot function increments the usedTimes counter so we create it with 0 here
    this.#snapshots.set(snapshotUriString, { content, usedTimes: 0 });
    this.#snapshotPromises.delete(snapshotUriString);

    log.debug(`[FileSnapshotProvider] Captured snapshot from ${source}: ${fileUri.toString()}`);
  }

  #disposeSnapshot(stringUri: string) {
    const existingSnapshot = this.#snapshots.get(stringUri);
    if (!existingSnapshot) {
      log.warn(
        `[FileSnapshotProvider] Trying to dispose snapshot that no longer exists ${stringUri}. This points to a bug in the snapshot tracking logic. No user action is necessary.`,
      );
      return;
    }
    if (existingSnapshot.usedTimes <= 1) {
      log.debug(`[FileSnapshotProvider] Cleared snapshot for: ${stringUri}`);
      this.#snapshots.delete(stringUri);
      return;
    }

    this.#snapshots.set(stringUri, {
      ...existingSnapshot,
      usedTimes: existingSnapshot.usedTimes - 1,
    });
  }

  hasContent(fileUri: vscode.Uri): boolean {
    return this.#snapshots.has(toSnapshotUri(fileUri).toString());
  }

  getContent(fileUri: vscode.Uri): string {
    return this.#snapshots.get(toSnapshotUri(fileUri).toString())?.content || '';
  }

  snapshotUri = toSnapshotUri;
}
