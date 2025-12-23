import { X509Certificate } from 'node:crypto';
import * as vscode from 'vscode';
import { log } from '../../../common/log';
import { getHttpAgentOptions } from './get_http_agent_options';

interface httpNetworkConfiguration {
  proxy: string;
  proxySupport: string;
  proxyAuthorization: string | null;
  proxyStrictSSL: boolean;
  noProxy: string[];
  electronFetch: boolean;
  fetchAdditionalSupport: boolean;
}

interface gitlabNetworkConfiguration {
  ignoreCertificateErrors: boolean;
  ca: string;
  cert: string;
  certKey: string;
}

interface NetworkConfiguration {
  http: Partial<httpNetworkConfiguration>;
  gitlab: Partial<gitlabNetworkConfiguration>;
}

async function calculateSHA256Fingerprint(data: Buffer, propertyName: string): Promise<string> {
  try {
    // Assume a X509Certificate format
    // Based on https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions
    const cert = new X509Certificate(data);

    return cert.fingerprint256;
  } catch (e) {
    log.debug(
      `[LogNetworkConfig] Error calculating SHA 256 Fingerprint for: gitlab.${propertyName}`,
    );
    return '';
  }
}

// Safely mask password from proxy URL for logging
function maskProxyPassword(proxyUrl: string): string {
  try {
    const url = new URL(proxyUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    // If URL parsing fails, return the original (might not be a URL)
    return proxyUrl;
  }
}

async function getNetworkConfiguration(): Promise<NetworkConfiguration> {
  const httpConfig = vscode.workspace.getConfiguration('http');

  const currentHttpNetworkConfiguration: Partial<httpNetworkConfiguration> = {};
  const currentGitLabConfiguration: Partial<gitlabNetworkConfiguration> = {};

  const httpSettingsToCheck = [
    'proxy',
    'proxySupport',
    'proxyAuthorization',
    'proxyStrictSSL',
    'noProxy',
    'electronFetch',
    'fetchAdditionalSupport',
    'experimental.systemCertificatesV2',
  ];

  // Add VS Code http config options
  (httpSettingsToCheck as Array<keyof httpNetworkConfiguration>).forEach(key => {
    try {
      const value = httpConfig.get(key);
      (currentHttpNetworkConfiguration[key] as unknown) = value;
    } catch (e) {
      log.debug(`[LogNetworkConfig] Error getting value for http config: ${key}`);
    }
  });

  // Ensure that the password is removed from the proxy url if present
  if (currentHttpNetworkConfiguration.proxy) {
    currentHttpNetworkConfiguration.proxy = maskProxyPassword(
      currentHttpNetworkConfiguration.proxy,
    );
  }

  if (currentHttpNetworkConfiguration.proxyAuthorization) {
    currentHttpNetworkConfiguration.proxyAuthorization = '***';
  }

  // In config, users specify the location of certificate files. We use
  // getHttpAgentOptions because we want the contents of those files, not
  // the location.
  const httpAgentOptions = getHttpAgentOptions();

  // Ensure that only the fingerprint is logged
  currentGitLabConfiguration.ca = httpAgentOptions.ca
    ? await calculateSHA256Fingerprint(httpAgentOptions.ca, 'ca')
    : '';
  currentGitLabConfiguration.cert = httpAgentOptions.cert
    ? await calculateSHA256Fingerprint(httpAgentOptions.cert, 'cert')
    : '';

  currentGitLabConfiguration.certKey = httpAgentOptions.key ? '***' : '';

  currentGitLabConfiguration.ignoreCertificateErrors = !httpAgentOptions.rejectUnauthorized;

  return {
    http: currentHttpNetworkConfiguration,
    gitlab: currentGitLabConfiguration,
  };
}

export async function logNetworkConfiguration(): Promise<void> {
  log.debug('[LogNetworkConfig] Fetching and processing network configuration...');
  try {
    const itemsToLog = await getNetworkConfiguration();

    log.info(
      `[LogNetworkConfig] Network Configuration detected: ${JSON.stringify(itemsToLog, null, 2)}`,
    );
  } catch (e) {
    log.debug('[LogNetworkConfig] Failed to log network configuration');
  }
}
