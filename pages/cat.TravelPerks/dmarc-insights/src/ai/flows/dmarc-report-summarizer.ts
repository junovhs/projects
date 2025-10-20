// src/ai/flows/dmarc-report-summarizer.ts
'use server';

/**
 * @fileOverview DMARC Report Summarization AI Flow.
 *
 * This file defines a Genkit flow that takes a DMARC report XML as input, analyzes it,
 * and provides a concise analysis.
 *
 * - summarizeDmarcReport - The main function to summarize a DMARC report.
 * - SummarizeDmarcReportInput - The input type for the summarizeDmarcReport function.
 * - SummarizeDmarcReportOutput - The output type for the summarizeDmarcReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeDmarcReportInputSchema = z.object({
  dmarcReportXml: z
    .string()
    .describe('The DMARC report XML content as a string.'),
});
export type SummarizeDmarcReportInput = z.infer<typeof SummarizeDmarcReportInputSchema>;

const SummarizeDmarcReportOutputSchema = z.object({
  analysis: z.string().describe('A concise analysis (MAXIMUM 50 WORDS) covering the main finding, one key potential issue, and one primary actionable step.'),
});
export type SummarizeDmarcReportOutput = z.infer<typeof SummarizeDmarcReportOutputSchema>;

export async function summarizeDmarcReport(input: SummarizeDmarcReportInput): Promise<SummarizeDmarcReportOutput> {
  return summarizeDmarcReportFlow(input);
}

const summarizeDmarcReportPrompt = ai.definePrompt({
  name: 'summarizeDmarcReportPrompt',
  input: {schema: SummarizeDmarcReportInputSchema},
  output: {schema: SummarizeDmarcReportOutputSchema},
  prompt: `You are an expert in DMARC report analysis. Analyze the provided DMARC report XML.
Provide a concise analysis (MAXIMUM 50 WORDS) covering the main finding, one key potential issue, and one primary actionable step.

DMARC Report XML:
{{{dmarcReportXml}}}

Concise Analysis:
{{analysis}}`,
});

const summarizeDmarcReportFlow = ai.defineFlow(
  {
    name: 'summarizeDmarcReportFlow',
    inputSchema: SummarizeDmarcReportInputSchema,
    outputSchema: SummarizeDmarcReportOutputSchema,
  },
  async input => {
    const {output} = await summarizeDmarcReportPrompt(input);
    return output!;
  }
);
