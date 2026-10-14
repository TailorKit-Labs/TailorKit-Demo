"use client";
import { usePathname } from "next/navigation";
import { ArrowUpRightFromSquareIcon, CommandIcon, Settings2Icon } from "lucide-react";
import {
  Sidebar,
  useSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { DemoProfile, SidebarLink } from "@/components/app/demo-profile";
import { navigation } from "@/components/app/app-navigation";
export function AppSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  if (isMobile) return null;
  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <div className="flex h-8 items-center gap-1">
          <SidebarLink
            href="/"
            aria-label="Forma CRM home"
            className="mr-auto flex items-center gap-2"
          >
            <CommandIcon className="size-5" />
            <span className="text-lg font-semibold tracking-tight">Forma</span>
          </SidebarLink>
          <ThemeToggle />
          <DemoProfile workspaceName={name} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    className="h-9"
                    isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                    render={<SidebarLink href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-4 px-3 pb-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-9"
              isActive={pathname === "/settings"}
              render={<SidebarLink href="/settings" />}
            >
              <Settings2Icon />
              <span>Workspace settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <a
          href="https://tailorkit.dev/home"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "default", className: "w-full justify-between" })}
        >
          Powered by TailorKit
          <ArrowUpRightFromSquareIcon data-icon="inline-end" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
