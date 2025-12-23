import { ThemeIcon } from 'vscode';

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export const SEVERITY_ICON_MAP: Record<Severity, string> = {
  INFO: 'issues',
  LOW: 'circle-filled',
  MEDIUM: 'triangle-down',
  HIGH: 'debug-breakpoint-log-unverified',
  CRITICAL: 'debug-breakpoint-data',
  UNKNOWN: 'question',
};

export function severityToIcon(severity: Severity): ThemeIcon {
  return new ThemeIcon(SEVERITY_ICON_MAP[severity]);
}
