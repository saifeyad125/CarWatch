"use client";

import React, { useState, useEffect } from "react";
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
  Trash2,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

interface ProfileData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  status: string;
  avatarSeed: string;
  stats: {
    watchlistsCount: number;
    alertsSent: number;
    dealsFound: number;
  };
}

interface ProfileSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  badge?: string;
}

const AVATAR_SEEDS = ["Saif", "Felix", "Aneka", "Buster", "Patches", "Milo", "Lucky", "Jasper", "Shadow", "Coco"];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-gray-100 text-gray-700 border-gray-200" },
  premium: { label: "Premium", color: "bg-red-100 text-red-700 border-red-200" },
  admin: { label: "Admin", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", location: "" });

  // Fetch profile from API
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiRequest<ProfileData>(API_ENDPOINTS.profile);
        setProfile(data);
        setEditForm({
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          location: data.location || "",
        });
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };
    fetchProfile();
  }, []);

  // Read favorites count from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('carFavorites');
    if (saved) {
      try {
        setFavoritesCount(JSON.parse(saved).length);
      } catch {
        setFavoritesCount(0);
      }
    }
  }, []);

  const handleSaveProfile = async () => {
    try {
      const data = await apiRequest<ProfileData>(API_ENDPOINTS.profile, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          location: editForm.location || null,
        }),
      });
      setProfile(data);
      setIsEditing(false);
    } catch {
      alert("Failed to save profile.");
    }
  };

  const handleAvatarSelect = async (seed: string) => {
    try {
      const data = await apiRequest<ProfileData>(API_ENDPOINTS.profile, {
        method: "PATCH",
        body: JSON.stringify({ avatarSeed: seed }),
      });
      setProfile(data);
      setShowAvatarPicker(false);
    } catch {
      alert("Failed to update avatar.");
    }
  };

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
      description: "Help us improve CarWatch",
      icon: Mail
    },
    {
      id: "about",
      label: "About CarWatch",
      description: "Version 1.0.0",
      icon: Settings
    }
  ];

  const statusInfo = STATUS_LABELS[profile?.status || "free"];
  const avatarSeed = profile?.avatarSeed || "Saif";

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
        <div className="max-w-2xl mx-auto p-4 space-y-6 pb-safe">
          {/* Profile Info */}
          <Card className="border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <Avatar
                    className="h-20 w-20 border-4 border-primary/20 shadow-lg cursor-pointer"
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  >
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
                    <AvatarFallback className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-600 text-white">
                      {(profile?.name || "S")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">{profile?.name || "..."}</h2>
                  <p className="text-muted-foreground">CarWatch Member</p>
                  <Badge variant="secondary" className={`mt-2 rounded-full ${statusInfo.color}`}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (profile) {
                      setEditForm({
                        name: profile.name,
                        email: profile.email,
                        phone: profile.phone || "",
                        location: profile.location || "",
                      });
                    }
                    setIsEditing(!isEditing);
                  }}
                  className="h-9 w-9 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>

            {/* Avatar Picker */}
            {showAvatarPicker && (
              <div className="mb-6 p-4 bg-muted/50 rounded-xl">
                <p className="text-sm font-medium mb-3">Choose your avatar</p>
                <div className="grid grid-cols-5 gap-3">
                  {AVATAR_SEEDS.map((seed) => (
                    <button
                      key={seed}
                      onClick={() => handleAvatarSelect(seed)}
                      className={`relative rounded-full transition-all ${
                        seed === avatarSeed ? "ring-3 ring-primary scale-110" : "hover:scale-[1.02] opacity-70 hover:opacity-100"
                      }`}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} />
                      </Avatar>
                      {seed === avatarSeed && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <Input
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <Input
                    value={editForm.location}
                    onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveProfile} className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg">
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1 border-primary/30 text-primary hover:bg-primary hover:text-white">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profile?.email || "..."}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{profile?.phone || "..."}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{profile?.location || "..."}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Link href="/watchlist">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer hover:border-2 hover:border-primary/30">
              <div className="text-2xl font-bold text-primary">{profile?.stats.watchlistsCount ?? "..."}</div>
              <div className="text-sm text-muted-foreground">Watchlists</div>
            </Card>
          </Link>
          <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <div className="text-2xl font-bold text-primary">{profile?.stats.dealsFound ?? "..."}</div>
            <div className="text-sm text-muted-foreground">Deals Found</div>
          </Card>
          <Link href="/favorites">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer hover:border-2 hover:border-primary/30">
              <div className="text-2xl font-bold text-primary">{favoritesCount}</div>
              <div className="text-sm text-muted-foreground">Favorites</div>
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
                    className="w-full justify-start h-auto p-4 rounded-none hover:bg-primary/5"
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
                      className="w-full justify-start h-auto p-4 rounded-none hover:bg-primary/5"
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
                    className="w-full justify-start h-auto p-4 rounded-none hover:bg-primary/5"
                  >
                    <setting.icon className="h-5 w-5 mr-3 text-primary" />
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
            CarWatch v1.0.0
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
