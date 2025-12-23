import {
  securityReportComparer,
  securityFindingFixed,
  securityFindingAdded,
  mr,
} from '../../test_utils/entities';
import { project } from '../../../common/test_utils/entities';
import { GitLabService } from '../gitlab_service';
import { log } from '../../../common/log';
import { ApiRequest } from '../../../common/platform/web_ide';
import {
  GetSecurityFindingsReportQuery,
  reportTypes,
  querySecurityFindingReport,
  GqlSecurityFindingReportComparer,
  SecurityReportStatus,
  GqlSecurityReport,
} from './api/get_security_finding_report';
import { getAllSecurityReports } from './get_all_security_reports';

jest.mock('../gitlab_service');
jest.mock('../../../common/log');

const createMockGitLabService = (): jest.Mocked<GitLabService> => {
  const partialService: jest.Mocked<Partial<GitLabService>> = {
    fetchFromApi: jest.fn().mockResolvedValue(undefined),
    validateVersion: jest.fn().mockResolvedValue(undefined),
  };

  return partialService as jest.Mocked<GitLabService>;
};

const createTestResponse = ({
  status,
  report,
  statusReason,
}: {
  status: SecurityReportStatus;
  report?: GqlSecurityReport;
  statusReason?: string;
}): GetSecurityFindingsReportQuery => ({
  project: {
    mergeRequest: {
      findingReportsComparer: <GqlSecurityFindingReportComparer>{
        status,
        report,
        statusReason,
      },
    },
  },
});

describe('getAllSecurityReports', () => {
  let service: jest.Mocked<GitLabService>;

  beforeEach(() => {
    service = createMockGitLabService();
  });

  it('returns merged reports of all the types', async () => {
    service.fetchFromApi.mockImplementation(() =>
      Promise.resolve(
        createTestResponse({
          status: 'PARSED',
          report: {
            ...securityReportComparer.report,
            added: securityFindingAdded,
            fixed: securityFindingFixed,
          } as GqlSecurityReport,
        }),
      ),
    );

    expect(service.fetchFromApi).not.toHaveBeenCalled();

    const expectedCalls: [ApiRequest<unknown>][] = reportTypes.map(reportType => [
      {
        type: 'graphql',
        query: querySecurityFindingReport,
        variables: {
          fullPath: project.namespaceWithPath,
          mergeRequestIid: mr.iid.toString(),
          reportType,
        },
      },
    ]);
    const result = await getAllSecurityReports(service, project, mr);

    expect(service.fetchFromApi.mock.calls).toEqual(expectedCalls);

    expect(result).toEqual({
      status: 'PARSED',
      report: {
        ...securityReportComparer.report,
        added: reportTypes.flatMap(() => securityFindingAdded),
        fixed: reportTypes.flatMap(() => securityFindingFixed),
      },
    });
  });

  it('returns PARSING state when at least one report is parsing AND other reports have empty reports', async () => {
    reportTypes.forEach(reportType => {
      if (reportType === 'SAST') {
        service.fetchFromApi.mockImplementationOnce(() =>
          Promise.resolve(createTestResponse({ status: 'PARSING', report: undefined })),
        );
      } else {
        service.fetchFromApi.mockImplementationOnce(() =>
          Promise.resolve(
            createTestResponse({
              status: 'ERROR',
              report: undefined,
              statusReason: `This merge request does not have ${reportType} reports`,
            }),
          ),
        );
      }
    });

    const result = await getAllSecurityReports(service, project, mr);

    expect(result).toEqual({
      status: 'PARSING',
    });
  });

  it('returns PARSING state when at least one report is parsing AND other reports are parsed', async () => {
    reportTypes.forEach(reportType => {
      if (reportType === 'SAST') {
        service.fetchFromApi.mockImplementationOnce(() =>
          Promise.resolve(createTestResponse({ status: 'PARSING', report: undefined })),
        );
      } else {
        service.fetchFromApi.mockImplementationOnce(() =>
          Promise.resolve(
            createTestResponse({
              status: 'PARSED',
              report: {
                ...securityReportComparer.report,
                added: securityFindingAdded,
                fixed: securityFindingFixed,
              } as GqlSecurityReport,
            }),
          ),
        );
      }
    });

    const result = await getAllSecurityReports(service, project, mr);

    expect(result).toEqual({
      status: 'PARSING',
    });
  });

  it('returns non empty reports', async () => {
    const mockedReport = {
      ...securityReportComparer.report,
      added: securityFindingAdded,
      fixed: securityFindingFixed,
    } as GqlSecurityReport;

    reportTypes.forEach(reportType => {
      if (reportType === 'DAST') {
        service.fetchFromApi.mockImplementationOnce(() =>
          Promise.resolve(createTestResponse({ status: 'PARSED', report: mockedReport })),
        );
      } else {
        service.fetchFromApi.mockImplementationOnce(() =>
          Promise.resolve(
            createTestResponse({
              status: 'ERROR',
              report: undefined,
              statusReason: `This merge request does not have ${reportType} reports`,
            }),
          ),
        );
      }
    });

    const result = await getAllSecurityReports(service, project, mr);

    expect(result).toEqual({
      status: 'PARSED',
      report: mockedReport,
    });
  });

  it('returns ERROR state when one of the fetches fails', async () => {
    const testError = new Error('test');
    service.fetchFromApi.mockRejectedValue(testError);

    const result = await getAllSecurityReports(service, project, mr);

    expect(result).toEqual({ status: 'ERROR' });
  });

  it('checks minimum gitlab instance version', async () => {
    const testError = new Error('test');
    const getLoggedMessage = () => jest.mocked(log.warn).mock.calls[0][0];

    service.validateVersion.mockRejectedValue(testError);

    await getAllSecurityReports(service, project, mr);
    expect(getLoggedMessage()).toEqual(testError);

    expect(service.validateVersion).toHaveBeenCalledWith('Security Findings', '16.1.0', true);
  });
});
