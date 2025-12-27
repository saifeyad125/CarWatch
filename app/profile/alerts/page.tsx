"use client";

import React from "react";
import { ArrowLeft, Bell, Calendar, Car, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface Alert {
  id: number;
  type: "new_match" | "price_drop" | "status_update";
  title: string;
  message: string;
  watchlistName: string;
  timestamp: string;
  read: boolean;
}

const mockAlerts: Alert[] = [
  {
    id: 1,
    type: "new_match",
    title: "New Match Found!",
    message: "3 new cars match your Toyota Camry watchlist",
    watchlistName: "Toyota Camry 2020-2023",
    timestamp: "2 hours ago",
    read: false
  },
  {
    id: 2,
    type: "price_drop",
    title: "Price Drop Alert",
    message: "A car in your Honda Accord watchlist dropped by $1,200",
    watchlistName: "Honda Accord Sport",
    timestamp: "5 hours ago",
    read: false
  },
  {
    id: 3,
    type: "new_match",
    title: "New Match Found!",
    message: "1 new car matches your Tesla Model 3 watchlist",
    watchlistName: "Tesla Model 3",
    timestamp: "1 day ago",
    read: true
  },
  {
    id: 4,
    type: "status_update",
    title: "Watchlist Updated",
    message: "Your Ford F-150 watchlist was successfully updated",
    watchlistName: "Ford F-150 Lightning",
    timestamp: "2 days ago",
    read: true
  },
  {
    id: 5,
    type: "new_match",
    title: "New Match Found!",
    message: "2 new cars match your Toyota Camry watchlist",
    watchlistName: "Toyota Camry 2020-2023",
    timestamp: "3 days ago",
    read: true
  }
];

export default function AlertsPage() {
  const router = useRouter();

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "new_match":
        return <Car className="h-5 w-5 text-primary" />;
      case "price_drop":
        return <Bell className="h-5 w-5 text-green-600" />;
      case "status_update":
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getAlertColor = (type: Alert["type"]) => {
    switch (type) {
      case "new_match":
        return "bg-red-100 border-red-200";
      case "price_drop":
        return "bg-green-100 border-green-200";
      case "status_update":
        return "bg-blue-100 border-blue-200";
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Alerts History</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Stats Card */}
          <Card className="p-4 bg-gradient-to-r from-red-50 to-red-100/50 backdrop-blur-sm rounded-2xl border border-red-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shadow-md">
                  <Bell className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">47 Total Alerts</h2>
                  <p className="text-sm text-red-700">
                    {mockAlerts.filter(a => !a.read).length} unread alerts
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Alerts List */}
          <div className="space-y-4">
            {mockAlerts.map((alert) => (
              <Card
                key={alert.id}
                className={`p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
                  !alert.read ? "border-2 border-primary/30" : "border-0"
                } bg-card/50 backdrop-blur-sm`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getAlertColor(alert.type)}`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{alert.title}</h3>
                      {!alert.read && (
                        <Badge variant="default" className="text-xs bg-red-500 text-white">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {alert.watchlistName}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {alert.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Empty state if no alerts */}
          {mockAlerts.length === 0 && (
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
