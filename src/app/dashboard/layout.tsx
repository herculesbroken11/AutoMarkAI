// This is the layout for the authenticated dashboard section.
"use client";
import React from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import UserProfile from "@/components/user-profile";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bot, Loader } from "lucide-react";
import { SidebarNav, SidebarFooterNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bot className="h-6 w-6" />
              </div>
              <span className="font-semibold text-lg font-headline hidden group-data-[state=expanded]:inline">Porters AutoMarkAI</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav />
          </SidebarContent>
          <SidebarFooter>
            <SidebarFooterNav />
            <UserProfile />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="sm:hidden" />
            <div className="ml-auto">
               {/* This space can be used for other header items if needed */}
            </div>
          </header>
          <main className="p-4 sm:p-6 sm:pt-0" style={isMobile ? { zoom: 0.55 } : {}}>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
