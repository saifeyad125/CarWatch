"use client";

import React, { useEffect, useState } from "react";
import { Home, List, MessageCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Browse", href: "/browse" },
  { icon: List, label: "Watchlist", href: "/watchlist" },
  { icon: MessageCircle, label: "AI Chat", href: "/chat" },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const [watchlistBadge, setWatchlistBadge] = useState(0);
  const [notifBadge, setNotifBadge] = useState(0);

  // Poll the watchlist API + notifications every 30s to keep badges fresh
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const data = await apiRequest<{ summary: { newCount?: number }; watchlists: { newCount: number }[] }>(
          API_ENDPOINTS.watchlists.list
        );
        const total = data.watchlists.reduce((sum, w) => sum + (w.newCount || 0), 0);
        setWatchlistBadge(total);
      } catch {
        // silently fail — badge just stays at 0
      }

      try {
        const notifData = await apiRequest<{ unreadCount: number }>(
          API_ENDPOINTS.notifications.unreadCount
        );
        setNotifBadge(notifData.unreadCount);
      } catch {
        // silently fail
      }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="shrink-0 bg-card border-t border-border/20 backdrop-blur-xl bg-card/95 supports-backdrop-filter:bg-card/80">
      <div className="safe-area-inset-bottom">
        <div className="flex items-center justify-around py-2 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center min-w-0 flex-1 px-2 py-3 text-xs transition-all duration-200 relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <div className={cn(
                    "rounded-2xl p-2 transition-all duration-200",
                    isActive ? "bg-primary/10" : ""
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 transition-all duration-200", 
                      isActive && "scale-110"
                    )} />
                  </div>
                  {item.href === "/watchlist" && watchlistBadge > 0 && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {watchlistBadge}
                    </div>
                  )}
                  {item.href === "/" && notifBadge > 0 && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {notifBadge}
                    </div>
                  )}
                </div>
                <span className={cn(
                  "font-medium mt-1 transition-all duration-200", 
                  isActive ? "font-semibold text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
