export type GqlVulnerbilitySeverity = 'INFO' | 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type GqlVulnerbility = {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  severity: GqlVulnerbilitySeverity;
  project: {
    id: string;
    fullPath: string;
    nameWithNamespace: string;
  };
  reportType: string;
  scanner: {
    id: string;
    name: string;
  };
  identifiers: {
    name: string;
    url: string;
  }[];
};

export type GqlSecurityReportFinding = {
  project: {
    id: string;
    pipeline: {
      id: string;
      securityReportFinding: {
        id: string;
        vulnerability: GqlVulnerbility;
      };
    };
  };
};
