"use client";

import React, { useEffect, useState } from "react";
import { Home, Search, List, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { motion } from "framer-motion";

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
  const { user } = useAuth();
  const [watchlistBadge, setWatchlistBadge] = useState(0);

  useEffect(() => {
    if (!user) {
      setWatchlistBadge(0);
      return;
    }

    const fetchBadges = async () => {
      try {
        const data = await apiRequest<{ summary: { newCount?: number }; watchlists: { newCount: number }[] }>(
          API_ENDPOINTS.watchlists.list
        );
        const total = data.watchlists.reduce((sum, w) => sum + (w.newCount || 0), 0);
        setWatchlistBadge(total);
      } catch {}
    };

    fetchBadges();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchBadges();
      }
    }, 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchBadges();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const activeIndex = navItems.findIndex(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  );

  return (
    <div className="shrink-0 border-t border-border/40 bg-card/80 backdrop-blur-nav">
      <div className="safe-area-inset-bottom">
        <div className="relative flex items-center justify-around px-2 h-16">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = i === activeIndex;
            const badge = item.href === "/watchlist" ? watchlistBadge : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1.5 relative transition-colors duration-150",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <div className={cn(
                    "rounded-xl p-2 transition-all duration-200",
                    isActive && "bg-primary/10"
                  )}>
                    <Icon
                      className={cn("h-5 w-5", isActive && "text-primary")}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                  </div>
                  {badge > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 h-4.5 min-w-4.5 px-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full flex items-center justify-center"
                    >
                      {badge}
                    </motion.div>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] mt-0.5 font-medium transition-colors duration-150",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>

                {/* Active indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -top-px left-1/4 right-1/4 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
