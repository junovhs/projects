
"use client";

import type { DmarcPassRate, AuthenticationBreakdownData, PolicyPublished } from '@/types/dmarc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthenticationBreakdownChart } from './charts/authentication-breakdown-chart';
import { TrendingUp, TrendingDown, TrendingFlat, ShieldCheck, Info, FileSliders } from 'lucide-react'; // Added FileSliders

interface DmarcSnapshotProps {
  passRate: DmarcPassRate;
  authBreakdown: AuthenticationBreakdownData;
  policy: PolicyPublished | null;
  targetDomain: string;
}

function getPassRateColor(percentage: number): string {
  if (percentage >= 95) return 'text-green-600'; // Consider adding to theme
  if (percentage >= 80) return 'text-yellow-500'; // Consider adding to theme
  return 'text-destructive';
}

export function DmarcSnapshot({ passRate, authBreakdown, policy, targetDomain }: DmarcSnapshotProps) {
  const passRateColor = getPassRateColor(passRate.percentage);
  // Trend arrow logic would require historical data. Placeholder for now.
  // const TrendIcon = passRate.trend === 'up' ? TrendingUp : passRate.trend === 'down' ? TrendingDown : TrendingFlat;

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-base flex items-center">
          <FileSliders className="mr-2 h-4 w-4 text-muted-foreground" />
          Overall DMARC Compliance Snapshot
        </CardTitle>
        <CardDescription className="text-xs">
          Key DMARC metrics for <strong>{targetDomain}</strong> based on uploaded reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="bg-card/50 p-3">
            <CardHeader className="p-0 pb-1">
              <CardDescription className="text-xs">DMARC Pass Rate (Alignment)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className={`text-3xl font-bold ${passRateColor}`}>
                {passRate.percentage.toFixed(1)}%
                {/* <TrendIcon className="inline-block ml-1 h-5 w-5" /> */}
              </div>
              <p className="text-xs text-muted-foreground">
                {passRate.passedEmails.toLocaleString()} / {passRate.totalEmails.toLocaleString()} emails aligned for {targetDomain}.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 p-3 md:col-span-2">
             <CardHeader className="p-0 pb-1">
                <CardDescription className="text-xs">Authentication Breakdown (DMARC Outcome)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <AuthenticationBreakdownChart data={authBreakdown} />
            </CardContent>
          </Card>
        </div>
        {policy && (
          <Card className="bg-card/50 p-3">
            <CardHeader className="p-0 pb-1">
              <CardDescription className="text-xs">Published DMARC Policy for: <strong>{policy.domain || targetDomain}</strong></CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm font-mono">
                p={policy.p || 'none'}; 
                {policy.sp && ` sp=${policy.sp};`}
                {policy.adkim && ` adkim=${policy.adkim};`}
                {policy.aspf && ` aspf=${policy.aspf};`}
                {policy.pct && ` pct=${policy.pct};`}
                {policy.fo && ` fo=${policy.fo};`}
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
