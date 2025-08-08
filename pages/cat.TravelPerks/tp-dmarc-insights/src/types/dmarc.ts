

export interface DmarcReport {
  reportMetadata: ReportMetadata;
  policyPublished: PolicyPublished;
  records: DmarcRecord[];
}

export interface ReportMetadata {
  orgName: string | null;
  email: string | null;
  reportId: string | null;
  dateRange: {
    begin: number | null;
    end: number | null;
  };
}

export interface PolicyPublished {
  domain: string | null;
  adkim: string | null;
  aspf: string | null;
  p: string | null;
  sp: string | null;
  pct: number | null;
  fo: string | null;
}

export interface DmarcRecord {
  row: {
    sourceIp: string | null;
    count: number;
    policyEvaluated: PolicyEvaluated;
  };
  identifiers: Identifiers;
  authResults?: AuthResults;
}

export interface PolicyEvaluated {
  disposition: string | null;
  dkim: string | null; // Overall DKIM evaluation for DMARC (pass/fail)
  spf: string | null;  // Overall SPF evaluation for DMARC (pass/fail)
}

export interface Identifiers {
  headerFrom: string | null;
  envelopeFrom?: string | null;
}

export interface AuthResults {
  dkim: DkimAuthResult[];
  spf: SpfAuthResult[];
}

interface BaseAuthResult {
  domain: string | null;
  result: string | null; // Raw SPF/DKIM check result (pass, fail, neutral, etc.)
}

export interface DkimAuthResult extends BaseAuthResult {
  selector?: string | null;
}

export interface SpfAuthResult extends BaseAuthResult {
  scope?: string | null;
}

// Helper type for general chart data (like pie/bar charts)
export interface ChartData {
  name: string;
  value: number;
  fill?: string;
}

// Helper type for timeline chart data
export interface TimelineChartData {
  date: string; // YYYY-MM-DD
  volume: number;
}

// For Section I: DMARC Compliance Snapshot
export interface DmarcPassRate {
  percentage: number;
  passedEmails: number;
  totalEmails: number;
}

export interface AuthenticationBreakdownData {
  dmarcPass: number;
  spfAlignedOnly: number; // DMARC pass via SPF, DKIM failed DMARC alignment
  dkimAlignedOnly: number; // DMARC pass via DKIM, SPF failed DMARC alignment
  bothFailedAlign: number; // DMARC fail
  totalEmails: number;
}

// For Section II: Source Authentication Table
export interface SourceAuthRow {
  sourceIp: string;
  // sourceIspOwner: string; // Future: "Constant Contact", "Microsoft Outlook/M365"
  emailVolume: number;
  dmarcPassCount: number;
  dmarcPassPercent: number;
  spfDmarcAlignResult: 'pass' | 'fail'; // Did SPF pass DMARC alignment (policy_evaluated.spf === 'pass')
  spfAuthDomain: string; // The domain that passed the raw SPF check
  spfRawResult: string; // Raw SPF result (pass, fail, neutral, etc.)
  dkimDmarcAlignResult: 'pass' | 'fail'; // Did DKIM pass DMARC alignment (policy_evaluated.dkim === 'pass')
  dkimAuthDomains: Array<{ domain: string; selector?: string; result: string }>; // Domains+selectors that passed raw DKIM
  // actionableInsight: string; // Future: AI-generated or heuristic-based flag
}
