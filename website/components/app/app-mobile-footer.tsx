"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navigation } from "@/components/app/app-navigation";
export function AppMobileFooter() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobile navigation" className="grid min-w-0 flex-1 grid-cols-3 gap-1 md:hidden">
      {navigation.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-muted-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <item.icon className="size-5" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
