"use client";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoProfile } from "@/components/app/demo-profile";
export function AppMobileHeader({ name }: { name: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 bg-background items-center justify-between gap-2 border-b px-4 min-[800px]:hidden">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Forma</span>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DemoProfile workspaceName={name} />
      </div>
    </header>
  );
}
