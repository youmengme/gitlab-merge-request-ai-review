import * as vscode from 'vscode';
import { log } from '../../../common/log';
import { createFakePartial } from '../../../common/test_utils/create_fake_partial';
import { logNetworkConfiguration } from './log_network_options';
import { getHttpAgentOptions } from './get_http_agent_options';

jest.mock('../../../common/log');
jest.mock('./get_http_agent_options');
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => {
      return {
        get: jest.fn(),
      };
    }),
    onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    fire: jest.fn(),
  })),
}));

describe('log_network_options', () => {
  const mockLog = log as jest.Mocked<typeof log>;
  const mockGetHttpAgentOptions = getHttpAgentOptions as jest.MockedFunction<
    typeof getHttpAgentOptions
  >;
  const mockVSCodeWorkspace = vscode.workspace as jest.Mocked<typeof vscode.workspace>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockVSCodeWorkspace.getConfiguration.mockImplementation(() => {
      // For 'http' section
      return {
        get: jest.fn().mockImplementation((key: string) => {
          const config: Record<string, unknown> = {
            proxy: 'http://proxy.example.com:8080',
            proxySupport: 'on',
          };
          return config[key];
        }),
        has: jest.fn(),
        inspect: jest.fn(),
        update: jest.fn(),
      };
    });
  });

  describe('basic functionality', () => {
    it('should log network configuration successfully', async () => {
      mockVSCodeWorkspace.getConfiguration.mockImplementation(() => {
        // For 'http' section
        return {
          get: jest.fn().mockImplementation((key: string) => {
            const config: Record<string, unknown> = {
              proxy: 'http://proxy.example.com:8080',
              proxySupport: 'on',
            };
            return config[key];
          }),
          has: jest.fn(),
          inspect: jest.fn(),
          update: jest.fn(),
        };
      });

      mockGetHttpAgentOptions.mockReturnValue({
        rejectUnauthorized: false,
      });

      await logNetworkConfiguration();

      expect(mockLog.info)
        .toHaveBeenCalledWith(`[LogNetworkConfig] Network Configuration detected: {
  "http": {
    "proxy": "http://proxy.example.com:8080/",
    "proxySupport": "on"
  },
  "gitlab": {
    "ca": "",
    "cert": "",
    "certKey": "",
    "ignoreCertificateErrors": true
  }
}`);
    });

    it('should handle errors and log debug message', async () => {
      mockVSCodeWorkspace.getConfiguration.mockImplementation(() => {
        throw new Error('Config error');
      });

      await logNetworkConfiguration();

      expect(mockLog.debug).toHaveBeenCalledWith(
        '[LogNetworkConfig] Failed to log network configuration',
      );
      expect(mockLog.debug).toHaveBeenCalledWith(
        '[LogNetworkConfig] Fetching and processing network configuration...',
      );
    });

    it('should not throw errors even if configuration fails', async () => {
      mockVSCodeWorkspace.getConfiguration.mockImplementation(() => {
        throw new Error('Severe error');
      });

      await expect(logNetworkConfiguration()).resolves.not.toThrow();
    });
  });

  describe('http settings', () => {
    const mockGet = jest.fn();

    let mockHttpConfig;

    beforeEach(() => {
      mockHttpConfig = createFakePartial<vscode.WorkspaceConfiguration>({
        get: mockGet,
      });

      mockVSCodeWorkspace.getConfiguration.mockReturnValue(mockHttpConfig);
      mockGetHttpAgentOptions.mockReturnValue({
        rejectUnauthorized: false,
        keepAlive: true,
      });
    });

    it('should collect VS Code HTTP configuration settings', async () => {
      mockGet.mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          proxy: 'http://proxy.example.com:8080',
          proxySupport: 'on',
          proxyAuthorization: '',
          proxyStrictSSL: true,
          noProxy: ['localhost', '127.0.0.1'],
          electronFetch: true,
          fetchAdditionalSupport: false,
        };
        return config[key];
      });

      await logNetworkConfiguration();

      expect(mockLog.info)
        .toHaveBeenCalledWith(`[LogNetworkConfig] Network Configuration detected: {
  "http": {
    "proxy": "http://proxy.example.com:8080/",
    "proxySupport": "on",
    "proxyAuthorization": "",
    "proxyStrictSSL": true,
    "noProxy": [
      "localhost",
      "127.0.0.1"
    ],
    "electronFetch": true,
    "fetchAdditionalSupport": false
  },
  "gitlab": {
    "ca": "",
    "cert": "",
    "certKey": "",
    "ignoreCertificateErrors": true
  }
}`);
    });

    it('should mask proxy password in configuration', async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'proxy') return 'http://user:secret@proxy.example.com:8080';
        return undefined;
      });

      await logNetworkConfiguration();

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining(`"proxy": "http://user:***@proxy.example.com:8080/"`),
      );
    });

    it('should mask proxyAuthorization in configuration', async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'proxyAuthorization') return 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=';
        return undefined;
      });

      await logNetworkConfiguration();

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining(`"proxyAuthorization": "***"`),
      );
    });

    it('should return original string if not a valid URL', async () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'proxy') return 'not-a-url';
        return undefined;
      });

      await logNetworkConfiguration();

      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`"proxy": "not-a-url"`));
    });
  });

  describe('certificate settings', () => {
    it('should handle missing certificate data gracefully', async () => {
      mockGetHttpAgentOptions.mockReturnValue({
        rejectUnauthorized: false,
      });

      await logNetworkConfiguration();

      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`"ca": ""`));
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`"cert": ""`));
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`"certKey": ""`));
    });

    it('should convert rejectUnauthorized to ignoreCertificateErrors correctly', async () => {
      mockGetHttpAgentOptions.mockReturnValue({
        rejectUnauthorized: true,
      });

      await logNetworkConfiguration();

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining(`"ignoreCertificateErrors": false`),
      );
    });

    it('should redact the certKey field', async () => {
      mockGetHttpAgentOptions.mockReturnValue({
        key: Buffer.from('MC4CAQAwBQYDK2VwBCIEIIGH1h/Wt6JSHrkkYHWRdFUsr'),
      });

      await logNetworkConfiguration();

      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`"certKey": "***"`));
    });

    it('should collect GitLab certificate configuration with SHA256 fingerprints', async () => {
      const exampleCert = `-----BEGIN CERTIFICATE-----
MIIBbzCCASGgAwIBAgIUeft8tyYv4vY7m+ecqCNBm0OY3Q0wBQYDK2VwMBYxFDAS
BgNVBAMMC2V4YW1wbGUuY29tMB4XDTI1MDkxOTAzNTY0MloXDTM1MDkxNzAzNTY0
MlowFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wKjAFBgMrZXADIQBFFey8c1um4nrl
smOzZKeoLsnjcWIYHl5BitC5QBig76OBgDB+MB0GA1UdDgQWBBQTMHkBRubcpHSs
XFxBaOTu4PM4+zAfBgNVHSMEGDAWgBQTMHkBRubcpHSsXFxBaOTu4PM4+zAPBgNV
HRMBAf8EBTADAQH/MCsGA1UdEQQkMCKCC2V4YW1wbGUuY29tgg0qLmV4YW1wbGUu
Y29thwQKAAABMAUGAytlcANBAFl2MotgAnnerE96rk4a/l7DzG4uzHgQSb4gKa4g
/LvZgBnbREclLN225mNSuRupQSFowRC0db+U4+tYOzcGtQ0=
-----END CERTIFICATE-----`;

      const mockCaBuffer = Buffer.from(exampleCert);
      const mockCertBuffer = Buffer.from(exampleCert);

      mockGetHttpAgentOptions.mockReturnValue({
        ca: mockCaBuffer,
        cert: mockCertBuffer,
        rejectUnauthorized: true,
        keepAlive: true,
      });

      await logNetworkConfiguration();

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `"ca": "B8:26:C2:77:E1:13:EC:F5:FE:76:91:98:AC:B8:BE:C3:41:E9:89:E1:07:A7:78:AA:8C:78:AA:9C:1F:06:D2:42"`,
        ),
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `"cert": "B8:26:C2:77:E1:13:EC:F5:FE:76:91:98:AC:B8:BE:C3:41:E9:89:E1:07:A7:78:AA:8C:78:AA:9C:1F:06:D2:42"`,
        ),
      );
    });

    it('should return empty string and log debug on error', async () => {
      // Set up some invalid certificate data to trigger an error
      // in the X509Certificate constructor
      const mockCertBuffer = Buffer.from('fake cert data');
      mockGetHttpAgentOptions.mockReturnValue({
        ca: mockCertBuffer,
      });

      await logNetworkConfiguration();

      expect(mockLog.debug).toHaveBeenCalledWith(
        '[LogNetworkConfig] Error calculating SHA 256 Fingerprint for: gitlab.ca',
      );
      expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`"ca": ""`));
    });
  });
});
