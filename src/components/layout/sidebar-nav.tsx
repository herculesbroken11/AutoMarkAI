
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Megaphone,
  Film,
  CalendarClock,
  Settings,
  HelpCircle,
  Beaker,
  CloudCog,
  Clock,
  Database,
  CloudSun,
  FileText,
  Images,
} from "lucide-react";

const menuItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    href: "/dashboard/reports",
    icon: FileText,
    label: "Reports",
  },
   {
    href: "/dashboard/sync",
    icon: CloudCog,
    label: "Sync Engine",
  },
  {
    href: "/dashboard/image-pairing",
    icon: Images,
    label: "Image Pairing",
  },
  {
    href: "/dashboard/content",
    icon: Megaphone,
    label: "Content Generation",
  },
  {
    href: "/dashboard/reels",
    icon: Film,
    label: "Reel Generator",
  },
  {
    href: "/dashboard/schedule",
    icon: CalendarClock,
    label: "Schedule",
  },
  {
    href: "/dashboard/data",
    icon: Database,
    label: "Data",
  },
  {
    href: "/dashboard/weather",
    icon: CloudSun,
    label: "Weather Sync",
  },
   {
    href: "/dashboard/cron-tester",
    icon: Clock,
    label: "Cron Tester",
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {menuItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')}
            tooltip={item.label}
            onClick={() => setOpenMobile(false)}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function SidebarFooterNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname === "/dashboard/how-to-use"}
          tooltip="How to Use"
          onClick={() => setOpenMobile(false)}
        >
          <Link href="/dashboard/how-to-use">
            <HelpCircle />
            <span>How to Use</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname === "/dashboard/settings"}
          tooltip="Settings"
          onClick={() => setOpenMobile(false)}
        >
          <Link href="/dashboard/settings">
            <Settings />
            <span>Settings</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
