"use client";

import React from "react";
import { Home, Search, List, MessageCircle, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Browse", href: "/browse" },
  { icon: List, label: "Watchlist", href: "/watchlist" },
  { icon: MessageCircle, label: "AI Chat", href: "/chat" },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border/40 bg-card/50 backdrop-blur-sm h-screen sticky top-0">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-border/20">
        <h1 className="text-2xl font-bold text-primary">CarWatch</h1>
        <p className="text-xs text-muted-foreground mt-1">Find your best deal</p>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-border/20">
        {user ? (
          <div className="space-y-1">
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                pathname === "/profile"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <User className="h-5 w-5" />
              Profile
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200 w-full"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
          >
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
