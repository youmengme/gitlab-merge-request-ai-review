const vocabulary = {
  '--editor-font-family': ['--vscode-font-family'],
  '--editor-font-size': ['--vscode-font-size'],

  '--editor-code-font-family': ['--vscode-editor-font-family'],
  '--editor-code-font-size': ['--vscode-editor-font-size'],
  '--editor-code-font-weight': ['--vscode-editor-font-weight'],

  '--editor-foreground': ['--vscode-foreground'],
  '--editor-foreground-muted': ['--vscode-disabledForeground'],
  '--editor-foreground-disabled': ['--vscode-disabledForeground'],
  '--editor-background': ['--vscode-editor-background'],
  '--editor-background-alternative': ['--vscode-sideBar-background'],

  '--editor-heading-foreground': ['--vscode-settings-headerForeground'],

  '--editor-border-color': ['--vscode-widget-border', '--vscode-editorWidget-border'],

  '--editor-alert-foreground': ['--vscode-sideBarTitle-foreground'],
  '--editor-alert-background': ['--vscode-sideBarSectionHeader-background'],
  '--editor-alert-border-color': ['--vscode-sideBarSectionHeader-border'],

  '--editor-token-foreground': ['--vscode-badge-foreground'],
  '--editor-token-background': ['--vscode-badge-background'],

  '--editor-icon-foreground': ['--vscode-icon-foreground'],

  '--editor-textLink-foreground': ['--vscode-textLink-foreground'],
  '--editor-textLink-foreground-active': ['--vscode-textLink-activeForeground'],
  '--editor-textPreformat-foreground': ['--vscode-textPreformat-foreground'],
  '--editor-textPreformat-background': ['--vscode-textCodeBlock-background'],

  '--editor-input-border': ['--vscode-input-border'],
  '--editor-input-background': ['--vscode-input-background'],
  '--editor-input-foreground': ['--vscode-input-foreground'],
  '--editor-input-placeholder-foreground': ['--vscode-input-placeholderForeground'],
  '--editor-input-border-focus': ['--vscode-focusBorder'],
  '--editor-input-background-focus': ['--vscode-sideBar-background'],
  '--editor-input-foreground-focus': ['--vscode-foreground'],

  '--editor-checkbox-background': ['--vscode-checkbox-background'],
  '--editor-checkbox-border': ['--vscode-checkbox-border'],
  '--editor-checkbox-background-selected': ['--vscode-checkbox-selectBackground'],
  '--editor-checkbox-border-selected': ['--vscode-checkbox-selectBorder'],

  '--editor-button-foreground': ['--vscode-button-foreground'],
  '--editor-button-background': ['--vscode-button-background'],
  '--editor-button-border': ['--vscode-button-border'],
  '--editor-button-background-hover': ['--vscode-button-hoverBackground'],

  '--editor-buttonSecondary-foreground': ['--vscode-button-secondaryForeground'],
  '--editor-buttonSecondary-background': ['--vscode-button-secondaryBackground'],
  '--editor-buttonSecondary-background-hover': ['--vscode-button-secondaryHoverBackground'],

  '--editor-textCodeBlock-background': ['--vscode-textCodeBlock-background'],
  '--editor-widget-shadow': ['--vscode-widget-shadow'],
  '--editor-error-foreground': ['--vscode-editorError-foreground'],

  '--editor-dropdown-background': ['--vscode-dropdown-background'],
  '--editor-dropdown-foreground': ['--vscode-dropdown-foreground'],
  '--editor-dropdown-border': ['--vscode-dropdown-border'],

  '--editor-list-activeSelection-background': ['--vscode-list-activeSelectionBackground'],
  '--editor-list-activeSelection-foreground': ['--vscode-list-activeSelectionForeground'],
  '--editor-selection-background': ['--vscode-editor-selectionBackground'],
  '--editor-selection-foreground': ['--vscode-editor-selectionForeground'],
};

export const adaptTheme = (theme: Record<string, string>) => {
  const result: Record<string, string> = {};
  for (const [newVar, themeVars] of Object.entries(vocabulary)) {
    // Find the first matching theme variable that exists
    const matchingThemeVar = themeVars.find(themeVar => theme[themeVar]);

    // If a matching variable is found, add it to the result
    if (matchingThemeVar) {
      result[newVar] = theme[matchingThemeVar];
    }
  }
  return result;
};
