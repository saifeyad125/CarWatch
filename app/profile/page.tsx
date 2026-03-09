"use client";

import React, { useState, useEffect } from "react";
import {
  User, Bell, Shield, HelpCircle, Settings, ChevronRight,
  LogOut, Moon, Sun, Mail, Phone, MapPin, Edit, Trash2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { motion } from "framer-motion";

interface ProfileData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  status: string;
  avatarSeed: string;
  stats: { watchlistsCount: number; alertsSent: number; totalMatches: number };
}

const AVATAR_SEEDS = ["Saif", "Felix", "Aneka", "Buster", "Patches", "Milo", "Lucky", "Jasper", "Shadow", "Coco"];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-secondary text-muted-foreground" },
  premium: { label: "Premium", color: "bg-primary/10 text-primary" },
  admin: { label: "Admin", color: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" },
};

export default function ProfilePage() {
  const { user, loading: authLoading, signOut, setAvatarSeed: setGlobalAvatarSeed } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", location: "" });

  useEffect(() => {
    apiRequest<ProfileData>(API_ENDPOINTS.profile)
      .then((data) => {
        setProfile(data);
        setEditForm({ name: data.name, email: data.email, phone: data.phone || "", location: data.location || "" });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("carFavorites");
    if (saved) try { setFavoritesCount(JSON.parse(saved).length); } catch {}
  }, []);

  const handleSaveProfile = async () => {
    try {
      const data = await apiRequest<ProfileData>(API_ENDPOINTS.profile, {
        method: "PATCH",
        body: JSON.stringify({ name: editForm.name, email: editForm.email, phone: editForm.phone || null, location: editForm.location || null }),
      });
      setProfile(data);
      setIsEditing(false);
    } catch { alert("Failed to save profile."); }
  };

  const handleAvatarSelect = async (seed: string) => {
    try {
      const data = await apiRequest<ProfileData>(API_ENDPOINTS.profile, {
        method: "PATCH",
        body: JSON.stringify({ avatarSeed: seed }),
      });
      setProfile(data);
      setGlobalAvatarSeed(seed);
      setShowAvatarPicker(false);
    } catch { alert("Failed to update avatar."); }
  };

  const statusInfo = STATUS_LABELS[profile?.status || "free"];
  const avatarSeed = profile?.avatarSeed || "Saif";

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const settingsGroups = [
    {
      title: "Account",
      items: [
        { id: "notifications", label: "Notifications", desc: "Manage alert preferences", icon: Bell, badge: "3 active" },
        { id: "privacy", label: "Privacy & Security", desc: "Control your data settings", icon: Shield },
        { id: "theme", label: theme === "dark" ? "Light Mode" : "Dark Mode", desc: "Switch appearance", icon: theme === "dark" ? Sun : Moon, action: toggleTheme },
      ],
    },
    {
      title: "Support",
      items: [
        { id: "help", label: "Help Center", desc: "Get help and find answers", icon: HelpCircle },
        { id: "feedback", label: "Send Feedback", desc: "Help us improve CarWatch", icon: Mail },
        { id: "about", label: "About CarWatch", desc: "Version 1.0.0", icon: Settings },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center">
        <h1 className="text-lg font-semibold tracking-tight">Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-safe">
          {/* Profile card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card>
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative">
                    <Avatar
                      className="h-16 w-16 ring-2 ring-border cursor-pointer hover:ring-primary/30 transition-all"
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    >
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
                      <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
                        {(profile?.name || "U")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-foreground tracking-tight truncate">{profile?.name || "..."}</h2>
                    <p className="text-sm text-muted-foreground">CarWatch Member</p>
                    <Badge variant="secondary" className={`mt-1.5 text-xs ${statusInfo.color}`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (profile) setEditForm({ name: profile.name, email: profile.email, phone: profile.phone || "", location: profile.location || "" });
                      setIsEditing(!isEditing);
                    }}
                  >
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>

                {/* Avatar picker */}
                {showAvatarPicker && (
                  <div className="mb-5 p-4 bg-muted/50 rounded-xl">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Choose avatar</p>
                    <div className="grid grid-cols-5 gap-3">
                      {AVATAR_SEEDS.map((seed) => (
                        <button
                          key={seed}
                          onClick={() => handleAvatarSelect(seed)}
                          className={`relative rounded-full transition-all ${seed === avatarSeed ? "ring-2 ring-primary scale-110" : "opacity-60 hover:opacity-100"}`}
                        >
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} />
                          </Avatar>
                          {seed === avatarSeed && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                              <Check className="h-2.5 w-2.5" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-3">
                    {[
                      { label: "Name", key: "name" as const },
                      { label: "Email", key: "email" as const },
                      { label: "Phone", key: "phone" as const },
                      { label: "Location", key: "location" as const },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                        <Input
                          value={editForm[field.key]}
                          onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                          className="mt-1 h-9"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Button onClick={handleSaveProfile} className="flex-1" size="sm">Save</Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1" size="sm">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {[
                      { icon: Mail, value: profile?.email },
                      { icon: Phone, value: profile?.phone || "Not set" },
                      { icon: MapPin, value: profile?.location || "Not set" },
                    ].map(({ icon: Icon, value }, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Watchlists", value: profile?.stats.watchlistsCount ?? "...", href: "/watchlist" },
              { label: "Matches", value: profile?.stats.totalMatches ?? "...", href: "/profile/matches" },
              { label: "Favorites", value: favoritesCount, href: "/favorites" },
            ].map((stat, i) => {
              const content = (
                <Card className={`p-4 text-center ${stat.href ? "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200" : ""}`}>
                  <div className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </Card>
              );
              return stat.href ? <Link key={i} href={stat.href}>{content}</Link> : <div key={i}>{content}</div>;
            })}
          </div>

          {/* Settings groups */}
          {settingsGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-2">
                {group.items.map((item, i) => {
                  const Icon = item.icon;
                  const inner = (
                    <button
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-accent transition-colors"
                      onClick={item.action}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-[10px]">{item.badge}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      {item.id === "theme" ? (
                        <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                          {theme === "dark" ? "Dark" : "Light"}
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  );
                  return (
                    <div key={item.id}>
                      {item.action ? inner : <Link href={`/profile/${item.id}`}>{inner}</Link>}
                      {i < group.items.length - 1 && <div className="border-b border-border/40 mx-5" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {/* Danger zone */}
          <Card className="border-red-200/60 dark:border-red-900/30">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Danger Zone</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/20"
                  onClick={() => { if (confirm("Delete all watchlists?")) alert("Deleted (demo)"); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete All Watchlists
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/20"
                  onClick={async () => { if (confirm("Sign out?")) { await signOut(); router.push("/login"); } }}
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground py-4">CarWatch v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
