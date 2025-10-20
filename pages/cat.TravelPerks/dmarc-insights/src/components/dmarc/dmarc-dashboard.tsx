
"use client";

import React, { useState, useCallback, useMemo } from 'react';
import type { DmarcReport, DmarcRecord, PolicyPublished, TimelineChartData, AuthenticationBreakdownData, DmarcPassRate, SourceAuthRow } from '@/types/dmarc';
import { parseDmarcXml } from '@/lib/dmarc-parser';
import { summarizeDmarcReport, type SummarizeDmarcReportOutput } from '@/ai/flows/dmarc-report-summarizer';
import { generateAggregateDmarcSummary, type AggregateDmarcSummaryInput, type AggregateDmarcSummaryOutput } from '@/ai/flows/aggregate-dmarc-summary-flow';
import { useToast } from '@/hooks/use-toast';

import { XmlUpload } from './xml-upload';
import { AiSummary } from './ai-summary'; 
import { AggregateAiSummary } from './aggregate-ai-summary'; 
import { DmarcSnapshot } from './dmarc-snapshot'; 
import { SourceAuthenticationTable } from './source-authentication-table'; 
import { EmailVolumeTimelineChart } from './charts/email-volume-timeline-chart'; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, Copy, FileText, ShieldQuestion } from 'lucide-react';

interface UploadedReportInfo {
  id: string;
  fileName: string;
  xmlContent: string;
  parsedReport: DmarcReport | null;
  parsingError: string | null;
  individualAiInsight: SummarizeDmarcReportOutput | null; 
  individualAiError: string | null;
  individualAiStatus: 'idle' | 'loading' | 'success' | 'error';
}

function generateChatbotCopyText(
  uploadedReportInfos: UploadedReportInfo[]
): string {
  let outputText = "Concatenated DMARC XML reports for AI Chatbot:\n\n";
  const reportSeparator = "\n\n<!-- DMARC Report Separator: Next report below -->\n\n";

  const reportsToConcatenate = uploadedReportInfos.filter(
    (info) => info.parsedReport && info.xmlContent
  );

  if (reportsToConcatenate.length === 0) {
    return "No successfully parsed DMARC reports available to copy.";
  }

  outputText += reportsToConcatenate
    .map((info) => `<!-- Report Filename: ${info.fileName} -->\n${info.xmlContent}`)
    .join(reportSeparator);
  
  outputText += "\n\n<!-- End of DMARC reports -->";
  return outputText;
}

const TARGET_DOMAIN = "travelperks.com"; 

export function DmarcDashboard() {
  const [uploadedReportInfos, setUploadedReportInfos] = useState<UploadedReportInfo[]>([]);
  
  const [aggregateAiSummary, setAggregateAiSummary] = useState<AggregateDmarcSummaryOutput | null>(null);
  const [aggregateAiError, setAggregateAiError] = useState<string | null>(null);
  const [aggregateAiStatus, setAggregateAiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const { toast } = useToast();

  const allParsedReports = useMemo(() => uploadedReportInfos.map(r => r.parsedReport).filter(Boolean) as DmarcReport[], [uploadedReportInfos]);
  const allRecords: DmarcRecord[] = useMemo(() => allParsedReports.flatMap(report => report.records || []), [allParsedReports]);
  const successfullyParsedCount = useMemo(() => uploadedReportInfos.filter(r => r.parsedReport).length, [uploadedReportInfos]);
  
  const mainPolicyPublished: PolicyPublished | null = useMemo(() => {
    if (allParsedReports.length > 0 && allParsedReports[0].policyPublished.domain?.toLowerCase().includes(TARGET_DOMAIN.toLowerCase())) {
      return allParsedReports[0].policyPublished;
    }
    const targetReport = allParsedReports.find(r => r.policyPublished.domain?.toLowerCase().includes(TARGET_DOMAIN.toLowerCase())) || allParsedReports[0];
    return targetReport ? targetReport.policyPublished : null;
  }, [allParsedReports]);


  const handleFileUpload = useCallback(async (filesToUpload: Array<{fileName: string; content: string}>) => {
    if (filesToUpload.length === 0) return;
    setIsProcessingFiles(true);
    setAggregateAiSummary(null); 
    setAggregateAiError(null);
    setAggregateAiStatus('idle');

    const newReportInfos: UploadedReportInfo[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const fileData = filesToUpload[i];
      const uniqueId = `${Date.now()}-${fileData.fileName}-${i}`;
      let currentReportInfo: UploadedReportInfo = {
        id: uniqueId,
        fileName: fileData.fileName,
        xmlContent: fileData.content,
        parsedReport: null,
        parsingError: null,
        individualAiInsight: null,
        individualAiError: null,
        individualAiStatus: 'idle',
      };

      const report = parseDmarcXml(fileData.content);
      if (!report) {
        currentReportInfo.parsingError = "Failed to parse XML.";
        toast({ variant: "destructive", title: `Parsing Failed: ${fileData.fileName}`, description: "Could not parse XML." });
      } else {
        currentReportInfo.parsedReport = report;
        toast({ title: `Parsed: ${fileData.fileName}`, description: 'Added to batch.' });
      }
      newReportInfos.push(currentReportInfo);
    }
    
    const updatedUploadedInfos = [...uploadedReportInfos, ...newReportInfos];
    setUploadedReportInfos(updatedUploadedInfos);

    const successfullyParsedForAI = updatedUploadedInfos.filter(r => r.parsedReport);

    // Get all records from all currently successfully parsed reports (old + new)
    const allCurrentlyParsedReports = updatedUploadedInfos
        .map(info => info.parsedReport)
        .filter(Boolean) as DmarcReport[];
    const allCurrentRecords = allCurrentlyParsedReports.flatMap(report => report.records || []);


    if (successfullyParsedForAI.length === 1) {
        const reportInfo = successfullyParsedForAI[0];
        setUploadedReportInfos(prev => prev.map(r => r.id === reportInfo.id ? {...r, individualAiStatus: 'loading'} : {...r, individualAiInsight: null, individualAiError: null, individualAiStatus: 'idle'}));
        setAggregateAiSummary(null); 
        setAggregateAiStatus('idle');
        try {
            const insight = await summarizeDmarcReport({ dmarcReportXml: reportInfo.xmlContent });
            setUploadedReportInfos(prev => prev.map(r => r.id === reportInfo.id ? {...r, individualAiInsight: insight, individualAiStatus: 'success'} : r));
        } catch (aiError: any) {
            const errorMessage = aiError instanceof Error ? aiError.message : "Could not generate AI insight.";
            toast({ variant: "destructive", title: `AI Error: ${reportInfo.fileName}`, description: errorMessage});
            setUploadedReportInfos(prev => prev.map(r => r.id === reportInfo.id ? {...r, individualAiError: "Failed to get AI insight.", individualAiStatus: 'error'} : r));
        }
    } else if (successfullyParsedForAI.length > 1) {
        setUploadedReportInfos(prev => prev.map(r => ({...r, individualAiInsight: null, individualAiError: null, individualAiStatus: 'idle'})));
        
        const reportsForAggregate: AggregateDmarcSummaryInput['reports'] = successfullyParsedForAI
            .map(r => ({
                fileName: r.fileName,
                xmlContent: r.xmlContent, 
                reportDate: r.parsedReport?.reportMetadata?.dateRange?.end
                    ? new Date(r.parsedReport.reportMetadata.dateRange.end * 1000).toISOString().split('T')[0]
                    : undefined,
                policyDomain: r.parsedReport?.policyPublished?.domain || undefined,
            }));

        if (reportsForAggregate.length > 0) {
            setAggregateAiStatus('loading');
            
            // Calculate stats based on *all* currently parsed records
            const dmarcPassRateStats = calculateDmarcPassRate(allCurrentRecords, TARGET_DOMAIN);
            const sourceAuthStats = calculateSourceAuthData(allCurrentRecords, TARGET_DOMAIN);
            
            const topFailing = sourceAuthStats
                .filter(s => s.dmarcPassPercent < 100)
                .sort((a,b) => (b.emailVolume * (100-b.dmarcPassPercent)/100) - (a.emailVolume * (100-a.dmarcPassPercent)/100) ) 
                .slice(0,3)
                .map(s => ({
                    sourceIp: s.sourceIp,
                    volume: s.emailVolume,
                    dmarcFailPercent: 100 - s.dmarcPassPercent,
                    reason: `${s.spfDmarcAlignResult === 'fail' ? 'SPF Misaligned' : ''}${s.spfDmarcAlignResult === 'fail' && s.dkimDmarcAlignResult === 'fail' ? ', ' : ''}${s.dkimDmarcAlignResult === 'fail' ? 'DKIM Misaligned' : ''}${s.spfDmarcAlignResult === 'pass' && s.dkimDmarcAlignResult === 'pass' ? 'Other (e.g. Disposition)' : ''}`
                }));

            const aggregateInput: AggregateDmarcSummaryInput = {
                reports: reportsForAggregate,
                targetDomain: TARGET_DOMAIN,
                overallDmarcPassRate: dmarcPassRateStats.percentage, // Corrected: use the calculated stats object
                topFailingSources: topFailing
            };

            try {
                const aggregateResult = await generateAggregateDmarcSummary(aggregateInput);
                setAggregateAiSummary(aggregateResult);
                setAggregateAiStatus('success');
            } catch (aiError: any) {
                const errorMessage = aiError instanceof Error ? aiError.message : "Could not generate aggregate AI insights.";
                toast({ variant: "destructive", title: `Aggregate AI Error`, description: errorMessage});
                setAggregateAiError("Failed to get aggregate AI insights.");
                setAggregateAiStatus('error');
            }
        }
    }
    setIsProcessingFiles(false);
  }, [toast, uploadedReportInfos]); 
  
  const handleClearReports = () => {
    setUploadedReportInfos([]);
    setAggregateAiSummary(null);
    setAggregateAiError(null);
    setAggregateAiStatus('idle');
    toast({ title: "Reports Cleared", description: "All uploaded report data has been removed." });
  };

  const handleCopyToClipboard = async () => {
    const copyText = generateChatbotCopyText(uploadedReportInfos);
    try {
      await navigator.clipboard.writeText(copyText);
      toast({ title: "Copied to Clipboard", description: "Concatenated DMARC XML copied!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy DMARC XML." });
    }
  };

  const dmarcPassRateData = useMemo(() => calculateDmarcPassRate(allRecords, TARGET_DOMAIN), [allRecords]);
  const authBreakdownData = useMemo(() => calculateAuthBreakdown(allRecords, TARGET_DOMAIN), [allRecords]);
  const sourceAuthTableData = useMemo(() => calculateSourceAuthData(allRecords, TARGET_DOMAIN), [allRecords]);

  const timelineChartData = useMemo(() => {
    if (!allParsedReports || allParsedReports.length === 0) return [];
    const dailyVolumes: { [date: string]: number } = {};
    allParsedReports.forEach(report => {
      const endDateEpoch = report.reportMetadata.dateRange?.end;
      if (endDateEpoch) {
        const dateStr = new Date(endDateEpoch * 1000).toISOString().split('T')[0];
        if (!dailyVolumes[dateStr]) dailyVolumes[dateStr] = 0;
        report.records.forEach(record => { dailyVolumes[dateStr] += record.row.count; });
      }
    });
    return Object.entries(dailyVolumes)
      .map(([date, volume]) => ({ date, volume }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allParsedReports]);

  const displayIndividualAi = successfullyParsedCount === 1 && uploadedReportInfos[0]?.individualAiStatus !== 'idle' && !aggregateAiSummary;
  const displayAggregateAi = successfullyParsedCount > 0 && (aggregateAiStatus !== 'idle' || aggregateAiSummary);


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <header className="text-center py-3 px-4 border-b border-border">
        <h1 className="text-xl md:text-2xl font-bold text-primary">TravelPerks Deliverability & Authentication Command Center</h1>
      </header>

      <div className="flex-shrink-0 p-3 border-b border-border">
         <XmlUpload onFileUpload={handleFileUpload} disabled={isProcessingFiles} />
          {isProcessingFiles && (
            <div className="flex items-center justify-center mt-2 text-primary text-xs">
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Processing reports...
            </div>
          )}
      </div>
      
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {uploadedReportInfos.length > 0 && !isProcessingFiles && (
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-3">
                    <div>
                        <CardTitle className="text-base flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground"/>Uploaded Reports ({successfullyParsedCount} Parsed)</CardTitle>
                    </div>
                    <div className="flex gap-1.5">
                        <Button onClick={handleCopyToClipboard} variant="outline" size="sm" disabled={successfullyParsedCount === 0}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" />Copy XML
                        </Button>
                        <Button onClick={handleClearReports} variant="outline" size="sm">
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Clear
                        </Button>
                    </div>
                </CardHeader>
                { successfullyParsedCount > 0 &&
                  <CardContent className="px-3 pb-2 text-xs text-muted-foreground">
                    <ScrollArea className="max-h-16"> {/* Limit height of filename list */}
                      Reports: {uploadedReportInfos.map(r => r.fileName).join(', ')}
                    </ScrollArea>
                  </CardContent>
                }
            </Card>
          )}
          
          {!isProcessingFiles && uploadedReportInfos.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 space-y-3">
                <DmarcSnapshot
                  passRate={dmarcPassRateData}
                  authBreakdown={authBreakdownData}
                  policy={mainPolicyPublished}
                  targetDomain={TARGET_DOMAIN}
                />
                <SourceAuthenticationTable data={sourceAuthTableData} />
              </div>
              <div className="lg:col-span-1 space-y-3 flex flex-col"> {/* Ensure this column can flex */}
                {displayIndividualAi && uploadedReportInfos[0]?.parsedReport && (
                  <AiSummary
                    fileName={uploadedReportInfos[0].fileName}
                    summaryOutput={uploadedReportInfos[0].individualAiInsight}
                    isLoading={uploadedReportInfos[0].individualAiStatus === 'loading'}
                    error={uploadedReportInfos[0].individualAiError} 
                  />
                )}
                {displayAggregateAi && (
                  <AggregateAiSummary
                      summaryOutput={aggregateAiSummary}
                      isLoading={aggregateAiStatus === 'loading'}
                      error={aggregateAiError}
                      reportCount={successfullyParsedCount}
                      targetDomain={TARGET_DOMAIN}
                  />
                )}
                 { (successfullyParsedCount > 0 && timelineChartData.length > 0) && 
                    <div className="flex-1 min-h-[200px]"> {/* Ensure charts have min height and can grow */}
                        <EmailVolumeTimelineChart data={timelineChartData} />
                    </div>
                 }
              </div>
            </div>
          )}
          
          {uploadedReportInfos.length === 1 && uploadedReportInfos[0].parsingError && !isProcessingFiles && (
              <Card className="border-destructive">
                  <CardHeader className="pt-2 pb-1 px-3"><CardTitle className="text-destructive text-sm">Error: {uploadedReportInfos[0].fileName}</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2 text-xs"><p>{uploadedReportInfos[0].parsingError}</p></CardContent>
              </Card>
          )}

          {uploadedReportInfos.length === 0 && !isProcessingFiles && (
            <Card className="mt-3">
                <CardContent className="p-4 text-center">
                    <ShieldQuestion className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-md text-muted-foreground">
                        Upload DMARC XML reports to begin.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Drag &amp; drop .xml, .gz, or .zip files.
                    </p>
                </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper function for DMARC Pass Rate (Section I)
function calculateDmarcPassRate(records: DmarcRecord[], targetDomain: string): DmarcPassRate {
  if (records.length === 0) return { percentage: 0, passedEmails: 0, totalEmails: 0 };
  let passedEmails = 0;
  let totalEmailsTargetDomain = 0; // Count only emails where header_from is targetDomain

  records.forEach(record => {
    const headerFromDomain = record.identifiers.headerFrom?.toLowerCase() || "";
    // Consider all emails for total volume in charts, but DMARC pass rate for the target domain specifically
    if (headerFromDomain.endsWith(targetDomain.toLowerCase())) {
      totalEmailsTargetDomain += record.row.count;
      // DMARC pass if SPF aligned OR DKIM aligned
      if (record.row.policyEvaluated.spf === 'pass' || record.row.policyEvaluated.dkim === 'pass') {
        passedEmails += record.row.count;
      }
    }
  });
  return {
    percentage: totalEmailsTargetDomain > 0 ? parseFloat(((passedEmails / totalEmailsTargetDomain) * 100).toFixed(1)) : 0,
    passedEmails: passedEmails, // Passed emails for the target domain
    totalEmails: totalEmailsTargetDomain, // Total emails for the target domain for this specific metric
  };
}

// Helper function for Authentication Breakdown (Section I)
function calculateAuthBreakdown(records: DmarcRecord[], targetDomain: string): AuthenticationBreakdownData {
  const data: AuthenticationBreakdownData = {
    dmarcPass: 0,
    spfAlignedOnly: 0,
    dkimAlignedOnly: 0,
    bothFailedAlign: 0,
    totalEmails: 0,
  };

  records.forEach(record => {
    const headerFromDomain = record.identifiers.headerFrom?.toLowerCase() || "";
     if (!headerFromDomain.endsWith(targetDomain.toLowerCase())) { // Only count emails for the target domain for this breakdown
      return; 
    }
    data.totalEmails += record.row.count; // totalEmails here is for the target domain
    const spfAligned = record.row.policyEvaluated.spf === 'pass';
    const dkimAligned = record.row.policyEvaluated.dkim === 'pass';

    if (spfAligned && dkimAligned) {
      data.dmarcPass += record.row.count;
    } else if (spfAligned && !dkimAligned) {
      data.dmarcPass += record.row.count; 
      data.spfAlignedOnly += record.row.count;
    } else if (!spfAligned && dkimAligned) {
      data.dmarcPass += record.row.count; 
      data.dkimAlignedOnly += record.row.count;
    } else { 
      data.bothFailedAlign += record.row.count;
    }
  });
  return data;
}

// Helper function for Source Authentication Table (Section II)
function calculateSourceAuthData(records: DmarcRecord[], targetDomain: string): SourceAuthRow[] {
  const sourceMap: Map<string, Partial<SourceAuthRow> & { rawRecords: DmarcRecord[], dmarcPassCountTargetDomain: number }> = new Map();

  records.forEach(record => {
    const ip = record.row.sourceIp || 'Unknown IP';
    if (!sourceMap.has(ip)) {
      sourceMap.set(ip, { 
        sourceIp: ip, 
        emailVolume: 0, 
        dmarcPassCount: 0, // Overall DMARC pass for this IP (any domain) - might need adjustment
        dmarcPassCountTargetDomain: 0, // DMARC pass for this IP *for the target domain*
        rawRecords: [] 
      });
    }
    const entry = sourceMap.get(ip)!;
    entry.emailVolume! += record.row.count;
    entry.rawRecords.push(record);

    const headerFromDomain = record.identifiers.headerFrom?.toLowerCase() || "";
    if (headerFromDomain.endsWith(targetDomain.toLowerCase())) {
        if (record.row.policyEvaluated.spf === 'pass' || record.row.policyEvaluated.dkim === 'pass') {
          entry.dmarcPassCountTargetDomain! += record.row.count;
        }
    }
    // For overall dmarcPassCount for an IP (not specific to target domain) - this is what dmarcPassPercent in table implies
     if (record.row.policyEvaluated.spf === 'pass' || record.row.policyEvaluated.dkim === 'pass') {
        entry.dmarcPassCount! += record.row.count;
    }
  });

  return Array.from(sourceMap.values()).map(entry => {
    let spfAuthDomain = 'N/A';
    let spfRawResult = 'N/A';
    let spfDmarcAlignResult: 'pass' | 'fail' = 'fail'; // For the target domain
    
    let dkimAuthDomains: Array<{ domain: string; selector?: string; result: string }> = [];
    let dkimDmarcAlignResult: 'pass' | 'fail' = 'fail'; // For the target domain

    // For SPF/DKIM details, analyze records matching the target domain primarily.
    // If no records for target domain from this IP, use first record as fallback for raw auth details.
    const targetDomainRecord = entry.rawRecords.find(r => (r.identifiers.headerFrom?.toLowerCase() || "").endsWith(targetDomain.toLowerCase()));
    const representativeRecord = targetDomainRecord || (entry.rawRecords.length > 0 ? entry.rawRecords[0] : null);

    if (representativeRecord) {
        // SPF/DKIM DMARC alignment result should be specific to policy_evaluated of records for the target_domain
        // However, policy_evaluated itself is per-record. We simplify for the table.
        // The current `entry.dmarcPassCountTargetDomain` can be used to derive a pass % for the target_domain from this IP.
        // For the simple pass/fail flag in the table, we look at the representative record for the target domain.
        // If no target domain record, these specific alignment flags are less meaningful for the *target domain*.
        if (targetDomainRecord) {
             spfDmarcAlignResult = targetDomainRecord.row.policyEvaluated.spf === 'pass' ? 'pass' : 'fail';
             dkimDmarcAlignResult = targetDomainRecord.row.policyEvaluated.dkim === 'pass' ? 'pass' : 'fail';
        }


      if (representativeRecord.authResults?.spf && representativeRecord.authResults.spf.length > 0) {
        const passingSpf = representativeRecord.authResults.spf.find(s => s.result === 'pass');
        const firstSpf = representativeRecord.authResults.spf[0];
        spfAuthDomain = passingSpf?.domain || firstSpf?.domain || 'N/A';
        spfRawResult = passingSpf?.result || firstSpf?.result || 'N/A';
      }
      if (representativeRecord.authResults?.dkim && representativeRecord.authResults.dkim.length > 0) {
         dkimAuthDomains = representativeRecord.authResults.dkim
          .map(d => ({ domain: d.domain!, selector: d.selector || undefined, result: d.result! }))
          .filter(d => d.result === 'pass' && d.domain) // Only show passing DKIM domains
          .slice(0, 2); 
      }
    }
    
    // dmarcPassPercent in the table should reflect DMARC passes for the TARGET_DOMAIN from this IP
    const emailVolumeForTargetDomainFromThisIp = entry.rawRecords
        .filter(r => (r.identifiers.headerFrom?.toLowerCase() || "").endsWith(targetDomain.toLowerCase()))
        .reduce((sum, r) => sum + r.row.count, 0);

    return {
      sourceIp: entry.sourceIp!,
      emailVolume: entry.emailVolume!, // Total volume from this IP
      // dmarcPassCount: entry.dmarcPassCount!, // Not used directly in table, dmarcPassCountTargetDomain is
      dmarcPassCount: entry.dmarcPassCountTargetDomain!, // DMARC passes for target domain from this IP
      dmarcPassPercent: emailVolumeForTargetDomainFromThisIp > 0 
                        ? parseFloat(((entry.dmarcPassCountTargetDomain! / emailVolumeForTargetDomainFromThisIp) * 100).toFixed(1)) 
                        : 0,
      spfDmarcAlignResult,
      spfAuthDomain,
      spfRawResult,
      dkimDmarcAlignResult,
      dkimAuthDomains,
    };
  }).sort((a,b) => b.emailVolume - a.emailVolume);
}

