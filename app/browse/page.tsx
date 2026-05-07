"use client";

import { useState, useEffect, Suspense } from "react";
import { Search, X, Car, Building2, Wrench, Bike, LogIn, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useDebounce } from "@/lib/hooks/use-debounce";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface SearchResultItem {
  id: number;
  year?: number;
  brand?: string;
  model?: string;
  price?: string;
  location?: string;
  dealerName?: string;
  sellerName?: string;
  name?: string;
  image?: string;
}

interface SearchResults {
  used_cars: { results: SearchResultItem[]; total: number };
  dealer_cars: { results: SearchResultItem[]; total: number };
  parts: { results: SearchResultItem[]; total: number };
  motorcycles: { results: SearchResultItem[]; total: number };
}

export default function BrowseHubPage() {
  return (
    <Suspense>
      <BrowseHub />
    </Suspense>
  );
}

function BrowseHub() {
  const { user, avatarSeed } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(qParam);
  const [counts, setCounts] = useState({ used_cars: 0, dealer_cars: 0, parts: 0, motorcycles: 0, used_motorcycles: 0, dealer_motorcycles: 0 });
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    apiRequest<{ used_cars: number; dealer_cars: number; parts: number; motorcycles: number; used_motorcycles: number; dealer_motorcycles: number }>(API_ENDPOINTS.browse.counts)
      .then(setCounts)
      .catch(() => {})
      .finally(() => setIsLoadingCounts(false));
  }, []);

  useEffect(() => {
    if (debouncedSearch) {
      router.replace(`/browse?q=${encodeURIComponent(debouncedSearch)}`, { scroll: false });
    } else if (qParam) {
      router.replace("/browse", { scroll: false });
    }
  }, [debouncedSearch, qParam, router]);

  useEffect(() => {
    if (!debouncedSearch) return;
    const controller = new AbortController();
    const search = () => {
      setIsSearching(true);
      apiRequest<SearchResults>(
        `${API_ENDPOINTS.browse.search}?q=${encodeURIComponent(debouncedSearch)}`,
        { signal: controller.signal }
      )
        .then(setSearchResults)
        .catch((err) => {
          if ((err as Error).name !== "AbortError") setSearchResults(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    };
    search();
    return () => {
      controller.abort();
      setSearchResults(null);
    };
  }, [debouncedSearch]);

  const categories = [
    {
      title: "Used Cars",
      subtitle: "Browse used car listings",
      href: "/browse/used",
      icon: Car,
      count: counts.used_cars,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-500/20 hover:border-blue-500/40",
    },
    {
      title: "Dealer Certified Cars",
      subtitle: "Certified cars from verified dealers",
      href: "/browse/dealers",
      icon: Building2,
      count: counts.dealer_cars,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
    },
    {
      title: "Parts",
      subtitle: "Parts & accessories",
      href: "/browse/parts",
      icon: Wrench,
      count: counts.parts,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-500/20 hover:border-amber-500/40",
    },
    {
      title: "Motorcycles",
      subtitle: "Used & dealer motorcycles",
      href: "/browse/motorcycles",
      icon: Bike,
      count: counts.motorcycles,
      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      borderColor: "border-violet-500/20 hover:border-violet-500/40",
    },
  ];

  const showSearch = !!debouncedSearch;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Browse</h1>
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

      {/* Search Bar */}
      <div className="shrink-0 border-b border-border/40 bg-card px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across all categories..."
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 pb-safe">
          {!showSearch ? (
            /* Category Cards */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {categories.map((cat, i) => (
                <motion.div
                  key={cat.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href={cat.href} className="group block">
                    <div className={`bg-card rounded-xl border ${cat.borderColor} shadow-card p-4 transition-all duration-200 ease-out group-hover:shadow-card-hover group-hover:-translate-y-0.5 h-full flex flex-col`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className={`h-10 w-10 rounded-lg ${cat.color} flex items-center justify-center`}>
                          <cat.icon className="h-5 w-5" />
                        </div>
                        {!isLoadingCounts && (
                          <Badge variant="secondary" className="text-[11px] font-medium px-1.5 py-0.5">
                            {cat.count.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                      <h2 className="font-semibold text-sm md:text-base text-foreground mb-0.5 leading-tight">{cat.title}</h2>
                      <p className="text-xs text-muted-foreground hidden sm:block">{cat.subtitle}</p>
                      <div className="mt-auto pt-3 flex items-center text-xs md:text-sm font-medium text-primary">
                        Browse
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            /* Search Results */
            <div className="space-y-8">
              {isSearching ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className="h-5 w-32 skeleton rounded" />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className="h-24 skeleton rounded-xl" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchResults ? (
                <>
                  {/* Used Cars Results */}
                  <SearchSection
                    title="Used Cars"
                    total={searchResults.used_cars.total}
                    seeAllHref={`/browse/used?search=${encodeURIComponent(debouncedSearch)}`}
                  >
                    {searchResults.used_cars.results.map((r) => (
                      <Link key={r.id} href={`/listing/${r.id}`} className="group block">
                        <div className="bg-card rounded-xl border border-border/60 p-3 flex gap-3 transition-all hover:shadow-card-hover hover:-translate-y-0.5">
                          <img src={r.image || "https://placehold.co/120x80/eee/555?text=No+Image"} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{r.year} {r.brand} {r.model}</p>
                            <p className="text-xs text-primary font-semibold">{r.price}</p>
                            <p className="text-xs text-muted-foreground">{r.location}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </SearchSection>

                  {/* Dealer Certified Cars Results */}
                  <SearchSection
                    title="Dealer Certified Cars"
                    total={searchResults.dealer_cars.total}
                    seeAllHref={`/browse/dealers?search=${encodeURIComponent(debouncedSearch)}`}
                  >
                    {searchResults.dealer_cars.results.map((r) => (
                      <Link key={r.id} href={`/listing/dealer/${r.id}`} className="group block">
                        <div className="bg-card rounded-xl border border-primary/20 p-3 flex gap-3 transition-all hover:shadow-card-hover hover:-translate-y-0.5">
                          <img src={r.image || "https://placehold.co/120x80/eee/555?text=No+Image"} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{r.year} {r.brand} {r.model}</p>
                            <p className="text-xs text-primary font-semibold">{r.price}</p>
                            <p className="text-xs text-muted-foreground">{r.dealerName}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </SearchSection>

                  {/* Parts Results */}
                  <SearchSection
                    title="Parts"
                    total={searchResults.parts.total}
                    seeAllHref={`/browse/parts?search=${encodeURIComponent(debouncedSearch)}`}
                  >
                    {searchResults.parts.results.map((r) => (
                      <Link key={r.id} href={`/listing/parts/${r.id}`} className="group block">
                        <div className="bg-card rounded-xl border border-border/60 p-3 flex gap-3 transition-all hover:shadow-card-hover hover:-translate-y-0.5">
                          <img src={r.image || "https://placehold.co/120x80/eee/555?text=No+Image"} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                            <p className="text-xs text-primary font-semibold">{r.price}</p>
                            <p className="text-xs text-muted-foreground">{r.sellerName}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </SearchSection>

                  {/* Motorcycles Results */}
                  <SearchSection
                    title="Motorcycles"
                    total={searchResults.motorcycles.total}
                    seeAllHref={`/browse/motorcycles?search=${encodeURIComponent(debouncedSearch)}`}
                  >
                    {searchResults.motorcycles.results.map((r) => (
                      <Link key={r.id} href={`/listing/motorcycle/${r.id}`} className="group block">
                        <div className="bg-card rounded-xl border border-violet-500/20 p-3 flex gap-3 transition-all hover:shadow-card-hover hover:-translate-y-0.5">
                          <img src={r.image || "https://placehold.co/120x80/eee/555?text=No+Image"} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{r.year} {r.brand} {r.model}</p>
                            <p className="text-xs text-primary font-semibold">{r.price}</p>
                            <p className="text-xs text-muted-foreground">{r.location}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </SearchSection>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchSection({ title, total, seeAllHref, children }: {
  title: string;
  total: number;
  seeAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">
          {title}
          <span className="text-muted-foreground font-normal ml-2 text-sm">({total} results)</span>
        </h3>
        {total > 0 && (
          <Link href={seeAllHref} className="text-sm text-primary font-medium hover:underline flex items-center gap-0.5">
            See all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No results found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {children}
        </div>
      )}
    </motion.div>
  );
}
