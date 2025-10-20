"use client";

import type { DmarcRecord, ChartData } from '@/types/dmarc';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChartBig } from 'lucide-react';

interface SourceIpChartProps {
  records: DmarcRecord[] | null;
}

const TOP_N_IPS = 10; // Show top N IPs

export function SourceIpChart({ records }: SourceIpChartProps) {
  if (!records || records.length === 0) {
    return (
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChartBig className="mr-2 h-6 w-6" /> Email Volume by Source IP</CardTitle>
          <CardDescription>Top {TOP_N_IPS} sending IP addresses.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available to display chart.</p>
        </CardContent>
      </Card>
    );
  }

  const ipCounts: { [ip: string]: number } = {};
  records.forEach(record => {
    const ip = record.row.sourceIp || 'Unknown IP';
    ipCounts[ip] = (ipCounts[ip] || 0) + record.row.count;
  });

  const sortedIps = Object.entries(ipCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_N_IPS);

  const chartData: ChartData[] = sortedIps.map(([name, value]) => ({
    name,
    value,
    fill: "hsl(var(--primary))", // Use primary color from theme
  }));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><BarChartBig className="mr-2 h-6 w-6" /> Email Volume by Source IP</CardTitle>
        <CardDescription>Top {TOP_N_IPS} sending IP addresses.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--foreground))" />
            <YAxis 
              type="category" 
              dataKey="name" 
              stroke="hsl(var(--foreground))" 
              width={150}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
            <Bar dataKey="value" name="Email Count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
