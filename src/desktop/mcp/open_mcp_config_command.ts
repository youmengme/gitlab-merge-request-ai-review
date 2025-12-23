import { openMcpUserConfigFile } from './utils/mcp_config';
import { openMcpWorkspaceConfigFile } from './utils/mcp_workspace_config';

export const openMcpUserConfigCommand = () => openMcpUserConfigFile();

export const openMcpWorkspaceConfigCommand = () => openMcpWorkspaceConfigFile();
