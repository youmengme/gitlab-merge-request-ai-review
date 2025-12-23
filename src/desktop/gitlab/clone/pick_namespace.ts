import * as vscode from 'vscode';
import { getNamespacesWhereUserCanCreateProjects } from '../api/get_namespaces_where_user_can_create_projects';
import { GitLabService } from '../gitlab_service';
import { pickWithQuery } from '../../utils/pick_with_query';

export interface NamespacePickerItem extends vscode.QuickPickItem {
  fullPath: string;
  isGroup: boolean;
  visibilityLimit?: ProjectVisibility;
}
type NamespacePickerItemType = NamespacePickerItem | vscode.QuickPickItem;

async function getNamespacePickerItems(api: GitLabService, query?: string) {
  const namespaces = await api.fetchFromApi(getNamespacesWhereUserCanCreateProjects(query ?? ''));

  const pickerItems: NamespacePickerItemType[] = [
    { label: 'Groups', kind: vscode.QuickPickItemKind.Separator },
  ];
  pickerItems.push(
    ...namespaces.currentUser.groups.nodes.map(n => ({
      label: n.fullPath,
      isGroup: true,
      fullPath: n.fullPath,
      visibilityLimit: n.visibility,
    })),
  );

  pickerItems.push({ label: 'Users', kind: vscode.QuickPickItemKind.Separator });
  pickerItems.push({
    label: namespaces.currentUser.namespace.fullPath,
    fullPath: namespaces.currentUser.namespace.fullPath,
  });
  return pickerItems;
}

export async function pickNamespace(api: GitLabService): Promise<NamespacePickerItem | undefined> {
  const { picked } = await pickWithQuery(
    {
      placeholder: 'Select a namespace',
    },
    query => getNamespacePickerItems(api, query),
  );
  return picked as NamespacePickerItem;
}
