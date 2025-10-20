"use client";

import type { DmarcRecord, ChartData } from '@/types/dmarc';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, PieChart } from 'lucide-react'; // Lucide PieChart for title

interface AuthResultsChartProps {
  records: DmarcRecord[] | null;
}

const COLORS = {
  pass: 'hsl(var(--chart-2))', // Teal-ish accent
  fail: 'hsl(var(--destructive))',
  other: 'hsl(var(--muted))',
};

export function AuthResultsChart({ records }: AuthResultsChartProps) {
  if (!records || records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><PieChart className="mr-2 h-6 w-6" /> Authentication Results</CardTitle>
          <CardDescription>SPF and DKIM pass/fail rates based on policy evaluation.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available to display charts.</p>
        </CardContent>
      </Card>
    );
  }

  let spfPass = 0;
  let spfFail = 0;
  let spfOther = 0;
  let dkimPass = 0;
  let dkimFail = 0;
  let dkimOther = 0;

  records.forEach(record => {
    const count = record.row.count;
    const spfResult = record.row.policyEvaluated.spf?.toLowerCase();
    const dkimResult = record.row.policyEvaluated.dkim?.toLowerCase();

    if (spfResult === 'pass') spfPass += count;
    else if (spfResult === 'fail') spfFail += count;
    else spfOther += count;

    if (dkimResult === 'pass') dkimPass += count;
    else if (dkimResult === 'fail') dkimFail += count;
    else dkimOther += count;
  });

  const spfData: ChartData[] = [
    { name: 'SPF Pass', value: spfPass, fill: COLORS.pass },
    { name: 'SPF Fail', value: spfFail, fill: COLORS.fail },
  ];
  if (spfOther > 0) spfData.push({ name: 'SPF Other', value: spfOther, fill: COLORS.other });


  const dkimData: ChartData[] = [
    { name: 'DKIM Pass', value: dkimPass, fill: COLORS.pass },
    { name: 'DKIM Fail', value: dkimFail, fill: COLORS.fail },
  ];
  if (dkimOther > 0) dkimData.push({ name: 'DKIM Other', value: dkimOther, fill: COLORS.other });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background border border-border rounded shadow-lg">
          <p className="label text-foreground">{`${payload[0].name} : ${payload[0].value.toLocaleString()}`}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><PieChart className="mr-2 h-6 w-6" /> Authentication Results</CardTitle>
        <CardDescription>SPF and DKIM pass/fail rates based on policy evaluation.</CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-center font-semibold mb-2 text-foreground">SPF Results</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPieChart>
              <Pie data={spfData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {spfData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} stroke="hsl(var(--background))" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="text-center font-semibold mb-2 text-foreground">DKIM Results</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPieChart>
              <Pie data={dkimData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {dkimData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} stroke="hsl(var(--background))" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }}/>
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
