"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Bell, BellOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

interface CarListing {
  id: number;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: string;
  predictedPrice?: string;
  dealLabel?: string;
  mileage: string;
  location: string;
  image: string;
}

interface WatchlistMatch {
  isNew: boolean;
  isGoodDeal: boolean | null;
  listing: CarListing;
}

interface WatchlistCard {
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

interface WatchlistStats {
  totalMatches: number;
  newToday: number;
  avgMatch: number | null;
}

interface WatchlistDetailResponse {
  watchlist: WatchlistCard;
  stats: WatchlistStats;
}

interface WatchlistMatchesResponse {
  watchlistId: number;
  matches: WatchlistMatch[];
}

export default function WatchlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [watchlist, setWatchlist] = useState<WatchlistCard | null>(null);
  const [stats, setStats] = useState<WatchlistStats | null>(null);
  const [matches, setMatches] = useState<WatchlistMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"best_match" | "price" | "newest">("best_match");
  
  // Fetch watchlist details
  useEffect(() => {
    const fetchWatchlistDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const detailData = await apiRequest<WatchlistDetailResponse>(
          API_ENDPOINTS.watchlists.detail(parseInt(id))
        );
        setWatchlist(detailData.watchlist);
        setStats(detailData.stats);
        
        // Fetch matches
        const matchesData = await apiRequest<WatchlistMatchesResponse>(
          API_ENDPOINTS.watchlists.matches(parseInt(id), sortBy)
        );
        setMatches(matchesData.matches);
      } catch (err) {
        console.error('Failed to fetch watchlist details:', err);
        setError('Failed to load watchlist details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchlistDetail();
  }, [id, sortBy]);

  // Run scan
  const handleScan = async () => {
    try {
      setIsScanning(true);
      await apiRequest(API_ENDPOINTS.watchlists.scan(parseInt(id)));
      
      // Refresh the data
      const detailData = await apiRequest<WatchlistDetailResponse>(
        API_ENDPOINTS.watchlists.detail(parseInt(id))
      );
      setWatchlist(detailData.watchlist);
      setStats(detailData.stats);
      
      const matchesData = await apiRequest<WatchlistMatchesResponse>(
        API_ENDPOINTS.watchlists.matches(parseInt(id), sortBy)
      );
      setMatches(matchesData.matches);
    } catch (err) {
      console.error('Failed to scan watchlist:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Watchlist Details</h1>
            <div className="w-20"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Loading watchlist...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !watchlist || !stats) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Watchlist Details</h1>
            <div className="w-20"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <p className="text-red-800 dark:text-red-300 text-center">
              {error || 'Watchlist not found'}
            </p>
            <Button onClick={() => router.back()} className="w-full mt-4">
              Go Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Watchlist Details</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handleScan}
              disabled={isScanning}
            >
              <RefreshCw className={`h-5 w-5 ${isScanning ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
            >
              {watchlist.alertsEnabled ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Watchlist Info Card */}
        <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{watchlist.title}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="font-medium">{watchlist.subtitle}</span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${watchlist.isActive ? "bg-green-500" : "bg-gray-400"}`} />
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {watchlist.locationLabel}
              </span>
              <span>•</span>
              <span>{watchlist.updatedLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {watchlist.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs rounded-full">
                    {tag}
                  </Badge>
                ))}
              </div>
              {watchlist.newCount > 0 && (
                <Badge variant="default" className="text-xs bg-red-500 text-white rounded-full px-3">
                  {watchlist.newCount} new
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-4 space-y-6 pb-safe">
          {/* Stats */}
          <div className={`grid gap-4 ${stats.avgMatch != null ? "grid-cols-3" : "grid-cols-2"}`}>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl">
              <div className="text-2xl font-bold text-primary">{stats.totalMatches}</div>
              <div className="text-xs text-muted-foreground">Total Matches</div>
            </Card>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl">
              <div className="text-2xl font-bold text-primary">{stats.newToday}</div>
              <div className="text-xs text-muted-foreground">New Today</div>
            </Card>
            {stats.avgMatch != null && (
              <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl">
                <div className="text-2xl font-bold text-primary">{stats.avgMatch}%</div>
                <div className="text-xs text-muted-foreground">Avg Match</div>
              </Card>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={sortBy === "best_match" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("best_match")}
              className="rounded-full"
            >
              Best Match
            </Button>
            <Button
              variant={sortBy === "price" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("price")}
              className="rounded-full"
            >
              Lowest Price
            </Button>
            <Button
              variant={sortBy === "newest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("newest")}
              className="rounded-full"
            >
              Newest
            </Button>
          </div>

          {/* Listings */}
          <div className="space-y-4">
            {matches.length > 0 ? (
              matches.map((match) => (
                <Link key={match.listing.id} href={`/listing/${match.listing.id}`}>
                  <Card className="overflow-hidden border-2 border-border/50 bg-card/60 backdrop-blur-sm rounded-2xl hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                    <div className="flex gap-4 p-4">
                      <div className="relative w-32 h-24 rounded-xl overflow-hidden shrink-0">
                        <img
                          src={match.listing.image}
                          alt={`${match.listing.year} ${match.listing.make} ${match.listing.model}${match.listing.trim ? ` ${match.listing.trim}` : ""}`}
                          className="w-full h-full object-cover"
                        />
                        {match.isNew && (
                          <Badge className="absolute top-2 right-2 text-xs bg-red-500 text-white">
                            NEW
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-foreground">
                              {match.listing.year} {match.listing.make} {match.listing.model}{match.listing.trim ? ` ${match.listing.trim}` : ""}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {match.listing.location}
                            </p>
                          </div>
                          {match.isGoodDeal && (
                            <Badge variant="default" className="bg-green-500 text-white text-xs">
                              Good Deal
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-bold text-primary">{match.listing.price}</div>
                            {match.listing.predictedPrice && (
                              <div className="text-xs text-muted-foreground line-through">
                                {match.listing.predictedPrice}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{match.listing.mileage}</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No matches found yet</p>
                <Button onClick={handleScan} className="mt-4" disabled={isScanning}>
                  {isScanning ? 'Scanning...' : 'Scan for Matches'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}