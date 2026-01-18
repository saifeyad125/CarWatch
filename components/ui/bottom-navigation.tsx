"use client";

import React from "react";
import { Home, List, MessageCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Browse", href: "/browse" },
  { icon: List, label: "Watchlist", href: "/watchlist", badge: 3 },
  { icon: MessageCircle, label: "AI Chat", href: "/chat" },
];

export function BottomNavigation() {
  const pathname = usePathname();

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
                  {item.badge && item.badge > 0 && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {item.badge}
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
