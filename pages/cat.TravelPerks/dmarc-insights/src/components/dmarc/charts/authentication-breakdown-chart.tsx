
"use client";

import type { AuthenticationBreakdownData, ChartData } from '@/types/dmarc';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AuthenticationBreakdownChartProps {
  data: AuthenticationBreakdownData;
}

const COLORS = {
  dmarcPass: 'hsl(var(--chart-2))', // Teal-ish (Good)
  spfOnly: 'hsl(var(--chart-1))', // Primary color (Okay, but investigate DKIM)
  dkimOnly: 'hsl(var(--chart-3))', // Purple-ish (Okay, but investigate SPF)
  bothFail: 'hsl(var(--destructive))', // Red (Bad)
};

export function AuthenticationBreakdownChart({ data }: AuthenticationBreakdownChartProps) {
  if (!data || data.totalEmails === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No authentication data to display.</p>;
  }

  // For the pie chart, we are interested in the components of DMARC evaluation results.
  // DMARC pass = (SPF aligned OR DKIM aligned). This is the green slice.
  // We want to show what contributes to DMARC failures or partial passes.
  
  // DMARC Pass (SPF Align OR DKIM Align)
  // SPF Aligned, DKIM Failed Align
  // DKIM Aligned, SPF Failed Align
  // Both Failed Align (DMARC Fail)

  // Let's adjust the chartData to reflect the breakdown more directly for pie slices:
  // 1. Total DMARC Pass (SPF or DKIM or Both Aligned) - This is data.dmarcPass
  // 2. DMARC Fail (Neither SPF nor DKIM Aligned) - This is data.bothFailedAlign

  // A more nuanced breakdown for the pie chart:
  const chartData: ChartData[] = [];

  // Calculate actual "SPF Aligned & DKIM Aligned"
  // data.dmarcPass = (spf_aligned_AND_dkim_aligned) + data.spfAlignedOnly + data.dkimAlignedOnly
  // So, (spf_aligned_AND_dkim_aligned) = data.dmarcPass - data.spfAlignedOnly - data.dkimAlignedOnly
  const spfAndDkimAligned = data.dmarcPass - data.spfAlignedOnly - data.dkimAlignedOnly;

  if (spfAndDkimAligned > 0) {
    chartData.push({ name: 'DMARC Pass (SPF & DKIM Aligned)', value: spfAndDkimAligned, fill: COLORS.dmarcPass });
  }
  if (data.spfAlignedOnly > 0) {
    chartData.push({ name: 'DMARC Pass (SPF Aligned, DKIM Misaligned)', value: data.spfAlignedOnly, fill: COLORS.spfOnly });
  }
  if (data.dkimAlignedOnly > 0) {
    chartData.push({ name: 'DMARC Pass (DKIM Aligned, SPF Misaligned)', value: data.dkimAlignedOnly, fill: COLORS.dkimOnly });
  }
  if (data.bothFailedAlign > 0) {
    chartData.push({ name: 'DMARC Fail (Both Misaligned)', value: data.bothFailedAlign, fill: COLORS.bothFail });
  }
  
  if (chartData.length === 0 && data.totalEmails > 0) {
     // This case should ideally not happen if data processing is correct
     // but as a fallback if all categories are 0 but totalEmails > 0
     chartData.push({ name: 'Total Emails', value: data.totalEmails, fill: 'hsl(var(--muted))'});
  }


  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percent = ((payload[0].value / data.totalEmails) * 100).toFixed(1);
      return (
        <div className="p-1.5 bg-background border border-border rounded shadow-lg text-xs">
          <p className="font-semibold">{payload[0].name}</p>
          <p>{`Emails: ${payload[0].value.toLocaleString()} (${percent}%)`}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <ResponsiveContainer width="100%" height={120}> 
      <RechartsPieChart>
        <Pie 
          data={chartData} 
          dataKey="value" 
          nameKey="name" 
          cx="50%" 
          cy="50%" 
          outerRadius={50} 
          innerRadius={25} // Donut chart
          labelLine={false}
          // label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
          //   const RADIAN = Math.PI / 180;
          //   const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          //   const x = cx + radius * Math.cos(-midAngle * RADIAN);
          //   const y = cy + radius * Math.sin(-midAngle * RADIAN);
          //   return (percent * 100) > 5 ? ( // Only show label if > 5%
          //     <text x={x} y={y} fill="hsl(var(--card-foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px">
          //       {`${(percent * 100).toFixed(0)}%`}
          //     </text>
          //   ) : null;
          // }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={1} stroke="hsl(var(--background))" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend 
            layout="vertical" 
            align="right" 
            verticalAlign="middle" 
            iconSize={8}
            wrapperStyle={{ fontSize: '10px', lineHeight: '12px', color: 'hsl(var(--foreground))' }}
            formatter={(value, entry) => {
                 const itemValue = entry.payload?.value;
                 const percentage = data.totalEmails > 0 ? ((itemValue / data.totalEmails) * 100).toFixed(0) : 0;
                 return <span title={value}>{`${value} (${percentage}%)`}</span>;
            }}
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
