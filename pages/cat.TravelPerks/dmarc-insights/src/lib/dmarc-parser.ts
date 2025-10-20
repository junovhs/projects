import type { DmarcReport, ReportMetadata, PolicyPublished, DmarcRecord, PolicyEvaluated, Identifiers, AuthResults, DkimAuthResult, SpfAuthResult } from '@/types/dmarc';

function getTextContent(element: Element | null, query: string): string | null {
  const node = element?.querySelector(query);
  return node?.textContent?.trim() || null;
}

function getNumberContent(element: Element | null, query: string): number | null {
  const text = getTextContent(element, query);
  return text ? parseInt(text, 10) : null;
}

function getElementArray(parentElement: Element | null, tagName: string): Element[] {
  if (!parentElement) return [];
  const elements = parentElement.getElementsByTagName(tagName);
  return Array.from(elements);
}

export function parseDmarcXml(xmlString: string): DmarcReport | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");
    const feedbackNode = doc.querySelector("feedback");

    if (!feedbackNode) {
      console.error("No feedback node found in XML");
      return null;
    }

    const reportMetadataNode = feedbackNode.querySelector("report_metadata");
    const reportMetadata: ReportMetadata = {
      orgName: getTextContent(reportMetadataNode, "org_name"),
      email: getTextContent(reportMetadataNode, "email"),
      reportId: getTextContent(reportMetadataNode, "report_id"),
      dateRange: {
        begin: getNumberContent(reportMetadataNode?.querySelector("date_range"), "begin"),
        end: getNumberContent(reportMetadataNode?.querySelector("date_range"), "end"),
      },
    };

    const policyPublishedNode = feedbackNode.querySelector("policy_published");
    const policyPublished: PolicyPublished = {
      domain: getTextContent(policyPublishedNode, "domain"),
      adkim: getTextContent(policyPublishedNode, "adkim"),
      aspf: getTextContent(policyPublishedNode, "aspf"),
      p: getTextContent(policyPublishedNode, "p"),
      sp: getTextContent(policyPublishedNode, "sp"),
      pct: getNumberContent(policyPublishedNode, "pct"),
      fo: getTextContent(policyPublishedNode, "fo"),
    };

    const recordNodes = Array.from(feedbackNode.querySelectorAll("record"));
    const records: DmarcRecord[] = recordNodes.map(recordNode => {
      const rowNode = recordNode.querySelector("row");
      const policyEvaluatedNode = rowNode?.querySelector("policy_evaluated");
      const identifiersNode = recordNode.querySelector("identifiers");
      const authResultsNode = recordNode.querySelector("auth_results");

      const policyEvaluated: PolicyEvaluated = {
        disposition: getTextContent(policyEvaluatedNode, "disposition"),
        dkim: getTextContent(policyEvaluatedNode, "dkim"),
        spf: getTextContent(policyEvaluatedNode, "spf"),
      };
      
      const identifiers: Identifiers = {
        headerFrom: getTextContent(identifiersNode, "header_from"),
        envelopeFrom: getTextContent(identifiersNode, "envelope_from"),
      };

      const dkimAuthResults: DkimAuthResult[] = getElementArray(authResultsNode, 'dkim').map(dkimNode => ({
        domain: getTextContent(dkimNode, "domain"),
        result: getTextContent(dkimNode, "result"),
        selector: getTextContent(dkimNode, "selector"),
      }));

      const spfAuthResults: SpfAuthResult[] = getElementArray(authResultsNode, 'spf').map(spfNode => ({
        domain: getTextContent(spfNode, "domain"),
        result: getTextContent(spfNode, "result"),
        scope: getTextContent(spfNode, "scope"),
      }));
      
      const authResults: AuthResults | undefined = authResultsNode ? {
        dkim: dkimAuthResults,
        spf: spfAuthResults,
      } : undefined;

      return {
        row: {
          sourceIp: getTextContent(rowNode, "source_ip"),
          count: getNumberContent(rowNode, "count") || 0,
          policyEvaluated,
        },
        identifiers,
        authResults,
      };
    });

    return {
      reportMetadata,
      policyPublished,
      records,
    };
  } catch (error) {
    console.error("Error parsing DMARC XML:", error);
    return null;
  }
}
