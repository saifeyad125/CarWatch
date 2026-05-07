"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, SlidersHorizontal, X, ArrowUpDown, LogIn, ChevronLeft, ChevronRight, Bike } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MotorcycleCard, MotorcycleCardSkeleton, type MotorcycleCardData } from "@/components/ui/motorcycle-card";
import { DealerMotorcycleCard, DealerMotorcycleCardSkeleton, type DealerMotorcycleCardData } from "@/components/ui/dealer-motorcycle-card";
import { getFavoritesByType, toggleFavorite as toggleFav } from "@/lib/favorites";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useDebounce } from "@/lib/hooks/use-debounce";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_BRANDS = [
  "Ducati", "BMW", "Harley-Davidson", "Yamaha", "Honda",
  "Kawasaki", "KTM", "Triumph", "Suzuki", "Aprilia",
];

const MOTORCYCLE_TYPES = [
  { value: "Sport", label: "Sport" },
  { value: "Cruiser", label: "Cruiser" },
  { value: "Adventure", label: "Adventure" },
  { value: "Touring", label: "Touring" },
  { value: "Naked", label: "Naked" },
  { value: "Scooter", label: "Scooter" },
];

export default function MotorcyclesBrowse() {
  const { user, avatarSeed } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [usedFavorites, setUsedFavorites] = useState<number[]>(() =>
    typeof window !== "undefined" ? getFavoritesByType("motorcycle") : []
  );
  const [dealerFavorites, setDealerFavorites] = useState<number[]>(() =>
    typeof window !== "undefined" ? getFavoritesByType("dealer_motorcycle") : []
  );

  const [usedListings, setUsedListings] = useState<MotorcycleCardData[]>([]);
  const [usedTotal, setUsedTotal] = useState(0);
  const [usedPage, setUsedPage] = useState(1);
  const [isLoadingUsed, setIsLoadingUsed] = useState(true);

  const [dealerListings, setDealerListings] = useState<DealerMotorcycleCardData[]>([]);
  const [dealerTotal, setDealerTotal] = useState(0);
  const [dealerPage, setDealerPage] = useState(1);
  const [isLoadingDealer, setIsLoadingDealer] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 12;
  const usedTotalPages = Math.ceil(usedTotal / PAGE_SIZE);
  const dealerTotalPages = Math.ceil(dealerTotal / PAGE_SIZE);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const debouncedPriceMin = useDebounce(priceMin, 300);
  const debouncedPriceMax = useDebounce(priceMax, 300);

  const handleMakeChange = useCallback((make: string) => {
    setSelectedMake(make);
    setSelectedModel("");
    setAvailableModels([]);
  }, []);

  const filterKey = `${debouncedSearch}|${selectedMake}|${selectedModel}|${selectedType}|${selectedYear}|${debouncedPriceMin}|${debouncedPriceMax}|${sortBy}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setUsedPage(1);
    setDealerPage(1);
    setIsLoadingUsed(true);
    setIsLoadingDealer(true);
    setError(null);
  }

  const buildParams = useCallback((page: number) => {
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedMake) params.set("make", selectedMake);
    if (selectedModel) params.set("model", selectedModel);
    if (selectedType) params.set("motorcycle_type", selectedType);
    if (selectedYear) { params.set("min_year", selectedYear); params.set("max_year", selectedYear); }
    if (debouncedPriceMin) params.set("min_price", debouncedPriceMin);
    if (debouncedPriceMax) params.set("max_price", debouncedPriceMax);
    if (sortBy) params.set("sort", sortBy);
    return params;
  }, [debouncedSearch, selectedMake, selectedModel, selectedType, selectedYear, debouncedPriceMin, debouncedPriceMax, sortBy]);

  useEffect(() => {
    const controller = new AbortController();
    const params = buildParams(usedPage);
    apiRequest<{ listings: MotorcycleCardData[]; total: number }>(
      `${API_ENDPOINTS.motorcycles.list}?${params}`,
      { signal: controller.signal }
    )
      .then((data) => { setUsedListings(data.listings); setUsedTotal(data.total); })
      .catch((err) => { if ((err as Error).name !== "AbortError") setError("Failed to load listings."); })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingUsed(false); });
    return () => controller.abort();
  }, [buildParams, usedPage]);

  useEffect(() => {
    const controller = new AbortController();
    const params = buildParams(dealerPage);
    apiRequest<{ listings: DealerMotorcycleCardData[]; total: number }>(
      `${API_ENDPOINTS.motorcycleDealerCars.list}?${params}`,
      { signal: controller.signal }
    )
      .then((data) => { setDealerListings(data.listings); setDealerTotal(data.total); })
      .catch((err) => { if ((err as Error).name !== "AbortError") {} })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingDealer(false); });
    return () => controller.abort();
  }, [buildParams, dealerPage]);

  useEffect(() => {
    if (!selectedMake) return;
    apiRequest<{ models: string[] }>(API_ENDPOINTS.motorcycles.models(selectedMake))
      .then((data) => setAvailableModels(data.models || []))
      .catch(() => setAvailableModels([]));
  }, [selectedMake]);

  const toggleUsedFavorite = (id: number) => {
    toggleFav("motorcycle", id);
    setUsedFavorites(getFavoritesByType("motorcycle"));
  };

  const toggleDealerFavorite = (id: number) => {
    toggleFav("dealer_motorcycle", id);
    setDealerFavorites(getFavoritesByType("dealer_motorcycle"));
  };

  const [allBrands, setAllBrands] = useState<string[]>([]);
  useEffect(() => {
    apiRequest<{ brands: string[] }>(API_ENDPOINTS.motorcycles.brands)
      .then((data) => setAllBrands(data.brands || []))
      .catch(() => setAllBrands([]));
  }, []);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1989 }, (_, i) => String(currentYear - i)),
    [currentYear]
  );

  const activeFilters = [selectedMake, selectedModel, selectedType, selectedYear, priceMin, priceMax].filter(Boolean);

  const clearFilters = () => {
    setSearchQuery("");
    handleMakeChange("");
    setSelectedType("");
    setSelectedYear("");
    setPriceMin("");
    setPriceMax("");
  };

  const getPageNumbers = (current: number, total: number): (number | "...")[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
  };

  const isLoading = isLoadingUsed && isLoadingDealer;
  const totalAll = usedTotal + dealerTotal;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/browse" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Motorcycles</h1>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs font-medium">
              {totalAll.toLocaleString()} motorcycles
            </Badge>
          )}
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

      <div className="shrink-0 border-b border-border/40 bg-card/50 px-4 md:px-6 py-2.5">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => handleMakeChange("")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!selectedMake ? "bg-violet-600 text-white border-violet-600" : "bg-background border-border text-muted-foreground hover:border-violet-500/40"}`}
            >
              All Brands
            </button>
            {POPULAR_BRANDS.map((brand) => (
              <button
                key={brand}
                onClick={() => handleMakeChange(brand)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedMake === brand ? "bg-violet-600 text-white border-violet-600" : "bg-background border-border text-muted-foreground hover:border-violet-500/40"}`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-border/40 bg-card px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by make, model, or trim..."
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

          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filters
              {activeFilters.length > 0 && (
                <span className="ml-1.5 h-4.5 min-w-4.5 px-1 rounded-full bg-violet-600 text-white text-[10px] font-semibold flex items-center justify-center">
                  {activeFilters.length}
                </span>
              )}
            </Button>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 pl-3 pr-8 rounded-md border border-input bg-background text-xs font-medium text-foreground appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>

            {activeFilters.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {selectedMake && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedMake}
                    <button onClick={() => handleMakeChange("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {selectedModel && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedModel}
                    <button onClick={() => setSelectedModel("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {selectedType && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedType}
                    <button onClick={() => setSelectedType("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {selectedYear && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedYear}
                    <button onClick={() => setSelectedYear("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {priceMin && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    Min: {priceMin}
                    <button onClick={() => setPriceMin("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {priceMax && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    Max: {priceMax}
                    <button onClick={() => setPriceMax("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors">
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 overflow-hidden border-b border-border/40 bg-card"
          >
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Make</label>
                  <select
                    value={selectedMake}
                    onChange={(e) => handleMakeChange(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
                  >
                    <option value="">All makes</option>
                    {allBrands.map((make) => (<option key={make} value={make}>{make}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={!selectedMake}
                    className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{selectedMake ? "All models" : "Select make first"}</option>
                    {availableModels.map((model) => (<option key={model} value={model}>{model}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
                  >
                    <option value="">All types</option>
                    {MOTORCYCLE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
                  >
                    <option value="">All years</option>
                    {years.map((year) => (<option key={year} value={year}>{year}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Min Price (AED)</label>
                  <Input type="number" placeholder="0" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Max Price (AED)</label>
                  <Input type="number" placeholder="No limit" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showFilters && <div className="fixed inset-0 z-0 md:hidden" onClick={() => setShowFilters(false)} />}

      <div className="flex-1 overflow-y-auto scrollbar-hide" onClick={() => showFilters && setShowFilters(false)}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 pb-safe space-y-10">
          {/* Used Motorcycles */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Bike className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                Used Motorcycles
                {!isLoadingUsed && <Badge variant="secondary" className="text-xs">{usedTotal}</Badge>}
              </h2>
            </div>

            {isLoadingUsed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {Array.from({ length: 6 }).map((_, i) => <MotorcycleCardSkeleton key={i} />)}
              </div>
            )}

            {!isLoadingUsed && usedListings.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No used motorcycles found. Try adjusting your filters.</p>
              </Card>
            )}

            {!isLoadingUsed && usedListings.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {usedListings.map((m, i) => (
                    <MotorcycleCard
                      key={m.id}
                      motorcycle={m}
                      index={i}
                      isFavorite={usedFavorites.includes(m.id)}
                      onToggleFavorite={toggleUsedFavorite}
                    />
                  ))}
                </div>
                {usedTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-6">
                    <Button variant="outline" size="sm" disabled={usedPage === 1} onClick={() => { setIsLoadingUsed(true); setUsedPage(usedPage - 1); }} className="h-9 w-9 p-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getPageNumbers(usedPage, usedTotalPages).map((page, i) =>
                      page === "..." ? (
                        <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
                      ) : (
                        <Button key={page} variant={page === usedPage ? "default" : "outline"} size="sm" onClick={() => { setIsLoadingUsed(true); setUsedPage(page as number); }} className="h-9 w-9 p-0 text-sm">
                          {page}
                        </Button>
                      )
                    )}
                    <Button variant="outline" size="sm" disabled={usedPage === usedTotalPages} onClick={() => { setIsLoadingUsed(true); setUsedPage(usedPage + 1); }} className="h-9 w-9 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Dealer Motorcycles */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Bike className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                Dealer Motorcycles
                {!isLoadingDealer && <Badge variant="secondary" className="text-xs">{dealerTotal}</Badge>}
              </h2>
            </div>

            {isLoadingDealer && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {Array.from({ length: 6 }).map((_, i) => <DealerMotorcycleCardSkeleton key={i} />)}
              </div>
            )}

            {!isLoadingDealer && dealerListings.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No dealer motorcycles found.</p>
              </Card>
            )}

            {!isLoadingDealer && dealerListings.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {dealerListings.map((m, i) => (
                    <DealerMotorcycleCard
                      key={m.id}
                      motorcycle={m}
                      index={i}
                      isFavorite={dealerFavorites.includes(m.id)}
                      onToggleFavorite={toggleDealerFavorite}
                    />
                  ))}
                </div>
                {dealerTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-6">
                    <Button variant="outline" size="sm" disabled={dealerPage === 1} onClick={() => { setIsLoadingDealer(true); setDealerPage(dealerPage - 1); }} className="h-9 w-9 p-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getPageNumbers(dealerPage, dealerTotalPages).map((page, i) =>
                      page === "..." ? (
                        <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
                      ) : (
                        <Button key={page} variant={page === dealerPage ? "default" : "outline"} size="sm" onClick={() => { setIsLoadingDealer(true); setDealerPage(page as number); }} className="h-9 w-9 p-0 text-sm">
                          {page}
                        </Button>
                      )
                    )}
                    <Button variant="outline" size="sm" disabled={dealerPage === dealerTotalPages} onClick={() => { setIsLoadingDealer(true); setDealerPage(dealerPage + 1); }} className="h-9 w-9 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          {error && (
            <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40">
              <p className="text-red-700 dark:text-red-300 text-center text-sm">{error}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
