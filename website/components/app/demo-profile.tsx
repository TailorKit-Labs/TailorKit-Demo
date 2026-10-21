"use client";
import Link from "next/link";
import { CircleHelpIcon, Settings2Icon } from "lucide-react";
import { useDemoIntro } from "@/components/demo-intro/demo-intro-provider";
import { useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuGroup,
  MenuGroupLabel,
  MenuLinkItem,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/menu";
export function SidebarLink({ onClick, ...props }: React.ComponentProps<typeof Link>) {
  const { setOpenMobile } = useSidebar();
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        setOpenMobile(false);
      }}
    />
  );
}

export function DemoProfile({ workspaceName }: { workspaceName: string }) {
  const { replay } = useDemoIntro();
  return (
    <Menu>
      <MenuTrigger
        aria-label="Demo visitor profile"
        render={<Button variant="ghost" size="icon" />}
      >
        <span className="relative">
          <Avatar className="size-7">
            <AvatarFallback>DV</AvatarFallback>
          </Avatar>
          <span className="absolute right-0 bottom-0 size-2 rounded-full bg-success ring-2 ring-sidebar" />
        </span>
      </MenuTrigger>
      <MenuPopup align="end" className="w-56">
        <MenuGroup>
          <MenuGroupLabel>
            <span className="flex flex-col gap-1">
              <span>Demo visitor</span>
              <span className="text-xs font-normal text-muted-foreground">{workspaceName}</span>
            </span>
          </MenuGroupLabel>
          <MenuSeparator />
          <MenuItem onClick={replay}>
            <CircleHelpIcon />
            Replay introduction
          </MenuItem>
          <MenuLinkItem render={<SidebarLink href="/settings" />}>
            <Settings2Icon />
            Workspace settings
          </MenuLinkItem>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
