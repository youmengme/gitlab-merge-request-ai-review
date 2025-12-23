export type Theme = {
  styles: Record<string, string>;
};

export interface WebviewThemePublisher {
  publishWebviewTheme(theme: { styles: Record<string, string> }): Promise<void>;
  setDuoWorkflowInitialState(initialState: Record<string, unknown>): Promise<void>;
}
