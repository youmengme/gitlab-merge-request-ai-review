import assert from 'assert';
import * as vscode from 'vscode';
import { getProjectRepository } from '../gitlab/gitlab_project_repository';
import { getFileContent, getFileSize } from '../git/get_file_content';
import { ReadOnlyFileSystem } from '../remotefs/readonly_file_system';
import { getGitLabService } from '../gitlab/get_gitlab_service';
import { log } from '../../common/log';
import { ProjectInRepository } from '../gitlab/new_project';
import { fromReviewUri, ReviewParams, isEmptyFileUri } from './review_uri';

type RegisterOptions = Parameters<typeof vscode.workspace.registerFileSystemProvider>[2];

export class ReviewFileSystem extends ReadOnlyFileSystem {
  static OPTIONS: RegisterOptions = {
    isReadonly: true,
    isCaseSensitive: true,
  };

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    let size: number;

    const params = fromReviewUri(uri);
    if (isEmptyFileUri(uri)) {
      size = 0;
    } else {
      const projectInRepository = getProjectRepository().getProjectOrFail(params.repositoryRoot);

      const localSize = await this.#sizeLocal(projectInRepository, params);

      size = localSize ?? (await this.#sizeRemote(projectInRepository, params));
    }
    return {
      type: vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size,
    };
  }

  async #sizeLocal(
    projectInRepository: ProjectInRepository,
    params: ReviewParams,
  ): Promise<number | null> {
    assert(params.commit);
    return getFileSize(
      projectInRepository.pointer.repository.rawRepository,
      params.path,
      params.commit,
    );
  }

  async #sizeRemote(
    projectInRepository: ProjectInRepository,
    params: ReviewParams,
  ): Promise<number> {
    assert(params.commit);
    const service = getGitLabService(projectInRepository);

    const remote = await service.getFile(params.path, params.commit, params.projectId);

    return remote.size;
  }

  readDirectory(
    uri: vscode.Uri,
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const params = fromReviewUri(uri);
    if (isEmptyFileUri(uri)) return new Uint8Array();

    return (await this.#readFileLocal(params)) || this.#readFileRemote(params);
  }

  async #readFileLocal(params: ReviewParams): Promise<Uint8Array | null> {
    assert(params.commit);
    const projectInRepository = getProjectRepository().getProjectOrFail(params.repositoryRoot);
    const result = await getFileContent(
      projectInRepository.pointer.repository.rawRepository,
      params.path,
      params.commit,
    );
    return result;
  }

  async #readFileRemote(params: ReviewParams) {
    assert(params.commit);

    const projectInRepository = getProjectRepository().getProjectOrFail(params.repositoryRoot);
    const service = getGitLabService(projectInRepository);
    try {
      const content = await service.getFileContent(params.path, params.commit, params.projectId);
      return Buffer.from(content);
    } catch (e) {
      log.error(e);
      throw e;
    }
  }
}
