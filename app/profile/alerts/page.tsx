"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Car, CheckCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

interface Alert {
  id: number;
  type: "new_match" | "listing_expired" | "price_drop" | "status_update";
  title: string;
  message: string;
  watchlistId: number;
  listingId: number | null;
  watchlistName: string | null;
  createdAt: string;
  isRead: boolean;
}

interface AlertsResponse {
  notifications: Alert[];
  unreadCount: number;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await apiRequest<AlertsResponse>(API_ENDPOINTS.notifications.list);
        setAlerts(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch (err) {
        console.error("Failed to fetch alerts:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const markAllRead = async () => {
    try {
      await apiRequest(API_ENDPOINTS.notifications.markAllRead, { method: "PATCH" });
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "new_match":
        return <Car className="h-5 w-5 text-primary" />;
      case "listing_expired":
        return <Bell className="h-5 w-5 text-orange-600" />;
      case "price_drop":
        return <Bell className="h-5 w-5 text-green-600" />;
      default:
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getAlertColor = (type: Alert["type"]) => {
    switch (type) {
      case "new_match":
        return "bg-primary/10";
      case "listing_expired":
        return "bg-orange-100 dark:bg-orange-950/30";
      case "price_drop":
        return "bg-green-100 dark:bg-green-950/30";
      default:
        return "bg-blue-100 dark:bg-blue-950/30";
    }
  };

  const groupByDate = (alerts: Alert[]) => {
    const groups: Record<string, Alert[]> = {};
    for (const alert of alerts) {
      const raw = alert.createdAt;
      let label = "Older";
      const match = raw.match(/^(\d+)([mhd])\s/);
      if (match) {
        const val = parseInt(match[1]);
        const unit = match[2];
        if (unit === "m" || (unit === "h" && val < 24)) {
          label = "Today";
        } else if (unit === "h" || (unit === "d" && val === 1)) {
          label = "Yesterday";
        } else if (unit === "d" && val <= 7) {
          label = "This Week";
        }
      } else if (raw.toLowerCase().includes("just now") || raw.toLowerCase().includes("now")) {
        label = "Today";
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(alert);
    }
    const order = ["Today", "Yesterday", "This Week", "Older"];
    return order.filter((k) => groups[k]?.length).map((k) => ({ label: k, alerts: groups[k] }));
  };

  const getAlertHref = (alert: Alert): string | null => {
    if (alert.type === "new_match" && alert.listingId) {
      return `/listing/${alert.listingId}`;
    }
    if (alert.watchlistId) {
      return `/watchlist/${alert.watchlistId}`;
    }
    return null;
  };

  const grouped = groupByDate(alerts);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/40 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-primary">
              <Check className="h-4 w-4 mr-1" /> Read all
            </Button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-safe">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{unreadCount}</p>
                  <p className="text-sm text-muted-foreground">unread</p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{alerts.length} total</p>
              </div>
            </div>
          </Card>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && grouped.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.alerts.map((alert) => {
                  const href = getAlertHref(alert);
                  const card = (
                    <Card
                      key={alert.id}
                      className={`p-4 transition-all duration-200 hover:shadow-card-hover cursor-pointer ${
                        !alert.isRead ? "border-l-4 border-l-primary" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${getAlertColor(alert.type)}`}>
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.createdAt}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                          {alert.watchlistName && (
                            <Badge variant="outline" className="text-xs mt-2">{alert.watchlistName}</Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                  return href ? (
                    <Link key={alert.id} href={href}>{card}</Link>
                  ) : (
                    <div key={alert.id}>{card}</div>
                  );
                })}
              </div>
            </div>
          ))}

          {!isLoading && alerts.length === 0 && (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Bell className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No notifications yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a watchlist to start receiving alerts when matching cars appear.
              </p>
              <Link href="/watchlist">
                <Button>Create Watchlist</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
