import vscode from 'vscode';

export type VisibleState = string;

export interface StatePolicy {
  /** use `init` if the policy needs to run async logic to determine its initial state */
  init?: () => Promise<void>;
  /** is the policy active (i.e. will it change the state of code suggestions) */
  engaged: boolean;
  /** what should show when you hover over the status icon */
  state?: VisibleState;
  /** triggers an event every time the engaged attribute changes */
  onEngagedChange: vscode.Event<boolean>;

  dispose(): void;
}
