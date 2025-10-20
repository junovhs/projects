
"use client";

import type { AggregateDmarcSummaryOutput } from '@/ai/flows/aggregate-dmarc-summary-flow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BotMessageSquare, AlertTriangle, CheckCircle, ListChecks, TrendingUp, Info, BadgeHelp, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AggregateAiSummaryProps {
  summaryOutput: AggregateDmarcSummaryOutput | null;
  isLoading: boolean;
  error: string | null;
  reportCount: number;
  targetDomain: string;
}

const severityIcons: Record<AggregateDmarcSummaryOutput['recommendations'][0]['severity'], React.ElementType> = {
  CRITICAL: ShieldAlert,
  ATTENTION: AlertTriangle,
  MONITOR: TrendingUp,
  GOOD: ShieldCheck,
  INFO: Info,
};

const severityColors: Record<AggregateDmarcSummaryOutput['recommendations'][0]['severity'], string> = {
  CRITICAL: "text-destructive",
  ATTENTION: "text-orange-500", // You might want to add orange to your theme
  MONITOR: "text-blue-500",   // You might want to add blue to your theme
  GOOD: "text-green-600",   // You might want to add green to your theme
  INFO: "text-muted-foreground",
};


export function AggregateAiSummary({ summaryOutput, isLoading, error, reportCount, targetDomain }: AggregateAiSummaryProps) {
  const cardTitleText = `Actionable Recommendations for ${targetDomain}`;

  if (isLoading) {
    return (
      <Card className="shadow-md flex-1 flex flex-col min-h-[200px]">
        <CardHeader className="pt-3 pb-2 px-4">
          <CardTitle className="flex items-center text-lg"><BotMessageSquare className="mr-2 h-5 w-5 text-accent" /> {cardTitleText}</CardTitle>
          <CardDescription className="text-xs">AI is analyzing {reportCount} reports... (this may take a moment)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-3 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full mt-3" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive shadow-md flex-1 flex flex-col min-h-[200px]">
        <CardHeader className="pt-3 pb-2 px-4">
          <CardTitle className="flex items-center text-destructive text-lg"><AlertTriangle className="mr-2 h-5 w-5" /> AI Analysis Error</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 flex-1">
          <p className="text-sm text-destructive-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">The AI model might be unavailable or content was problematic.</p>
        </CardContent>
      </Card>
    );
  }

  if (!summaryOutput || (!summaryOutput.executiveSummary && !summaryOutput.recommendations?.length)) {
    return (
      <Card className="shadow-md flex-1 flex flex-col min-h-[200px]">
        <CardHeader className="pt-3 pb-2 px-4">
          <CardTitle className="flex items-center text-lg"><BotMessageSquare className="mr-2 h-5 w-5 text-accent" /> {cardTitleText}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 flex-1">
          <p className="text-sm text-muted-foreground">No AI insights available or the AI response was empty.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-lg bg-card flex-1 flex flex-col min-h-[200px]">
      <CardHeader className="pt-3 pb-2 px-4">
        <CardTitle className="flex items-center text-primary text-lg"><BadgeHelp className="mr-2 h-6 w-6 text-accent" /> {cardTitleText}</CardTitle>
        <CardDescription className="text-xs">AI-driven analysis and prioritized recommendations based on {reportCount} report(s).</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3 flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full pr-2"> 
            <div className="space-y-3">
                {summaryOutput.executiveSummary && (
                <section className="mb-3">
                    <h3 className="text-sm font-semibold text-primary mb-0.5">Executive Summary</h3>
                    <p className="text-xs text-foreground leading-snug">{summaryOutput.executiveSummary}</p>
                </section>
                )}

                {summaryOutput.recommendations && summaryOutput.recommendations.length > 0 && (
                <section>
                    <h3 className="text-sm font-semibold text-primary mb-1.5">Recommendations</h3>
                    <div className="space-y-2.5">
                    {summaryOutput.recommendations.map((rec, index) => {
                        const IconComponent = severityIcons[rec.severity] || Info;
                        const iconColor = severityColors[rec.severity] || "text-muted-foreground";
                        return (
                            <div key={`rec-${index}`} className="p-2 border rounded-md bg-background/50 shadow-sm text-xs">
                                <div className="flex items-start">
                                    <IconComponent className={`mr-2 h-3.5 w-3.5 mt-0.5 shrink-0 ${iconColor}`} />
                                    <div className="flex-1">
                                        <p className={`font-semibold ${iconColor} uppercase`}>{rec.severity}</p>
                                        <p className="text-foreground leading-snug mb-0.5">{rec.message}</p>
                                        {rec.details && rec.details.length > 0 && (
                                            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[0.7rem] mt-1">
                                                {rec.details.map((detail, detailIndex) => (
                                                    <li key={`detail-${index}-${detailIndex}`}>{detail}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </section>
                )}
            </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
