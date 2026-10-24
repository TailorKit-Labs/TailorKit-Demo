"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";

export function AppSlotTabs({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange?: (event: { value: string }) => void;
  children: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={(value) => onChange?.({ value: String(value) })}>
      <TabsList aria-label={label} variant="underline" className="mb-3">
        {options.map((option) => (
          <TabsTab key={option.value} value={option.value}>
            {option.label}
          </TabsTab>
        ))}
      </TabsList>
      <TabsPanel key={value} value={value}>
        {children}
      </TabsPanel>
    </Tabs>
  );
}
