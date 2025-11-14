import { config } from 'dotenv';
config();

import '@/ai/flows/dmarc-report-summarizer.ts';
import '@/ai/flows/aggregate-dmarc-summary-flow.ts';
