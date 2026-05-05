"use client";

import { useState, useEffect } from "react";
import { Search, X, LogIn, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CategoryCard, CategoryCardSkeleton } from "@/components/ui/category-card";
import { PartCard, PartCardSkeleton, type PartCardData } from "@/components/ui/part-card";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { getFavoritesByType, toggleFavorite as toggleFav } from "@/lib/favorites";
import { useAuth } from "@/components/auth-provider";
import { useDebounce } from "@/lib/hooks/use-debounce";
import Link from "next/link";
import { use } from "react";

interface CategorySummary {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  parentId?: number | null;
  partCount: number;
}

interface BreadcrumbItem {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
}

interface CategoryDetailResponse {
  category: CategorySummary;
  breadcrumb: BreadcrumbItem[];
  children: CategorySummary[];
  parts: PartCardData[];
}

export default function CategoryDrillDown({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, avatarSeed } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;

  const [data, setData] = useState<CategoryDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PartCardData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const isSearchMode = debouncedSearch.length > 0;

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setSearchQuery("");
    apiRequest<CategoryDetailResponse>(API_ENDPOINTS.parts.category(parseInt(id)))
      .then((res) => setData(res))
      .catch(() => setError("Failed to load category."))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const search = async () => {
      try {
        setIsSearching(true);
        const params = new URLSearchParams({ search: debouncedSearch, category_id: id, limit: "20" });
        const res = await apiRequest<{ parts: PartCardData[]; total: number }>(
          `${API_ENDPOINTS.parts.list}?${params}`,
          { signal: controller.signal }
        );
        setSearchResults(res.parts || []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    };
    search();
    return () => controller.abort();
  }, [debouncedSearch, id]);

  useEffect(() => {
    setFavorites(getFavoritesByType("part"));
  }, []);

  const handleToggleFavorite = (partId: number) => {
    toggleFav("part", partId);
    setFavorites(getFavoritesByType("part"));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center">
          <Link href="/browse/parts" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="h-5 w-32 skeleton ml-3" />
        </header>
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CategoryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center">
          <Link href="/browse/parts" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">{error || "Category not found"}</h3>
            <p className="text-sm text-muted-foreground mb-4">This category may have been removed.</p>
            <Link href="/browse/parts"><Button>Back to Parts</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const { category, breadcrumb, children, parts } = data;
  const parentCrumb = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={parentCrumb ? `/browse/parts/category/${parentCrumb.id}` : "/browse/parts"}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="hidden md:flex items-center gap-1 text-sm min-w-0">
            <Link href="/browse/parts" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              Parts
            </Link>
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {i === breadcrumb.length - 1 ? (
                  <span className="font-medium text-foreground truncate">{crumb.name}</span>
                ) : (
                  <Link href={`/browse/parts/category/${crumb.id}`} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                    {crumb.name}
                  </Link>
                )}
              </span>
            ))}
          </div>
          <h1 className="md:hidden text-lg font-semibold text-foreground tracking-tight truncate">
            {category.name}
          </h1>
        </div>
        {user ? (
          <Link href="/profile">
            <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-border hover:ring-primary/30 transition-all duration-150 shrink-0">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
              <AvatarFallback className="text-xs font-medium">{(userName || "U")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm" className="shrink-0">
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
              placeholder={`Search in ${category.name}...`}
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
          {isSearchMode ? (
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
              )}
            </>
          ) : (
            <div className="space-y-8">
              {children.length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Subcategories</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {children.map((child, i) => (
                      <CategoryCard
                        key={child.id}
                        id={child.id}
                        name={child.name}
                        icon={child.icon}
                        partCount={child.partCount}
                        index={i}
                      />
                    ))}
                  </div>
                </section>
              )}

              {parts.length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
                    Parts in {category.name}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {parts.map((part, i) => (
                      <PartCard
                        key={part.id}
                        part={part}
                        index={i}
                        isFavorite={favorites.includes(part.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                </section>
              )}

              {children.length === 0 && parts.length === 0 && (
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Nothing here yet</h3>
                  <p className="text-sm text-muted-foreground">No subcategories or parts in this category.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
