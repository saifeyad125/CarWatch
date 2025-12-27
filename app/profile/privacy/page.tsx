"use client";

import React, { useState } from "react";
import { ArrowLeft, Shield, Lock, Eye, EyeOff, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();
  
  const [settings, setSettings] = useState({
    profileVisible: true,
    showEmail: false,
    showPhone: false,
    dataCollection: true,
    personalizedAds: true,
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
          <h1 className="text-lg font-semibold text-foreground">Privacy & Security</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Privacy Settings */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Privacy Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Profile Visibility</p>
                  <p className="text-sm text-muted-foreground">Allow others to see your profile</p>
                </div>
                <Button
                  variant={settings.profileVisible ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.profileVisible ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("profileVisible")}
                >
                  {settings.profileVisible ? "Public" : "Private"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Show Email</p>
                  <p className="text-sm text-muted-foreground">Display email on profile</p>
                </div>
                <Button
                  variant={settings.showEmail ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.showEmail ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("showEmail")}
                >
                  {settings.showEmail ? "Visible" : "Hidden"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Show Phone</p>
                  <p className="text-sm text-muted-foreground">Display phone on profile</p>
                </div>
                <Button
                  variant={settings.showPhone ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.showPhone ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("showPhone")}
                >
                  {settings.showPhone ? "Visible" : "Hidden"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data & Tracking */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-cyan-600" />
                Data & Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Data Collection</p>
                  <p className="text-sm text-muted-foreground">Allow usage analytics</p>
                </div>
                <Button
                  variant={settings.dataCollection ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.dataCollection ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("dataCollection")}
                >
                  {settings.dataCollection ? "On" : "Off"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">Personalized Ads</p>
                  <p className="text-sm text-muted-foreground">Show relevant advertisements</p>
                </div>
                <Button
                  variant={settings.personalizedAds ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${settings.personalizedAds ? "bg-green-500 hover:bg-green-600" : ""}`}
                  onClick={() => toggleSetting("personalizedAds")}
                >
                  {settings.personalizedAds ? "On" : "Off"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security Actions */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Security Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4 border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white"
                onClick={() => alert("Change password functionality would go here")}
              >
                <Lock className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm opacity-80">Update your account password</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4 border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white"
                onClick={() => alert("Download data functionality would go here")}
              >
                <Download className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Download Your Data</p>
                  <p className="text-sm opacity-80">Export all your information</p>
                </div>
              </Button>

              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                    alert("Account deletion would be processed here");
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm opacity-80">Permanently remove your account</p>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button 
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
            onClick={() => {
              alert("Privacy settings saved!");
              router.back();
            }}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
