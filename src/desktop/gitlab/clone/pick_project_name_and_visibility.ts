import * as vscode from 'vscode';
import { showQuickPick } from '../../utils/show_quickpick';
import { NamespacePickerItem } from './pick_namespace';

export interface NameAndVisibilityPickerItem extends vscode.QuickPickItem {
  projectConnection: 'SSH' | 'HTTPS';
  projectName: string;
  projectVisibility: ProjectVisibility;
}

function getVisibilityPickerItems(namespace: NamespacePickerItem, value: string) {
  if (!value) return [];

  const pickerItems: NameAndVisibilityPickerItem[] = [];

  const { visibilityLimit, fullPath } = namespace;
  const allVisibilities = ['private', 'internal', 'public'] as const;
  const visibilities = allVisibilities.slice(
    0,
    allVisibilities.indexOf(visibilityLimit ?? 'public') + 1,
  );

  visibilities.forEach(vis => {
    (['SSH', 'HTTPS'] as const).forEach(conn => {
      pickerItems.push({
        alwaysShow: true,
        label: `$(repo) Create ${vis} project (${conn})`,
        description: `$(gitlab-logo) ${fullPath}/${value}`,
        projectConnection: conn,
        projectName: value,
        projectVisibility: vis,
      });
    });
  });

  return pickerItems;
}

export async function pickProjectNameAndVisibility(
  namespace: NamespacePickerItem,
  uri: vscode.Uri,
) {
  const [initialName] = uri.path.split('/').reverse();

  const visibilityPicker = vscode.window.createQuickPick<NameAndVisibilityPickerItem>();
  visibilityPicker.placeholder = 'Project path';
  visibilityPicker.keepScrollPosition = true;
  visibilityPicker.value = initialName;
  visibilityPicker.matchOnDescription = true;
  visibilityPicker.items = getVisibilityPickerItems(namespace, visibilityPicker.value);

  // The currently selected item index should be preserved when the items change.
  let activeIndex = 0;
  let skipNextEvent = false;
  visibilityPicker.onDidChangeActive(a => {
    if (skipNextEvent) return;

    const [active] = a;
    const newIndex = visibilityPicker.items.indexOf(active);
    if (newIndex >= 0) {
      activeIndex = newIndex;
    } else {
      // None of the items contain the textbox query, which means the list
      // is still in the process of being updated. Ignore all incoming events
      // until the list has finished updating.
      skipNextEvent = true;
    }
  });
  visibilityPicker.onDidChangeValue(v => {
    visibilityPicker.items = getVisibilityPickerItems(namespace, v);
    visibilityPicker.activeItems = [visibilityPicker.items[activeIndex]];

    skipNextEvent = false;
  });

  return showQuickPick(visibilityPicker);
}
