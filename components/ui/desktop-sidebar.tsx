"use client";

import React, { useEffect, useState } from "react";
import { Home, Search, Plus, List, MessageCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Browse", href: "/browse" },
  { icon: Plus, label: "Sell", href: "/sell" },
  { icon: List, label: "Watchlist", href: "/watchlist" },
  { icon: MessageCircle, label: "AI Chat", href: "/chat" },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const { user, signOut, avatarSeed } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;
  const [watchlistBadge, setWatchlistBadge] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchBadges = async () => {
      try {
        const data = await apiRequest<{ watchlists: { newCount: number }[] }>(
          API_ENDPOINTS.watchlists.list
        );
        const total = data.watchlists.reduce((sum, w) => sum + (w.newCount || 0), 0);
        setWatchlistBadge(total);
      } catch {}
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 30_000);
    return () => {
      clearInterval(interval);
      setWatchlistBadge(0);
    };
  }, [user]);

  return (
    <aside className="hidden md:flex flex-col w-72 shrink-0 border-r border-border/40 bg-card/50 backdrop-blur-sm h-screen sticky top-0">
      {/* Brand */}
      <div className="px-6 py-7 border-b border-border/30">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">CW</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">CarWatch</h1>
            <p className="text-[11px] text-muted-foreground -mt-0.5">UAE Car Price Intelligence</p>
          </div>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 mb-3">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const badge = item.href === "/watchlist" ? watchlistBadge : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarActiveIndicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.25 : 1.75} />
                {badge > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full flex items-center justify-center"
                  >
                    {badge}
                  </motion.div>
                )}
              </div>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-border/30">
        {user ? (
          <div className="space-y-2">
            {/* User info with avatar */}
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                pathname === "/profile"
                  ? "bg-primary/8"
                  : "hover:bg-accent"
              )}
            >
              <Avatar className="h-9 w-9 shrink-0 ring-2 ring-border">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
                <AvatarFallback className="text-xs font-medium">
                  {(userName || "U")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {userName || "User"}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-muted-foreground">Online</span>
                </div>
              </div>
            </Link>

            {/* Sign out */}
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150 w-full"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150"
          >
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
