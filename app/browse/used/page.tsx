"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, SlidersHorizontal, X, ArrowUpDown, LogIn, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/ui/car-card";
import { getFavoritesByType, toggleFavorite as toggleFav } from "@/lib/favorites";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useDebounce } from "@/lib/hooks/use-debounce";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_BRANDS = [
  "Toyota", "Mercedes-Benz", "BMW", "Nissan", "Land Rover",
  "Lexus", "Audi", "Porsche", "Honda", "Hyundai",
];

const FUEL_TYPES = [
  { value: "petrol", label: "Petrol" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
  { value: "diesel", label: "Diesel" },
];

export default function UsedCarsBrowse() {
  const { user, avatarSeed } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedTrim, setSelectedTrim] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableTrims, setAvailableTrims] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedFuelType, setSelectedFuelType] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [allListings, setAllListings] = useState<CarCardData[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(totalListings / PAGE_SIZE);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const debouncedPriceMin = useDebounce(priceMin, 300);
  const debouncedPriceMax = useDebounce(priceMax, 300);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedFuelType, selectedMake, selectedModel, selectedTrim, selectedYear, debouncedPriceMin, debouncedPriceMax, sortBy]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const offset = (currentPage - 1) * PAGE_SIZE;
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (selectedMake) params.set("make", selectedMake);
        if (selectedModel) params.set("model", selectedModel);
        if (selectedFuelType) params.set("fuel_type", selectedFuelType);
        if (selectedTrim) params.set("trim", selectedTrim);
        if (selectedYear) {
          params.set("min_year", selectedYear);
          params.set("max_year", selectedYear);
        }
        if (debouncedPriceMin) params.set("min_price", debouncedPriceMin);
        if (debouncedPriceMax) params.set("max_price", debouncedPriceMax);
        if (sortBy) params.set("sort", sortBy);
        const data = await apiRequest<{ listings: CarCardData[]; total: number }>(
          `${API_ENDPOINTS.cars.list}?${params}`,
          { signal: controller.signal }
        );
        setAllListings(data.listings);
        setTotalListings(data.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Failed to load listings. Please try again later.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchListings();
    return () => controller.abort();
  }, [debouncedSearch, selectedFuelType, selectedMake, selectedModel, selectedTrim, selectedYear, debouncedPriceMin, debouncedPriceMax, sortBy, currentPage]);

  useEffect(() => {
    if (selectedMake) {
      apiRequest<{ models: string[] }>(API_ENDPOINTS.cars.models(selectedMake))
        .then((data) => setAvailableModels(data.models || []))
        .catch(() => setAvailableModels([]));
    } else {
      setAvailableModels([]);
    }
    setSelectedModel("");
  }, [selectedMake]);

  useEffect(() => {
    if (selectedMake && selectedModel) {
      apiRequest<{ trims: string[] }>(API_ENDPOINTS.cars.trims(selectedMake, selectedModel))
        .then((data) => setAvailableTrims(data.trims || []))
        .catch(() => setAvailableTrims([]));
    } else {
      setAvailableTrims([]);
    }
    setSelectedTrim("");
  }, [selectedMake, selectedModel]);

  useEffect(() => {
    setFavorites(getFavoritesByType("used"));
  }, []);

  const toggleFavorite = (carId: number) => {
    toggleFav("used", carId);
    setFavorites(getFavoritesByType("used"));
  };

  const [allBrands, setAllBrands] = useState<string[]>([]);
  useEffect(() => {
    apiRequest<{ brands: string[] }>(API_ENDPOINTS.cars.brands)
      .then((data) => setAllBrands(data.brands || []))
      .catch(() => setAllBrands([]));
  }, []);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1989 }, (_, i) => String(currentYear - i)),
    [currentYear]
  );

  const activeFilters = [selectedMake, selectedModel, selectedTrim, selectedYear, priceMin, priceMax, selectedFuelType].filter(Boolean);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMake("");
    setSelectedModel("");
    setSelectedTrim("");
    setSelectedYear("");
    setPriceMin("");
    setPriceMax("");
    setSelectedFuelType("");
  };

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const getPageNumbers = (current: number, total: number): (number | "...")[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/browse" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Used Cars</h1>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs font-medium">
              {totalListings} used cars
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

      {/* Brands pills */}
      <div className="shrink-0 border-b border-border/40 bg-card/50 px-4 md:px-6 py-2.5">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setSelectedMake("")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!selectedMake ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}
            >
              All Brands
            </button>
            {POPULAR_BRANDS.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedMake(brand)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedMake === brand ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="shrink-0 border-b border-border/40 bg-card px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by make, model, trim, or location..."
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

          {/* Controls row */}
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
                <span className="ml-1.5 h-4.5 min-w-4.5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
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

            {/* Active filter chips */}
            {activeFilters.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {selectedMake && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedMake}
                    <button onClick={() => setSelectedMake("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {selectedModel && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedModel}
                    <button onClick={() => setSelectedModel("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {selectedFuelType && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {FUEL_TYPES.find((f) => f.value === selectedFuelType)?.label || selectedFuelType}
                    <button onClick={() => setSelectedFuelType("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {selectedYear && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedYear}
                    <button onClick={() => setSelectedYear("")}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {selectedTrim && (
                  <Badge variant="secondary" className="whitespace-nowrap text-xs gap-1">
                    {selectedTrim}
                    <button onClick={() => setSelectedTrim("")}><X className="h-3 w-3" /></button>
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
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
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
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Make</label>
                  <div className="relative">
                    <select
                      value={selectedMake}
                      onChange={(e) => setSelectedMake(e.target.value)}
                      className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
                    >
                      <option value="">All makes</option>
                      {allBrands.map((make) => (
                        <option key={make} value={make}>{make}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={!selectedMake}
                      className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{selectedMake ? "All models" : "Select make first"}</option>
                      {availableModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fuel Type</label>
                  <div className="relative">
                    <select
                      value={selectedFuelType}
                      onChange={(e) => setSelectedFuelType(e.target.value)}
                      className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
                    >
                      <option value="">All fuels</option>
                      {FUEL_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Year</label>
                  <div className="relative">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
                    >
                      <option value="">All years</option>
                      {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Trim</label>
                  <div className="relative">
                    <select
                      value={selectedTrim}
                      onChange={(e) => setSelectedTrim(e.target.value)}
                      disabled={!selectedModel}
                      className="h-9 w-full px-3 rounded-lg border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{selectedModel ? "All trims" : "Select model first"}</option>
                      {availableTrims.map((trim) => (
                        <option key={trim} value={trim}>{trim}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Min Price (AED)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Max Price (AED)</label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter backdrop */}
      {showFilters && (
        <div
          className="fixed inset-0 z-0 md:hidden"
          onClick={() => setShowFilters(false)}
        />
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" onClick={() => showFilters && setShowFilters(false)}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 pb-safe">
          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <CarCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40">
              <p className="text-red-700 dark:text-red-300 text-center text-sm">{error}</p>
            </Card>
          )}

          {/* Empty state */}
          {!isLoading && !error && allListings.length === 0 && (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No cars found</h3>
              <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or search query.</p>
              <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
            </div>
          )}

          {/* Listings */}
          {!isLoading && !error && allListings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {allListings.map((car, i) => (
                <CarCard
                  key={car.id}
                  car={car}
                  index={i}
                  isFavorite={favorites.includes(car.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-8 pb-24 md:pb-8">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPageNumbers(currentPage, totalPages).map((page, i) =>
                page === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
                ) : (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToPage(page as number)}
                    className="h-9 w-9 p-0 text-sm"
                  >
                    {page}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => goToPage(currentPage + 1)}
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
