

"use client";

import type { TimelineChartData } from '@/types/dmarc';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

interface EmailVolumeTimelineChartProps {
  data: TimelineChartData[];
}

export function EmailVolumeTimelineChart({ data }: EmailVolumeTimelineChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-md flex-1">
        <CardHeader className="pt-2 pb-1 px-3">
          <CardTitle className="flex items-center text-sm"><CalendarDays className="mr-2 h-4 w-4" /> Email Volume Over Time</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2 flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No data for timeline. Upload multiple reports with date ranges.</p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-1.5 bg-background border border-border rounded shadow-lg text-xs">
          <p className="label text-foreground">{`Date: ${label}`}</p>
          <p className="intro text-primary">{`Volume: ${payload[0].value.toLocaleString()}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-md flex-1 flex flex-col min-h-[200px]">
      <CardHeader className="pt-2 pb-1 px-3">
        <CardTitle className="flex items-center text-sm"><CalendarDays className="mr-2 h-4 w-4" /> Email Volume Over Time</CardTitle>
        <CardDescription className="text-xs">Total email volume reported per day.</CardDescription>
      </CardHeader>
      <CardContent className="px-1 pb-1 pt-2 flex-1"> {/* Allow chart to fill space */}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 15, // Reduced right margin
              left: -10,  // Reduced left margin
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
            <XAxis dataKey="date" stroke="hsl(var(--foreground))" tick={{ fontSize: 9 }} dy={5} />
            <YAxis stroke="hsl(var(--foreground))" tick={{ fontSize: 9 }} dx={-5} tickFormatter={(value) => {
                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                return value.toString();
            }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '10px', color: 'hsl(var(--foreground))' }} iconSize={8}/>
            <Line type="monotone" dataKey="volume" name="Email Volume" stroke="hsl(var(--primary))" activeDot={{ r: 6 }} strokeWidth={1.5} dot={{r: 2}} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

