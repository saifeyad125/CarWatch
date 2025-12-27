"use client";

import React, { useState } from "react";
import { 
  User, 
  Bell, 
  Shield, 
  HelpCircle, 
  Settings, 
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";

interface ProfileSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  badge?: string;
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const { theme, toggleTheme } = useTheme();
  
  const [userInfo, setUserInfo] = useState({
    name: "Saif",
    email: "saif@example.com",
    phone: "+1 (555) 123-4567",
    location: "Los Angeles, CA"
  });

  const accountSettings: ProfileSetting[] = [
    {
      id: "notifications",
      label: "Notifications",
      description: "Manage your alert preferences",
      icon: Bell,
      badge: "3 active"
    },
    {
      id: "privacy",
      label: "Privacy & Security",
      description: "Control your data and security settings",
      icon: Shield
    },
    {
      id: "theme",
      label: theme === "dark" ? "Light Mode" : "Dark Mode",
      description: "Switch between light and dark themes",
      icon: theme === "dark" ? Sun : Moon,
      action: toggleTheme
    }
  ];

  const supportSettings: ProfileSetting[] = [
    {
      id: "help",
      label: "Help Center",
      description: "Get help and find answers",
      icon: HelpCircle
    },
    {
      id: "feedback",
      label: "Send Feedback",
      description: "Help us improve DealWatch",
      icon: Mail
    },
    {
      id: "about",
      label: "About DealWatch",
      description: "Version 1.0.0",
      icon: Settings
    }
  ];

  const handleSaveProfile = () => {
    setIsEditing(false);
    // In a real app, this would save to a backend
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header with blur effect */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-4 space-y-6 pb-safe">
          {/* Profile Info */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-lg">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Saif" />
                  <AvatarFallback className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-600 text-white">S</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">{userInfo.name}</h2>
                  <p className="text-muted-foreground">DealWatch Member since 2024</p>
                  <Badge variant="secondary" className="mt-2 rounded-full bg-red-100 text-red-700 border-red-200">
                    Premium
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsEditing(!isEditing)}
                  className="h-9 w-9 rounded-xl border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <Input
                    value={userInfo.name}
                    onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <Input
                    value={userInfo.email}
                    onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <Input
                    value={userInfo.phone}
                    onChange={(e) => setUserInfo({...userInfo, phone: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <Input
                    value={userInfo.location}
                    onChange={(e) => setUserInfo({...userInfo, location: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveProfile} className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg">
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1 border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{userInfo.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{userInfo.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{userInfo.location}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Link href="/watchlist">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer hover:border-2 hover:border-primary/30">
              <div className="text-2xl font-bold text-primary">12</div>
              <div className="text-sm text-muted-foreground">Watchlists</div>
            </Card>
          </Link>
          <Link href="/profile/alerts">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer hover:border-2 hover:border-primary/30">
              <div className="text-2xl font-bold text-primary">47</div>
              <div className="text-sm text-muted-foreground">Alerts Sent</div>
            </Card>
          </Link>
          <Link href="/profile/deals">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer hover:border-2 hover:border-primary/30">
              <div className="text-2xl font-bold text-primary">8</div>
              <div className="text-sm text-muted-foreground">Deals Found</div>
            </Card>
          </Link>
        </div>

        {/* Account Settings */}
        <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Account Settings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {accountSettings.map((setting, index) => (
              <div key={setting.id}>
                {setting.action ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-4 rounded-none hover:bg-red-50/50"
                    onClick={setting.action}
                  >
                    <setting.icon className="h-5 w-5 mr-3 text-primary" />
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{setting.label}</span>
                        {setting.badge && (
                          <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-200">
                            {setting.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {setting.description}
                      </p>
                    </div>
                    {setting.id === "theme" && (
                      <div className="ml-2 px-3 py-1 rounded-full bg-primary/10">
                        <span className="text-xs text-primary font-medium">{theme === "dark" ? "Dark" : "Light"}</span>
                      </div>
                    )}
                  </Button>
                ) : (
                  <Link href={`/profile/${setting.id}`}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-4 rounded-none hover:bg-red-50/50"
                    >
                      <setting.icon className="h-5 w-5 mr-3 text-primary" />
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{setting.label}</span>
                          {setting.badge && (
                            <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-200">
                              {setting.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {setting.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
                    </Button>
                  </Link>
                )}
                {index < accountSettings.length - 1 && <div className="border-b border-border mx-4" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Support & About</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {supportSettings.map((setting, index) => (
              <div key={setting.id}>
                <Link href={`/profile/${setting.id}`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-4 rounded-none hover:bg-cyan-50/50"
                  >
                    <setting.icon className="h-5 w-5 mr-3 text-cyan-600" />
                    <div className="flex-1 text-left">
                      <span className="font-medium">{setting.label}</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {setting.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
                  </Button>
                </Link>
                {index < supportSettings.length - 1 && <div className="border-b border-border mx-4" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Danger Zone</h3>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  if (confirm("Are you sure you want to delete all watchlists? This action cannot be undone.")) {
                    // Handle delete all watchlists
                    alert("All watchlists deleted (demo)");
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Watchlists
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  if (confirm("Are you sure you want to sign out?")) {
                    // Handle sign out
                    alert("Signed out (demo)");
                  }
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            DealWatch v1.0.0 • Made with ❤️ for car enthusiasts
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
