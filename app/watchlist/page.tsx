"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, Car, MapPin, DollarSign, Bell, Settings, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

interface WatchlistItem {
  id: number;
  title: string;
  subtitle: string;
  locationLabel: string;
  updatedLabel: string;
  tags: string[];
  isActive: boolean;
  alertsEnabled: boolean;
  newCount: number;
  totalMatches: number;
}

interface WatchlistsResponse {
  summary: {
    active: number;
    matches: number;
    withAlerts: number;
  };
  watchlists: WatchlistItem[];
}

export default function WatchlistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [summary, setSummary] = useState({ active: 0, matches: 0, withAlerts: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch watchlists from API
  useEffect(() => {
    const fetchWatchlists = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
        setWatchlistItems(data.watchlists);
        setSummary(data.summary);
      } catch (err) {
        console.error('Failed to fetch watchlists:', err);
        setError('Failed to load watchlists. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchlists();
  }, []);

  const toggleWatchlistStatus = (id: number) => {
    setWatchlistItems(prev => {
      const activeCount = prev.filter(item => item.isActive).length;
      const targetItem = prev.find(item => item.id === id);
      
      // If trying to activate and already at limit, prevent activation
      if (targetItem && !targetItem.isActive && activeCount >= 2) {
        alert("Free trial limited to 2 active watchlists. Please upgrade or pause another watchlist first.");
        return prev;
      }
      
      return prev.map(item => 
        item.id === id ? { ...item, isActive: !item.isActive } : item
      );
    });
  };

  const filteredItems = watchlistItems
    .filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationLabel.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by active status only - active items at top
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1; // Active items come first
      }
      return 0; // Maintain original order within each group
    });

  if (showAddForm) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setShowAddForm(false)}
              className="p-2"
            >
              ← Back
            </Button>
            <h1 className="text-lg font-semibold">Add to Watchlist</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6 pb-32">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Make</label>
                  <Input placeholder="e.g., Toyota" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Model</label>
                  <Input placeholder="e.g., Camry" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Year From</label>
                  <Input placeholder="2020" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Year To</label>
                  <Input placeholder="2023" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Price Range
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Min Price</label>
                  <Input placeholder="$20,000" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Max Price</label>
                  <Input placeholder="$30,000" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input placeholder="e.g., Los Angeles, CA" />
              <div className="mt-2">
                <label className="text-sm font-medium text-muted-foreground">Search Radius</label>
                <div className="flex gap-2 mt-2">
                  {["25 miles", "50 miles", "100 miles", "200 miles"].map((radius) => (
                    <Button key={radius} variant="outline" size="sm" className="text-xs">
                      {radius}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Condition & Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Condition</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["New", "Used", "Certified Pre-Owned"].map((condition) => (
                    <Button key={condition} variant="outline" size="sm" className="text-xs border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white">
                      {condition}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1 border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white rounded-2xl" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg rounded-2xl">
              <Plus className="h-4 w-4 mr-2" />
              Add to Watchlist
            </Button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <h1 className="text-xl font-bold">Watchlist</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Loading watchlists...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <h1 className="text-xl font-bold">Watchlist</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <p className="text-red-800 dark:text-red-300 text-center">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header with blur effect */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Watchlist</h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              onClick={() => setShowAddForm(true)}
              className="h-10 w-10 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Link href="/profile">
              <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-red-500 transition-all">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Saif" />
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your watchlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-12 h-12 rounded-2xl border-border/50 bg-background/50 backdrop-blur-sm"
          />
          <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-xl">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-4 space-y-6 pb-safe">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-primary">
                {summary.active}
              </div>
              <div className="text-sm text-muted-foreground">Active</div>
            </Card>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-primary">
                {summary.matches}
              </div>
              <div className="text-sm text-muted-foreground">Matches</div>
            </Card>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-primary">
                {summary.withAlerts}
              </div>
              <div className="text-sm text-muted-foreground">With Alerts</div>
            </Card>
          </div>

          {/* Usage Limit Info */}
          <Card className={`p-4 backdrop-blur-sm rounded-2xl shadow-lg ${
            watchlistItems.filter(item => item.isActive).length === 0
              ? "border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/50"
              : watchlistItems.filter(item => item.isActive).length <= 2
              ? "border border-green-200 bg-gradient-to-r from-green-50 to-green-100/50"
              : "border border-red-200 bg-gradient-to-r from-red-50 to-red-100/50"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  watchlistItems.filter(item => item.isActive).length === 0
                    ? "bg-amber-100"
                    : watchlistItems.filter(item => item.isActive).length <= 2
                    ? "bg-green-100"
                    : "bg-red-100"
                }`}>
                  <Settings className={`h-5 w-5 ${
                    watchlistItems.filter(item => item.isActive).length === 0
                      ? "text-amber-600"
                      : watchlistItems.filter(item => item.isActive).length <= 2
                      ? "text-green-600"
                      : "text-red-600"
                  }`} />
                </div>
                <div>
                  <div className={`font-semibold ${
                    watchlistItems.filter(item => item.isActive).length === 0
                      ? "text-amber-800"
                      : watchlistItems.filter(item => item.isActive).length <= 2
                      ? "text-green-800"
                      : "text-red-800"
                  }`}>
                    {watchlistItems.filter(item => item.isActive).length}/2 Active Watchlists
                  </div>
                  <div className={`text-sm ${
                    watchlistItems.filter(item => item.isActive).length === 0
                      ? "text-amber-700"
                      : watchlistItems.filter(item => item.isActive).length <= 2
                      ? "text-green-700"
                      : "text-red-700"
                  }`}>
                    Free trial limit • Upgrade for unlimited
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white shadow-md">
                Upgrade
              </Button>
            </div>
          </Card>

          {/* Watchlist Items */}
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <Link key={item.id} href={`/watchlist/${item.id}`}>
                <Card className="overflow-hidden border-2 border-border/50 bg-card/60 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                  <div className="p-6 space-y-4">
                    {/* Header Section */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <Car className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="font-medium">{item.subtitle}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {item.newCount > 0 && (
                          <Badge variant="default" className="text-xs rounded-full px-3 bg-red-500 text-white">
                            {item.newCount} new
                          </Badge>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className={`h-9 w-9 rounded-xl transition-all duration-200 ${
                            item.isActive 
                              ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" 
                              : watchlistItems.filter(w => w.isActive).length >= 2
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-green-600 hover:text-green-700 hover:bg-green-50"
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleWatchlistStatus(item.id);
                          }}
                          title={
                            item.isActive 
                              ? "Pause watchlist" 
                              : watchlistItems.filter(w => w.isActive).length >= 2
                                ? "Free trial limit reached - upgrade or pause another watchlist"
                                : "Resume watchlist"
                          }
                        >
                          {item.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-9 w-9 text-muted-foreground rounded-xl hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Handle delete
                          }}
                          title="Delete watchlist"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {item.locationLabel}
                        </span>
                        <span>•</span>
                        <span>{item.updatedLabel}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {item.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs rounded-full px-3 border-border/60">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 rounded-xl"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Handle notification toggle
                            }}
                          >
                            <Bell className={item.isActive ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Status Bar */}
                    <div className="pt-3 border-t border-border/30">
                      <div className="flex items-center justify-between text-sm">
                        {item.totalMatches > 0 ? (
                          <span className="text-primary font-medium">
                            {item.totalMatches} {item.totalMatches === 1 ? "match" : "matches"} found
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            No matches yet
                          </span>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                            item.isActive 
                              ? "bg-green-100 text-green-700" 
                              : "bg-red-100 text-red-700"
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${
                              item.isActive ? "bg-green-500" : "bg-red-500"
                            }`} />
                            {item.isActive ? "Active" : "Paused"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search terms" : "Start by adding your first watchlist item"}
              </p>
              <Button onClick={() => setShowAddForm(true)} className="rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
