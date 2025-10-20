

"use client";

import type { SummarizeDmarcReportOutput } from '@/ai/flows/dmarc-report-summarizer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, AlertTriangle } from 'lucide-react';

interface AiSummaryProps {
  fileName: string;
  summaryOutput: SummarizeDmarcReportOutput | null;
  isLoading: boolean; 
  error: string | null; 
}

export function AiSummary({ fileName, summaryOutput, isLoading, error }: AiSummaryProps) {
  const cardTitleText = `AI Insight for: ${fileName}`;

  if (isLoading) {
    return (
      <Card className="shadow-md flex-1 flex flex-col min-h-[150px]">
        <CardHeader className="pt-3 pb-2 px-4">
          <CardTitle className="flex items-center text-base"><Sparkles className="mr-2 h-5 w-5 text-accent" /> {cardTitleText}</CardTitle>
          <CardDescription className="text-xs">Analyzing with AI...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-3 flex-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/5" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive shadow-md flex-1 flex flex-col min-h-[150px]">
        <CardHeader className="pt-3 pb-2 px-4">
          <CardTitle className="flex items-center text-destructive text-base"><AlertTriangle className="mr-2 h-5 w-5" /> AI Error: {fileName}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 flex-1">
          <p className="text-sm text-destructive-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">AI model might be unavailable or content was problematic.</p>
        </CardContent>
      </Card>
    );
  }

  if (!summaryOutput || !summaryOutput.analysis) {
    return (
      <Card className="shadow-md flex-1 flex flex-col min-h-[150px]">
        <CardHeader className="pt-3 pb-2 px-4">
          <CardTitle className="flex items-center text-base"><Sparkles className="mr-2 h-5 w-5 text-accent" /> {cardTitleText}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 flex-1">
          <p className="text-sm text-muted-foreground">No AI insight available for this report.</p>
        </CardContent>
      </Card>
    );
  }
  
  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-1 last:mb-0 text-xs leading-snug">{paragraph}</p>
    ));
  };

  return (
    <Card className="shadow-lg flex-1 flex flex-col min-h-[150px]">
      <CardHeader className="pt-3 pb-2 px-4">
        <CardTitle className="flex items-center text-primary text-base"><Sparkles className="mr-2 h-5 w-5 text-accent" /> {cardTitleText}</CardTitle>
        <CardDescription className="text-xs">Concise AI-driven analysis.</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3 flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full pr-2">
            <div className="text-foreground">{formatText(summaryOutput.analysis)}</div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
