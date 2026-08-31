'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { ManagementChart } from '@/lib/management-insights';

const managementChartConfig = {
  value: {
    label: 'Value',
    color: '#2c7f9b',
  },
} satisfies ChartConfig;

export function ManagementChartCard({ chart }: { chart: ManagementChart }) {
  const data = chart.data.map((item) => ({
    ...item,
    value: chart.valueFormat === 'currency' ? item.value / 100 : item.value,
  }));
  return (
    <article className="rounded-xl border border-[#dce3e8] bg-white p-4">
      <h3 className="text-xs font-semibold text-[#203845]">{chart.title}</h3>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">
        {chart.description}
      </p>
      {data.length ? (
        <ChartContainer
          config={managementChartConfig}
          className="mt-3 h-[220px] w-full aspect-auto"
          initialDimension={{ width: 480, height: 220 }}
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 18, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                chart.valueFormat === 'currency'
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(Number(value))
                  : String(value)
              }
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={126}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ fill: '#edf4f6' }}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="mt-3 flex h-[220px] items-center justify-center rounded-lg bg-[#f8fafb] text-xs text-slate-500">
          No dated records are available for this chart.
        </div>
      )}
    </article>
  );
}
