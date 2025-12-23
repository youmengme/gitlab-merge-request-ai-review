const REMOTE_SCAN_SAST_NAME = 'GitLab Remote Scan (SAST)';
export const createRemoteScanMessage = (details: unknown) => {
  return `${REMOTE_SCAN_SAST_NAME}: ${details}`;
};
