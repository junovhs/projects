
"use client";

import React, { useState, useMemo } from 'react';
import type { SourceAuthRow } from '@/types/dmarc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, CheckCircle2, XCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SourceAuthenticationTableProps {
  data: SourceAuthRow[];
}

type SortKey = keyof SourceAuthRow | null;
type SortDirection = 'asc' | 'desc';

export function SourceAuthenticationTable({ data }: SourceAuthenticationTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('emailVolume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      let comparison = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = valA === valB ? 0 : valA ? -1 : 1;
      }
      // Add more type comparisons if needed

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />;
    return sortDirection === 'asc' ? <ArrowUpDown className="ml-1 h-3 w-3" /> : <ArrowUpDown className="ml-1 h-3 w-3" />; // Could use different icons for asc/desc
  };
  
  const getPassFailColor = (value: number | string, threshold = 95, isPercent = true) => {
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'pass') return 'text-green-600'; // Theme this
        if (value.toLowerCase() === 'fail') return 'text-destructive';
        return 'text-muted-foreground';
    }
    if (isPercent) {
        if (value >= threshold) return 'text-green-600';
        if (value >= 80) return 'text-yellow-500'; // Theme this
        return 'text-destructive';
    }
    return 'text-foreground';
  };


  if (!data || data.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-base flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Source-Specific Authentication</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <p className="text-xs text-muted-foreground">No source data available from reports.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md flex-1 flex flex-col min-h-[300px]"> {/* Ensure card takes available space */}
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-base flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Source-Specific Authentication Deep Dive</CardTitle>
        <CardDescription className="text-xs">Email sources and their DMARC authentication status.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-1 pt-0 flex-1 overflow-hidden"> {/* Allow content to grow and scroll */}
        <ScrollArea className="h-full w-full">
          <Table className="text-[0.7rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 px-2 py-1 whitespace-nowrap">
                  <Button variant="ghost" size="sm" className="text-[0.7rem] p-0 h-auto" onClick={() => requestSort('sourceIp')}>
                    Source IP {getSortIndicator('sourceIp')}
                  </Button>
                </TableHead>
                {/* <TableHead className="h-7 px-2 py-1">ISP/Owner</TableHead> Placeholder */}
                <TableHead className="h-7 px-2 py-1 whitespace-nowrap">
                   <Button variant="ghost" size="sm" className="text-[0.7rem] p-0 h-auto" onClick={() => requestSort('emailVolume')}>
                    Volume {getSortIndicator('emailVolume')}
                  </Button>
                </TableHead>
                <TableHead className="h-7 px-2 py-1 whitespace-nowrap">
                  <Button variant="ghost" size="sm" className="text-[0.7rem] p-0 h-auto" onClick={() => requestSort('dmarcPassPercent')}>
                    DMARC Pass % {getSortIndicator('dmarcPassPercent')}
                  </Button>
                </TableHead>
                <TableHead className="h-7 px-2 py-1 whitespace-nowrap">SPF Align</TableHead>
                <TableHead className="h-7 px-2 py-1">SPF Auth Domain (Raw)</TableHead>
                <TableHead className="h-7 px-2 py-1 whitespace-nowrap">DKIM Align</TableHead>
                <TableHead className="h-7 px-2 py-1">DKIM Auth Domains (Raw)</TableHead>
                {/* <TableHead className="h-7 px-2 py-1">Insight/Flag</TableHead> Placeholder */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row) => (
                <TableRow key={row.sourceIp} className="hover:bg-muted/20">
                  <TableCell className="px-2 py-0.5 font-mono">{row.sourceIp}</TableCell>
                  {/* <TableCell className="px-2 py-0.5">{row.sourceIspOwner || 'N/A'}</TableCell> */}
                  <TableCell className={`px-2 py-0.5 text-right ${getPassFailColor(row.emailVolume, 0, false)}`}>{row.emailVolume.toLocaleString()}</TableCell>
                  <TableCell className={`px-2 py-0.5 text-right ${getPassFailColor(row.dmarcPassPercent)}`}>
                    {row.dmarcPassPercent.toFixed(1)}%
                  </TableCell>
                  <TableCell className={`px-2 py-0.5 ${getPassFailColor(row.spfDmarcAlignResult)}`}>
                     <div className="flex items-center">
                        {row.spfDmarcAlignResult === 'pass' ? <CheckCircle2 className="h-3 w-3 mr-1"/> : <XCircle className="h-3 w-3 mr-1"/>} 
                        {row.spfDmarcAlignResult}
                     </div>
                  </TableCell>
                  <TableCell className="px-2 py-0.5">{row.spfAuthDomain} <span className="text-muted-foreground/70">({row.spfRawResult})</span></TableCell>
                  <TableCell className={`px-2 py-0.5 ${getPassFailColor(row.dkimDmarcAlignResult)}`}>
                    <div className="flex items-center">
                        {row.dkimDmarcAlignResult === 'pass' ? <CheckCircle2 className="h-3 w-3 mr-1"/> : <XCircle className="h-3 w-3 mr-1"/>}
                        {row.dkimDmarcAlignResult}
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-0.5">
                    {row.dkimAuthDomains.length > 0 ? 
                        row.dkimAuthDomains.map(d => 
                            <div key={d.domain + (d.selector || '')} title={`Selector: ${d.selector || 'none'}, Result: ${d.result}`}>
                                {d.domain} <span className="text-muted-foreground/70">({d.result})</span>
                            </div>
                        ).reduce((prev, curr) => <>{prev}<br/>{curr}</>)
                        : 'N/A'
                    }
                  </TableCell>
                  {/* <TableCell className="px-2 py-0.5">{row.actionableInsight || '-'}</TableCell> */}
                </TableRow>
              ))}
            </TableBody><TableCaption className="text-[0.65rem] py-1">
                SPF/DKIM Align refers to DMARC alignment. (Raw) shows authenticaing domain from raw checks.
             </TableCaption>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
