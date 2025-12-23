export type SecurityResultsType =
  | 'NO_SCANS_FOUND'
  | 'COMPLETE'
  | 'PARSING'
  | 'PARSED'
  | 'ERROR'
  | 'PARSE_ERROR'
  | 'PIPELINE_RUNNING'
  | 'PIPELINE_PREPARING'
  | 'PIPELINE_CANCELED'
  | 'PIPELINE_PREPARING'
  | 'PIPELINE_WAITING_FOR_RESOURCE'
  | 'PIPELINE_WAITING_FOR_CALLBACK'
  | 'PIPELINE_SKIPPED'
  | 'PIPELINE_FAILED';

export const securityResultsLabels: Record<SecurityResultsType, string> = {
  PIPELINE_FAILED: 'Pipeline failed',
  PIPELINE_PREPARING: 'Preparing pipeline',
  PIPELINE_CANCELED: 'Pipeline canceled',
  PIPELINE_SKIPPED: 'Pipeline skipped',
  PIPELINE_WAITING_FOR_CALLBACK: 'Pipeline waiting for callback',
  PIPELINE_WAITING_FOR_RESOURCE: 'Pipeline waiting for resource',
  PIPELINE_RUNNING: 'Pipeline in progress',
  PARSING: 'Parsing in progress',
  PARSE_ERROR: 'Parsing error',
  COMPLETE: 'Complete',
  NO_SCANS_FOUND: 'No security scans found',
  PARSED: 'Parsing complete',
  ERROR: 'Error',
};
