"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Heart, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/ui/car-card";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { motion } from "framer-motion";

export default function FavoritesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteListings, setFavoriteListings] = useState<CarCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedFavorites = localStorage.getItem("carFavorites");
    const ids: number[] = savedFavorites ? JSON.parse(savedFavorites) : [];
    setFavoriteIds(ids);

    if (ids.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all(
      ids.map((id) => apiRequest<CarCardData>(API_ENDPOINTS.cars.detail(id)).catch(() => null))
    ).then((results) => {
      setFavoriteListings(results.filter((r): r is CarCardData => r !== null));
      setIsLoading(false);
    });
  }, []);

  const removeFavorite = (carId: number) => {
    const newIds = favoriteIds.filter((id) => id !== carId);
    setFavoriteIds(newIds);
    setFavoriteListings((prev) => prev.filter((car) => car.id !== carId));
    localStorage.setItem("carFavorites", JSON.stringify(newIds));
  };

  const filteredListings = favoriteListings.filter(
    (car) =>
      car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      car.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${car.year}`.includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Favorites</h1>
          {!isLoading && favoriteListings.length > 0 && (
            <Badge variant="secondary" className="text-xs font-medium">
              {favoriteListings.length}
            </Badge>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 pb-safe">
          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <CarCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && favoriteListings.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center py-20"
            >
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Heart className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No favorites yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
                Browse car listings and tap the heart icon to save your favorites here.
              </p>
              <Button onClick={() => router.push("/browse")}>Browse Cars</Button>
            </motion.div>
          )}

          {/* Has favorites */}
          {!isLoading && favoriteListings.length > 0 && (
            <div className="space-y-5">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search favorites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              {/* Grid */}
              {filteredListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredListings.map((car, i) => (
                    <CarCard
                      key={car.id}
                      car={car}
                      index={i}
                      isFavorite={true}
                      onToggleFavorite={removeFavorite}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <h3 className="font-semibold text-foreground mb-1">No matches</h3>
                  <p className="text-sm text-muted-foreground mb-4">Try a different search term.</p>
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
