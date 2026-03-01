"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Bell, Calendar, Car, CheckCircle, Check } from "lucide-react";
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
        return "bg-red-100 border-red-200";
      case "listing_expired":
        return "bg-orange-100 border-orange-200";
      case "price_drop":
        return "bg-green-100 border-green-200";
      default:
        return "bg-blue-100 border-blue-200";
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Alerts History</h1>
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
          <Card className="p-4 bg-gradient-to-r from-red-50 to-red-100/50 backdrop-blur-sm rounded-2xl border border-red-200 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shadow-md">
                <Bell className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{alerts.length} Total Alerts</h2>
                <p className="text-sm text-red-700">{unreadCount} unread</p>
              </div>
            </div>
          </Card>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          )}

          {!isLoading && (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={`p-5 rounded-2xl shadow-lg transition-all duration-300 ${
                    !alert.isRead ? "border-2 border-primary/30" : "border-0"
                  } bg-card/50 backdrop-blur-sm`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getAlertColor(alert.type)}`}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-foreground">{alert.title}</h3>
                        {!alert.isRead && (
                          <Badge variant="default" className="text-xs bg-red-500 text-white">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                      <div className="flex items-center justify-between">
                        {alert.watchlistName && (
                          <Badge variant="outline" className="text-xs">{alert.watchlistName}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {alert.createdAt}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && alerts.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-r from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Bell className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No alerts yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                You'll receive alerts here when there are new matches or updates to your watchlists.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
