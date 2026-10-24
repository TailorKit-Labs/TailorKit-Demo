import { z } from "zod";

const chartLabel = z
  .string()
  .refine((value) => value.length > 0 && value.length <= 120, "Use 1–120 characters.");

// Structured chart data crosses the app boundary; rendering stays in the host.
// Values use display units (e.g. dollars), so apps convert stored cents first.
export const chartFields = z.object({
  label: chartLabel,
  data: z
    .array(z.object({ label: chartLabel, value: z.number() }))
    .refine((value) => value.length <= 100, "Maximum 100 chart points."),
  valueLabel: chartLabel.optional(),
  valueFormat: z.enum(["number", "currency"]).optional(),
  currency: z
    .string()
    .refine((value) => /^[A-Z]{3}$/.test(value), "Use a three-letter currency code.")
    .optional(),
});

export type AppChartProps = z.infer<typeof chartFields>;
