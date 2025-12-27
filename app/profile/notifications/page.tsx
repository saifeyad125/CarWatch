"use client";

import React, { useState } from "react";
import { ArrowLeft, Bell, Mail, MessageSquare, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const router = useRouter();
  
  const [settings, setSettings] = useState({
    newMatches: true,
    priceDrops: true,
    priceIncreases: false,
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
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
          <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Alert Preferences */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Alert Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">New Matches</p>
                    <p className="text-sm text-muted-foreground">Get notified when new cars match your watchlist</p>
                  </div>
                </div>
                <Button
                  variant={settings.newMatches ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.newMatches ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("newMatches")}
                >
                  {settings.newMatches ? "On" : "Off"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 rotate-180" />
                  <div>
                    <p className="font-medium">Price Drops</p>
                    <p className="text-sm text-muted-foreground">Alert when prices decrease</p>
                  </div>
                </div>
                <Button
                  variant={settings.priceDrops ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.priceDrops ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("priceDrops")}
                >
                  {settings.priceDrops ? "On" : "Off"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium">Price Increases</p>
                    <p className="text-sm text-muted-foreground">Alert when prices increase</p>
                  </div>
                </div>
                <Button
                  variant={settings.priceIncreases ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.priceIncreases ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("priceIncreases")}
                >
                  {settings.priceIncreases ? "On" : "Off"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Methods */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-cyan-600" />
                Delivery Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                </div>
                <Button
                  variant={settings.emailNotifications ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.emailNotifications ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("emailNotifications")}
                >
                  {settings.emailNotifications ? "On" : "Off"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Get instant mobile alerts</p>
                </div>
                <Button
                  variant={settings.pushNotifications ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.pushNotifications ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("pushNotifications")}
                >
                  {settings.pushNotifications ? "On" : "Off"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Weekly Digest</p>
                  <p className="text-sm text-muted-foreground">Summary of all activity</p>
                </div>
                <Button
                  variant={settings.weeklyDigest ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.weeklyDigest ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("weeklyDigest")}
                >
                  {settings.weeklyDigest ? "On" : "Off"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Alerts Summary */}
          <Card className="p-4 bg-gradient-to-r from-red-50 to-red-100/50 backdrop-blur-sm rounded-2xl border border-red-200 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Bell className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">3 Active Alert Types</h3>
                <p className="text-sm text-red-700">Currently receiving notifications</p>
              </div>
            </div>
          </Card>

          {/* Save Button */}
          <Button 
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
            onClick={() => {
              alert("Notification preferences saved!");
              router.back();
            }}
          >
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
