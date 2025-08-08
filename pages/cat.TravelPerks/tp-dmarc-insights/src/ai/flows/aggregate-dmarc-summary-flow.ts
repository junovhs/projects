
// src/ai/flows/aggregate-dmarc-summary-flow.ts
'use server';

/**
 * @fileOverview Aggregate DMARC Report Summarization AI Flow for TravelPerks Command Center.
 *
 * This file defines a Genkit flow that takes multiple DMARC reports, analyzes them collectively,
 * and provides structured, actionable recommendations focusing on critical issues, monitoring points,
 * and overall DMARC posture improvements.
 *
 * - generateAggregateDmarcSummary - The main function for aggregate summarization.
 * - AggregateDmarcSummaryInput - Input type.
 * - AggregateDmarcSummaryOutput - Output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReportInfoSchema = z.object({
  fileName: z.string().describe('The original filename of the DMARC report.'),
  xmlContent: z.string().describe('The DMARC report XML content as a string.'),
  reportDate: z.string().optional().describe('The end date of the report period (e.g., YYYY-MM-DD), if available, for timeline context.'),
  policyDomain: z.string().optional().describe('The domain for which the DMARC policy was published (e.g., travelperks.com).'),
});

const AggregateDmarcSummaryInputSchema = z.object({
  reports: z.array(ReportInfoSchema).min(1).describe('An array of DMARC reports to analyze.'),
  targetDomain: z.string().default('travelperks.com').describe('The primary domain being analyzed, e.g., travelperks.com.'),
  overallDmarcPassRate: z.number().optional().describe('The overall DMARC pass rate calculated from the reports (e.g., 98.5 for 98.5%).'),
  topFailingSources: z.array(z.object({
    sourceIp: z.string(),
    volume: z.number(),
    dmarcFailPercent: z.number(),
    reason: z.string().describe("Brief reason for failure, e.g., 'SPF Misaligned, DKIM Fail', 'DKIM Misaligned'"),
  })).max(3).optional().describe('Up to 3 top sources failing DMARC, with volume and primary failure reason.'),
});
export type AggregateDmarcSummaryInput = z.infer<typeof AggregateDmarcSummaryInputSchema>;

// This schema was intended to be updated in the previous turn based on "pivot" feedback.
// The user's current file context shows this older version.
// The current error is in AggregateDmarcSummaryInputSchema, so this might not be an immediate issue yet,
// but it's a discrepancy to note.
const RecommendationSchema = z.object({
  severity: z.enum(["CRITICAL", "MONITOR", "ATTENTION", "GOOD", "INFO"]).describe("Severity level of the recommendation."),
  message: z.string().describe("The recommendation text. Maximum 60 words."),
  details: z.array(z.string()).optional().describe("Optional bullet points for more details or specific examples, each max 30 words."),
});

const AggregateDmarcSummaryOutputSchema = z.object({
  executiveSummary: z.string().describe("A very brief (1-2 sentence, max 40 words) high-level summary of the DMARC situation for the target domain."),
  recommendations: z.array(RecommendationSchema).min(1).max(5).describe("An array of 2-5 actionable recommendations, prioritized by severity."),
});

/*
// This was the intended schema based on the previous "pivot" response:
const AggregateDmarcSummaryOutputSchema = z.object({
  overallStatus: z.string().describe("A brief (1-2 sentence) overview of the current DMARC health and policy effectiveness based on the aggregated reports. Max 40 words."),
  keyObservations: z.array(z.string()).min(1).max(4).describe("An array of 2-4 bullet points highlighting the most significant trends, common issues, or critical points observed across all reports. Each observation max 30 words."),
  actionableRecommendations: z.array(z.string()).min(1).max(3).describe("An array of 2-3 concrete, actionable steps the user should consider to improve their DMARC configuration or address identified issues. Each recommendation max 40 words."),
});
*/
export type AggregateDmarcSummaryOutput = z.infer<typeof AggregateDmarcSummaryOutputSchema>;


export async function generateAggregateDmarcSummary(input: AggregateDmarcSummaryInput): Promise<AggregateDmarcSummaryOutput> {
  return aggregateDmarcSummaryFlow(input);
}

// The prompt below corresponds to the OLDER AggregateDmarcSummaryOutputSchema.
// It should be updated if the schema is changed to overallStatus, keyObservations, actionableRecommendations.
const aggregateDmarcSummaryPrompt = ai.definePrompt({
  name: 'aggregateDmarcSummaryPrompt',
  input: {schema: AggregateDmarcSummaryInputSchema},
  output: {schema: AggregateDmarcSummaryOutputSchema},
  prompt: `You are an expert DMARC and email deliverability analyst for {{targetDomain}}.
Analyze the provided DMARC report data and context to generate actionable recommendations.

Context:
- Target Domain: {{targetDomain}}
{{#if overallDmarcPassRate}}
- Overall DMARC Pass Rate: {{overallDmarcPassRate}}%
{{/if}}
{{#if topFailingSources.length}}
- Top Failing Sources (by DMARC failures):
  {{#each topFailingSources}}
  - IP: {{this.sourceIp}}, Volume: {{this.volume}}, DMARC Fail Rate: {{this.dmarcFailPercent}}%, Reason: {{this.reason}}
  {{/each}}
{{/if}}

DMARC Reports Summary:
{{#each reports}}
Report File: {{this.fileName}}
{{#if this.reportDate}}Report End Date: {{this.reportDate}}{{/if}}
{{#if this.policyDomain}}Policy Domain: {{this.policyDomain}}{{/if}}
Relevant XML Snippets (focus on policy_evaluated, identifiers, auth_results for failing/misaligned messages if any):
{{{this.xmlContent}}}
---
{{/each}}

Based on ALL the provided information, generate:
1.  **Executive Summary (Max 40 words):** A high-level overview for {{targetDomain}}.
2.  **Actionable Recommendations (2-5 recommendations, each message max 60 words, detail bullets max 30 words each):**
    Use the following severity levels: CRITICAL, MONITOR, ATTENTION, GOOD, INFO.
    Prioritize CRITICAL issues.
    Format recommendations clearly (e.g., "CRITICAL: DKIM for {{targetDomain}} is failing for Microsoft 365/Outlook IPs...").
    If issues are noted for specific ESPs (e.g., Constant Contact, Microsoft 365), mention them if identifiable from report data or context.
    If an SPF or DKIM domain is misaligned but expected for a known ESP, label it as INFO or GOOD if DKIM covers it.
    Example structure for a recommendation:
    {
      "severity": "CRITICAL",
      "message": "DKIM for travelperks.com is consistently failing for emails originating from Microsoft 365 IPs. This severely impacts deliverability to recipients.",
      "details": ["Configure DKIM for travelperks.com in your M365 admin center.", "Verify the selector and key are correct."]
    }
    {
      "severity": "MONITOR",
      "message": "DKIM for travelperks.com from Constant Contact IPs showed some failures. Continue monitoring.",
      "details": ["If persists, escalate to CC support with IP examples from reports."]
    }
    {
      "severity": "GOOD",
      "message": "SPF alignment from Constant Contact IPs is generally passing after recent record updates."
    }

Provide ONLY the JSON output adhering to AggregateDmarcSummaryOutputSchema.
`,
/*
// This was the intended prompt structure for the NEW OutputSchema
  prompt: `You are an expert DMARC and email deliverability analyst for {{targetDomain}}.
Analyze the provided DMARC report data and context.

Context:
- Target Domain: {{targetDomain}}
{{#if overallDmarcPassRate}}
- Overall DMARC Pass Rate: {{overallDmarcPassRate}}%
{{/if}}
{{#if topFailingSources.length}}
- Top Failing Sources (by DMARC failures):
  {{#each topFailingSources}}
  - IP: {{this.sourceIp}}, Volume: {{this.volume}}, DMARC Fail Rate: {{this.dmarcFailPercent}}%, Reason: {{this.reason}}
  {{/each}}
{{/if}}

DMARC Reports Information:
{{#each reports}}
Report File: {{this.fileName}}
{{#if this.reportDate}}Report End Date: {{this.reportDate}}{{/if}}
{{#if this.policyDomain}}Policy Domain: {{this.policyDomain}}{{/if}}
Relevant XML Snippets (focus on policy_evaluated, identifiers, auth_results for failing/misaligned messages if any):
{{{this.xmlContent}}}
---
{{/each}}

Based on ALL the provided information, generate:
1.  **Overall Status (Max 40 words):** A brief (1-2 sentence) overview of the current DMARC health and policy effectiveness for {{targetDomain}}.
2.  **Key Observations (2-4 bullet points, each max 30 words):** Highlight the most significant trends, common issues, or critical points observed across all reports. Focus on changes if multiple report dates are available.
3.  **Actionable Recommendations (2-3 bullet points, each max 40 words):** Provide concrete, actionable steps the user should consider to improve their DMARC configuration or address identified issues. Start critical recommendations with "CRITICAL:", monitoring with "MONITOR:", less urgent with "ATTENTION:", positive notes with "GOOD:", and informational with "INFO:".

Example for a recommendation: "CRITICAL: DKIM for travelperks.com is failing for Microsoft 365/Outlook IPs. Configure DKIM for travelperks.com in your M365 admin center."
Another example: "MONITOR: DKIM for travelperks.com from Constant Contact IPs showed X% failure on [date]. Continue monitoring."

Provide ONLY the JSON output adhering to the AggregateDmarcSummaryOutputSchema (overallStatus, keyObservations, actionableRecommendations).
`,
*/
});

const aggregateDmarcSummaryFlow = ai.defineFlow(
  {
    name: 'aggregateDmarcSummaryFlow',
    inputSchema: AggregateDmarcSummaryInputSchema,
    outputSchema: AggregateDmarcSummaryOutputSchema,
  },
  async (input) => {
    // Limit XML content length passed to AI to avoid overly large prompts
    const processedInput = {
      ...input,
      reports: input.reports.map(report => ({
        ...report,
        xmlContent: report.xmlContent.length > 10000 ? report.xmlContent.substring(0, 10000) + "\n...[TRUNCATED]" : report.xmlContent,
      })),
    };
    const {output} = await aggregateDmarcSummaryPrompt(processedInput);
    return output!;
  }
);

