"use client";

import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AppChartProps } from "@/lib/patchsmith-charts";

export function AppChart({
  type,
  label,
  data,
  valueLabel = "Value",
  valueFormat = "number",
  currency = "USD",
}: AppChartProps & { type: "area" | "bar" }) {
  const gradientId = `app-chart-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const numberOptions: Intl.NumberFormatOptions =
    valueFormat === "currency"
      ? { style: "currency", currency, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 2 };
  const format = new Intl.NumberFormat("en-US", numberOptions);
  const compact = new Intl.NumberFormat("en-US", {
    ...numberOptions,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const config = { value: { label: valueLabel, color: "var(--chart-2)" } } satisfies ChartConfig;
  const minimum = Math.min(0, ...data.map(({ value }) => value));
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} minTickGap={20} />
      <YAxis
        axisLine={false}
        tickLine={false}
        tickMargin={8}
        width={56}
        domain={[minimum, "auto"]}
        tickFormatter={(value: number) => compact.format(value)}
      />
      <ChartTooltip
        cursor={type === "area" ? false : undefined}
        content={
          <ChartTooltipContent
            formatter={(value) => (
              <div className="flex w-full items-center justify-between gap-4">
                <span className="text-muted-foreground">{valueLabel}</span>
                <span className="font-mono font-medium tabular-nums">
                  {typeof value === "number" ? format.format(value) : ""}
                </span>
              </div>
            )}
          />
        }
      />
    </>
  );

  if (!data.length)
    return (
      <div
        className="flex h-64 items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        No data to display.
      </div>
    );

  return (
    <figure aria-label={label} className="min-w-0">
      <ChartContainer config={config} className="h-64 w-full aspect-auto">
        {type === "area" ? (
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              dataKey="value"
              name={valueLabel}
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={data.length === 1}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          >
            {axes}
            <Bar
              dataKey="value"
              name={valueLabel}
              fill="var(--color-value)"
              radius={[6, 6, 0, 0]}
              maxBarSize={64}
              isAnimationActive={false}
            />
          </BarChart>
        )}
      </ChartContainer>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point, index) => (
            <tr key={index}>
              <th scope="row">{point.label}</th>
              <td>{format.format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
