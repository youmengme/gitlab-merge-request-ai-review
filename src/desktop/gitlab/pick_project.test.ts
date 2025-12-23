import * as vscode from 'vscode';
import { showQuickPick } from '../utils/show_quickpick';
import { GitLabProject } from '../../common/platform/gitlab_project';
import { convertToGitLabProject } from '../../common/gitlab/api/get_project';
import { gqlProject } from '../../common/test_utils/entities';
import { createFakePartial } from '../../common/test_utils/create_fake_partial';
import { GraphQLRequest } from '../../common/platform/web_ide';
import { GitLabService } from './gitlab_service';
import { pickProject } from './pick_project';

jest.mock('../utils/show_quickpick');
jest.mock('./clone/gitlab_remote_source');

export const createProject = (namespaceWithPath: string) =>
  convertToGitLabProject({
    ...gqlProject,
    fullPath: namespaceWithPath,
    name: namespaceWithPath.replace('/', '-'),
  });

describe('pickProject', () => {
  const projects: GitLabProject[] = [
    createProject('a/b'),
    createProject('c/d'),
    createProject('e/f'),
  ];
  const gitLabService = createFakePartial<GitLabService>({
    fetchFromApi: jest.fn().mockImplementation(async <T>(r: GraphQLRequest<T>) => {
      if (r.variables.namespaceWithPath) {
        return {
          project: projects.find(p => p.namespaceWithPath === r.variables.namespaceWithPath),
        };
      }
      if (r.variables.search) {
        return {
          projects: {
            nodes: projects.filter(
              p => p.namespaceWithPath.indexOf(r.variables.search as string) >= 0,
            ),
          },
        };
      }
      return { projects: { nodes: projects } };
    }),
  });

  const alwaysPickOptionN = (n: number, v?: string) => {
    (showQuickPick as jest.Mock).mockImplementation(async picker => {
      // Wait for a moment for the list to be populated
      await new Promise(r => {
        setTimeout(r, 1);
      });
      // eslint-disable-next-line no-param-reassign
      if (v) picker.value = v;
      return picker.items[n];
    });
  };

  const alwaysInput = (answer: string | undefined) => {
    (vscode.window.showInputBox as jest.Mock).mockImplementation(() => answer);
  };

  beforeEach(() => {
    (vscode.window.createQuickPick as jest.Mock).mockImplementation(() => ({
      onDidChangeValue: jest.fn(),
      items: [],
    }));
  });

  it('returns undefined when the picker is canceled', async () => {
    alwaysPickOptionN(-1);
    const r = await pickProject(gitLabService);
    expect(r).toBeUndefined();
  });

  it('returns the selected item', async () => {
    alwaysPickOptionN(1);
    const r = await pickProject(gitLabService);
    expect(r).toStrictEqual(projects[0]);
  });

  describe('when other is selected', () => {
    beforeEach(() => alwaysPickOptionN(0));

    it('resolves the user-provided value', async () => {
      alwaysInput(projects[2].namespaceWithPath);
      const r = await pickProject(gitLabService);
      expect(r).toStrictEqual(projects[2]);
    });

    describe('when a value is provided', () => {
      beforeEach(() => alwaysPickOptionN(0, projects[2].name));

      it('does not show an input box', async () => {
        await pickProject(gitLabService);
        expect(vscode.window.showInputBox).toHaveBeenCalledTimes(0);
      });
    });

    describe('when no value is provided', () => {
      beforeEach(() => alwaysInput(undefined));

      it('shows an input box', async () => {
        await pickProject(gitLabService);
        expect(vscode.window.showInputBox).toHaveBeenCalledTimes(1);
      });

      it('returns undefined when the input box is canceled', async () => {
        const r = await pickProject(gitLabService);
        expect(vscode.window.showInputBox).toHaveBeenCalledTimes(1);
        expect(r).toStrictEqual(undefined);
      });
    });
  });
});
