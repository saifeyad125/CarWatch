"use client";

import { useState, useEffect } from "react";
import { Search, X, LogIn, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CategoryCard, CategoryCardSkeleton } from "@/components/ui/category-card";
import { PartCard, PartCardSkeleton, type PartCardData } from "@/components/ui/part-card";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { getFavoritesByType, toggleFavorite as toggleFav } from "@/lib/favorites";
import { useAuth } from "@/components/auth-provider";
import { useDebounce } from "@/lib/hooks/use-debounce";
import Link from "next/link";

interface CategorySummary {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  parentId?: number | null;
  partCount: number;
}

export default function PartsBrowse() {
  const { user, avatarSeed } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [searchResults, setSearchResults] = useState<PartCardData[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const isSearchMode = debouncedSearch.length > 0;

  useEffect(() => {
    apiRequest<{ categories: CategorySummary[] }>(API_ENDPOINTS.parts.categories)
      .then((data) => setCategories(data.categories || []))
      .catch(() => setCategories([]))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    const controller = new AbortController();
    const search = async () => {
      try {
        setIsSearching(true);
        const params = new URLSearchParams({ search: debouncedSearch, limit: "20" });
        const data = await apiRequest<{ parts: PartCardData[]; total: number }>(
          `${API_ENDPOINTS.parts.list}?${params}`,
          { signal: controller.signal }
        );
        setSearchResults(data.parts || []);
        setSearchTotal(data.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSearchResults([]);
        setSearchTotal(0);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    };
    search();
    return () => controller.abort();
  }, [debouncedSearch]);

  useEffect(() => {
    setFavorites(getFavoritesByType("part"));
  }, []);

  const handleToggleFavorite = (partId: number) => {
    toggleFav("part", partId);
    setFavorites(getFavoritesByType("part"));
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/browse" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Parts</h1>
        </div>
        {user ? (
          <Link href="/profile">
            <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-border hover:ring-primary/30 transition-all duration-150">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
              <AvatarFallback className="text-xs font-medium">{(userName || "U")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm">
              <LogIn className="h-3.5 w-3.5 mr-1.5" />
              Sign In
            </Button>
          </Link>
        )}
      </header>

      <div className="shrink-0 border-b border-border/40 bg-card px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-11 bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 pb-safe">
          {!isSearchMode && (
            <>
              {isLoadingCategories && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <CategoryCardSkeleton key={i} />
                  ))}
                </div>
              )}
              {!isLoadingCategories && categories.length === 0 && (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">No categories yet</h3>
                  <p className="text-sm text-muted-foreground">Parts categories will appear here soon.</p>
                </div>
              )}
              {!isLoadingCategories && categories.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {categories.map((cat, i) => (
                    <CategoryCard
                      key={cat.id}
                      id={cat.id}
                      name={cat.name}
                      icon={cat.icon}
                      partCount={cat.partCount}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {isSearchMode && (
            <>
              {isSearching && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <PartCardSkeleton key={i} />
                  ))}
                </div>
              )}
              {!isSearching && searchResults.length === 0 && (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">No parts found</h3>
                  <p className="text-sm text-muted-foreground">Try a different search term.</p>
                </div>
              )}
              {!isSearching && searchResults.length > 0 && (
                <>
                  <div className="mb-4">
                    <Badge variant="secondary" className="text-xs font-medium">
                      {searchTotal} results
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {searchResults.map((part, i) => (
                      <PartCard
                        key={part.id}
                        part={part}
                        index={i}
                        isFavorite={favorites.includes(part.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
