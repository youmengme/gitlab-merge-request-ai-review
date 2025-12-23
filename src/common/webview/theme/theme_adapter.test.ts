import { adaptTheme } from './theme_adapter';

describe('adaptTheme', () => {
  test('maps single vocabulary entries to theme values correctly', () => {
    const testTheme = {
      '--vscode-font-family': 'Arial',
      '--vscode-editor-font-family': 'Monaco',
    };

    const result = adaptTheme(testTheme);

    expect(result['--editor-font-family']).toBe('Arial');
    expect(result['--editor-code-font-family']).toBe('Monaco');
  });

  test('uses first available theme variable when multiple options exist', () => {
    const testTheme = {
      '--vscode-editorWidget-border': '#123456',
      '--vscode-widget-border': '#abcdef',
    };

    const result = adaptTheme(testTheme);

    // Should use the first available option from vocabulary
    expect(result['--editor-border-color']).toBe('#abcdef');
  });

  test('skips vocabulary entries when no matching theme variables exist', () => {
    const testTheme = {
      '--vscode-font-family': 'Arial',
    };

    const result = adaptTheme(testTheme);

    expect(result['--editor-button-foreground']).toBeUndefined();
    expect(result).not.toHaveProperty('--editor-button-foreground');
  });

  test('returns empty object when theme is empty', () => {
    const result = adaptTheme({});

    expect(result).toEqual({});
  });

  test('correctly handles complex CSS values', () => {
    const testTheme = {
      '--vscode-font-family': '-apple-system, BlinkMacSystemFont, sans-serif',
      '--vscode-foreground': 'rgba(204, 204, 204, 0.5)',
      '--vscode-editor-background': 'linear-gradient(to right, #000, #fff)',
      '--vscode-sideBar-background': 'Red',
    };

    const result = adaptTheme(testTheme);

    expect(result['--editor-font-family']).toBe('-apple-system, BlinkMacSystemFont, sans-serif');
    expect(result['--editor-foreground']).toBe('rgba(204, 204, 204, 0.5)');
    expect(result['--editor-background']).toBe('linear-gradient(to right, #000, #fff)');
    expect(result['--editor-background-alternative']).toBe('Red');
  });

  test('preserves exact value types from theme', () => {
    const testTheme = {
      '--vscode-font-family': 'Arial',
      '--vscode-foreground': '#FF0000',
      '--vscode-opacity': '0.5',
    };

    const result = adaptTheme(testTheme);

    expect(typeof result['--editor-font-family']).toBe('string');
    expect(result['--editor-font-family']).toStrictEqual('Arial');
  });
});
