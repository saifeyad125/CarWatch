"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/ui/car-card";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { motion } from "framer-motion";
import Link from "next/link";

interface WatchlistCard {
  id: number;
  title: string;
  isActive: boolean;
  totalMatches: number;
}

interface WatchlistsResponse {
  summary: { active: number; matches: number; withAlerts: number };
  watchlists: WatchlistCard[];
}

interface WatchlistMatch {
  isNew: boolean;
  isGoodDeal: boolean | null;
  listing: CarCardData;
}

interface WatchlistMatchesResponse {
  watchlistId: number;
  matches: WatchlistMatch[];
}

interface WatchlistGroup {
  watchlist: WatchlistCard;
  matches: CarCardData[];
}

export default function AllMatchesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    const saved = localStorage.getItem("carFavorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      try {
        setIsLoading(true);
        const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
        const watchlists = data.watchlists.filter((w) => w.totalMatches > 0);

        const results = await Promise.all(
          watchlists.map(async (w) => {
            try {
              const matchData = await apiRequest<WatchlistMatchesResponse>(
                API_ENDPOINTS.watchlists.matches(w.id)
              );
              return {
                watchlist: w,
                matches: matchData.matches.map((m) => m.listing),
              };
            } catch {
              return { watchlist: w, matches: [] };
            }
          })
        );

        setGroups(results.filter((g) => g.matches.length > 0));
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [user]);

  const toggleFavorite = (carId: number) => {
    const next = favorites.includes(carId)
      ? favorites.filter((id) => id !== carId)
      : [...favorites, carId];
    setFavorites(next);
    localStorage.setItem("carFavorites", JSON.stringify(next));
  };

  const totalMatches = groups.reduce((sum, g) => sum + g.matches.length, 0);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">All Matches</h1>
        {!isLoading && (
          <Badge variant="secondary" className="text-xs font-medium">
            {totalMatches}
          </Badge>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 pb-safe space-y-10">
          {/* Loading */}
          {isLoading && (
            <div className="space-y-8">
              {Array.from({ length: 2 }).map((_, gi) => (
                <div key={gi}>
                  <div className="h-5 w-40 skeleton mb-4 rounded" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <CarCardSkeleton key={i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && groups.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center py-20"
            >
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Car className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No matches yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
                Create watchlists and activate them to start finding matching listings.
              </p>
              <Button onClick={() => router.push("/watchlist")}>Go to Watchlists</Button>
            </motion.div>
          )}

          {/* Grouped matches */}
          {!isLoading &&
            groups.map((group, gi) => (
              <motion.section
                key={group.watchlist.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: gi * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
                      Watchlist
                    </p>
                    <h3 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                      {group.watchlist.title}
                      <Badge variant="secondary" className="text-xs font-medium">
                        {group.matches.length}
                      </Badge>
                      {!group.watchlist.isActive && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Paused
                        </Badge>
                      )}
                    </h3>
                  </div>
                  <Link href={`/watchlist/${group.watchlist.id}`}>
                    <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
                      View watchlist
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {group.matches.map((car, i) => (
                    <CarCard
                      key={car.id}
                      car={car}
                      index={i}
                      isFavorite={favorites.includes(car.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </motion.section>
            ))}
        </div>
      </div>
    </div>
  );
}
