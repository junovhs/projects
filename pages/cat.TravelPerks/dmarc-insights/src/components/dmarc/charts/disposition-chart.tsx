
"use client";

import type { DmarcRecord, ChartData } from '@/types/dmarc';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck, ShieldQuestion, PieChartIcon } from 'lucide-react'; // Renamed PieChart to PieChartIcon

interface DispositionChartProps {
  records: DmarcRecord[] | null;
}

const DISPOSITION_COLORS = {
  none: 'hsl(var(--chart-4))', // Yellow-ish
  quarantine: 'hsl(var(--chart-5))', // Orange-ish
  reject: 'hsl(var(--destructive))', // Red
  other: 'hsl(var(--muted))',
};

export function DispositionChart({ records }: DispositionChartProps) {
  if (!records || records.length === 0) {
    return (
      <Card>
        <CardHeader className="pt-2 pb-1 px-3">
          <CardTitle className="flex items-center text-sm"><PieChartIcon className="mr-2 h-4 w-4" /> DMARC Policy Disposition</CardTitle>
          <CardDescription  className="text-xs">Distribution of applied DMARC policies.</CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          <p className="text-xs text-muted-foreground">No data available.</p>
        </CardContent>
      </Card>
    );
  }

  let noneCount = 0;
  let quarantineCount = 0;
  let rejectCount = 0;
  let otherCount = 0;
  let totalProcessed = 0;

  records.forEach(record => {
    const count = record.row.count;
    totalProcessed += count;
    const disposition = record.row.policyEvaluated.disposition?.toLowerCase();

    if (disposition === 'none') noneCount += count;
    else if (disposition === 'quarantine') quarantineCount += count;
    else if (disposition === 'reject') rejectCount += count;
    else otherCount += count;
  });

  const chartData: ChartData[] = [];
  if (noneCount > 0) chartData.push({ name: 'None', value: noneCount, fill: DISPOSITION_COLORS.none });
  if (quarantineCount > 0) chartData.push({ name: 'Quarantine', value: quarantineCount, fill: DISPOSITION_COLORS.quarantine });
  if (rejectCount > 0) chartData.push({ name: 'Reject', value: rejectCount, fill: DISPOSITION_COLORS.reject });
  
  // Only add "Other" if it's the only category or makes up the rest of totalProcessed emails
  if (otherCount > 0 && chartData.length === 0) {
     chartData.push({ name: 'Other/Undisposed', value: otherCount, fill: DISPOSITION_COLORS.other });
  } else if (otherCount > 0 && (noneCount + quarantineCount + rejectCount < totalProcessed)) {
     chartData.push({ name: 'Other/Undisposed', value: totalProcessed - (noneCount + quarantineCount + rejectCount), fill: DISPOSITION_COLORS.other });
  }


  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percent = totalProcessed > 0 ? ((payload[0].value / totalProcessed) * 100).toFixed(1) : 0;
      return (
        <div className="p-1.5 bg-background border border-border rounded shadow-lg text-xs">
           <p className="font-semibold">{`${payload[0].name}`}</p>
           <p>{`Emails: ${payload[0].value.toLocaleString()} (${percent}%)`}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pt-2 pb-1 px-3">
        <CardTitle className="flex items-center text-sm"><PieChartIcon className="mr-2 h-4 w-4" /> DMARC Policy Disposition</CardTitle>
        <CardDescription className="text-xs">Distribution of applied DMARC policies.</CardDescription>
      </CardHeader>
      <CardContent className="px-1 pb-1 pt-0">
        <ResponsiveContainer width="100%" height={150}>
          <RechartsPieChart>
            <Pie 
                data={chartData} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={50} 
                innerRadius={25}
                labelLine={false}
                // label={({ name, percent }) => (percent * 100) > 3 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={1}/>
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
                iconSize={8} 
                wrapperStyle={{ fontSize: '10px', color: 'hsl(var(--foreground))', paddingTop: '5px' }}
                formatter={(value, entry) => {
                    const itemValue = entry.payload?.value || 0;
                    const percentage = totalProcessed > 0 ? ((itemValue / totalProcessed) * 100).toFixed(0) : 0;
                    return <span title={value}>{`${value} (${percentage}%)`}</span>;
                }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
