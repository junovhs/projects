
"use client";

import type { DmarcReport } from '@/types/dmarc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table2 } from 'lucide-react';

interface StatsTableProps {
  reports: DmarcReport[] | null;
}

interface AggregateStats {
  totalEmails: number;
  spfPass: number;
  spfFail: number;
  dkimPass: number;
  dkimFail: number;
  alignmentPass: number;
  alignmentFail: number;
  policyNone: number;
  policyQuarantine: number;
  policyReject: number;
  reportDomains: string[];
  publishedPolicies: string[]; 
  reportCount: number;
}

function calculateStats(reports: DmarcReport[] | null): AggregateStats {
  const stats: AggregateStats = {
    totalEmails: 0,
    spfPass: 0,
    spfFail: 0,
    dkimPass: 0,
    dkimFail: 0,
    alignmentPass: 0,
    alignmentFail: 0,
    policyNone: 0,
    policyQuarantine: 0,
    policyReject: 0,
    reportDomains: [],
    publishedPolicies: [],
    reportCount: reports?.length || 0,
  };

  if (!reports || reports.length === 0) return stats;

  const uniqueDomains = new Set<string>();
  const uniquePolicies = new Set<string>();

  reports.forEach(report => {
    if (report.policyPublished?.domain) {
      uniqueDomains.add(report.policyPublished.domain);
    }
    if (report.policyPublished?.p) {
      uniquePolicies.add(report.policyPublished.p.toLowerCase());
    }

    report.records.forEach(record => {
      stats.totalEmails += record.row.count;
      const spfResult = record.row.policyEvaluated.spf?.toLowerCase();
      const dkimResult = record.row.policyEvaluated.dkim?.toLowerCase();

      if (spfResult === 'pass') stats.spfPass += record.row.count;
      else if (spfResult === 'fail') stats.spfFail += record.row.count;
      
      if (dkimResult === 'pass') stats.dkimPass += record.row.count;
      else if (dkimResult === 'fail') stats.dkimFail += record.row.count;
      
      const dmarcPass = (spfResult === 'pass' || dkimResult === 'pass'); // Simplified: an aligned pass in either SPF or DKIM counts as DMARC pass for this metric
      if (dmarcPass) {
          stats.alignmentPass += record.row.count;
      } else {
          stats.alignmentFail += record.row.count;
      }

      const disposition = record.row.policyEvaluated.disposition?.toLowerCase();
      if (disposition === 'none') stats.policyNone += record.row.count;
      else if (disposition === 'quarantine') stats.policyQuarantine += record.row.count;
      else if (disposition === 'reject') stats.policyReject += record.row.count;
    });
  });

  stats.reportDomains = Array.from(uniqueDomains);
  stats.publishedPolicies = Array.from(uniquePolicies);

  return stats;
}

function formatPercentage(value: number, total: number): string {
  if (total === 0) return "0.00%";
  return ((value / total) * 100).toFixed(2) + "%";
}

function getPolicyBadgeVariant(policy: string) {
    switch (policy.toLowerCase()) {
        case 'none': return 'secondary';
        case 'quarantine': return 'default'; 
        case 'reject': return 'destructive';
        default: return 'outline';
    }
}


export function StatsTable({ reports }: StatsTableProps) {
  const stats = calculateStats(reports);

  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader className="pt-3 pb-2 px-4">
          <CardTitle className="flex items-center text-lg"><Table2 className="mr-2 h-5 w-5" /> Aggregate Statistics</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-sm text-muted-foreground">No reports processed yet.</p>
        </CardContent>
      </Card>
    );
  }
  
  const domainsDisplay = stats.reportDomains.length > 0 ? stats.reportDomains.join(', ') : 'N/A';
  let policyDisplay: React.ReactNode;
  if (stats.publishedPolicies.length === 0) {
    policyDisplay = <Badge variant="outline" className="text-xs">N/A</Badge>;
  } else if (stats.publishedPolicies.length === 1) {
    const policy = stats.publishedPolicies[0];
    policyDisplay = <Badge variant={getPolicyBadgeVariant(policy)} className="capitalize text-xs">{policy}</Badge>;
  } else {
    policyDisplay = (
        <div className="flex flex-wrap gap-1 items-center">
            {stats.publishedPolicies.map(p => (
                <Badge key={p} variant={getPolicyBadgeVariant(p)} className="capitalize text-xs">{p}</Badge>
            ))}
             <span className="text-xs text-muted-foreground">(Multiple policies)</span>
        </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pt-3 pb-2 px-4">
        <CardTitle className="flex items-center text-lg"><Table2 className="mr-2 h-5 w-5" /> Aggregate DMARC Statistics</CardTitle>
        <CardDescription className="text-xs">Combined from {stats.reportCount} report(s).</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-1 pt-0">
        <ScrollArea className="max-h-60 w-full"> {/* Max height for table content */}
            <Table className="text-xs">
            <TableCaption className="text-xs py-1">
                For domain(s): {domainsDisplay}.
            </TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead className="h-8">Metric</TableHead>
                <TableHead className="h-8">Value</TableHead>
                <TableHead className="h-8">% (of total)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                <TableCell className="font-medium py-1.5">Reported Domain(s)</TableCell>
                <TableCell colSpan={2} className="py-1.5">{domainsDisplay}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">Published Policy (p)</TableCell>
                <TableCell colSpan={2} className="py-1.5">{policyDisplay}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">Total Emails Reported</TableCell>
                <TableCell className="py-1.5">{stats.totalEmails.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">-</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">SPF Passed</TableCell>
                <TableCell className="py-1.5">{stats.spfPass.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.spfPass, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">SPF Failed</TableCell>
                <TableCell className="py-1.5">{stats.spfFail.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.spfFail, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">DKIM Passed</TableCell>
                <TableCell className="py-1.5">{stats.dkimPass.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.dkimPass, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">DKIM Failed</TableCell>
                <TableCell className="py-1.5">{stats.dkimFail.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.dkimFail, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">DMARC Aligned (Passed)</TableCell>
                <TableCell className="py-1.5">{stats.alignmentPass.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.alignmentPass, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">DMARC Not Aligned (Failed)</TableCell>
                <TableCell className="py-1.5">{stats.alignmentFail.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.alignmentFail, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">Policy: None Applied</TableCell>
                <TableCell className="py-1.5">{stats.policyNone.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.policyNone, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">Policy: Quarantine Applied</TableCell>
                <TableCell className="py-1.5">{stats.policyQuarantine.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.policyQuarantine, stats.totalEmails)}</TableCell>
                </TableRow>
                <TableRow>
                <TableCell className="font-medium py-1.5">Policy: Reject Applied</TableCell>
                <TableCell className="py-1.5">{stats.policyReject.toLocaleString()}</TableCell>
                <TableCell className="py-1.5">{formatPercentage(stats.policyReject, stats.totalEmails)}</TableCell>
                </TableRow>
            </TableBody>
            </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
