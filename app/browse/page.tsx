"use client";

import { useState, useEffect } from "react";
import { Search, Filter, X, MapPin, Gauge, Heart, Car } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

interface CarListing {
  id: number;
  make: string;
  model: string;
  year: number;
  price: string;
  predictedPrice?: string;
  dealLabel?: "Good Deal" | "Fair" | "Overpriced";
  mileage: string;
  location: string;
  image: string;
}

export default function Browse() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [sortBy, setSortBy] = useState("newest");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showAllBestDeals, setShowAllBestDeals] = useState(false);
  const [showAllRecentlyAdded, setShowAllRecentlyAdded] = useState(false);
  const [showAllLowMileage, setShowAllLowMileage] = useState(false);
  const [allListings, setAllListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch listings from API
  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiRequest<CarListing[]>(`${API_ENDPOINTS.cars.list}?limit=100`);
        setAllListings(data);
      } catch (err) {
        console.error('Failed to fetch listings:', err);
        setError('Failed to load listings. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('carFavorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  const toggleFavorite = (carId: number) => {
    const newFavorites = favorites.includes(carId) 
      ? favorites.filter(id => id !== carId)
      : [...favorites, carId];
    
    setFavorites(newFavorites);
    localStorage.setItem('carFavorites', JSON.stringify(newFavorites));
  };

  // Extract unique makes and years from loaded listings
  const makes = Array.from(new Set(allListings.map(l => l.make))).sort();
  const years = Array.from(new Set(allListings.map(l => l.year.toString()))).sort((a, b) => parseInt(b) - parseInt(a));

  // Filter listings
  const filteredListings = allListings.filter((listing) => {
    const matchesSearch =
      searchQuery === "" ||
      `${listing.make} ${listing.model}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.location.toLowerCase().includes(searchQuery.toLowerCase());

    const listingPrice = parseInt(listing.price.replace(/[$,]/g, ''));
    const minPrice = priceMin ? parseInt(priceMin) : 0;
    const maxPrice = priceMax ? parseInt(priceMax) : Infinity;
    const matchesPrice = listingPrice >= minPrice && listingPrice <= maxPrice;
    
    const matchesMake = selectedMake === "" || listing.make === selectedMake;
    const matchesYear = selectedYear === "" || listing.year.toString() === selectedYear;

    return matchesSearch && matchesPrice && matchesMake && matchesYear;
  });

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    const priceA = parseInt(a.price.replace(/[$,]/g, ''));
    const priceB = parseInt(b.price.replace(/[$,]/g, ''));
    
    switch (sortBy) {
      case "price-low":
        return priceA - priceB;
      case "price-high":
        return priceB - priceA;
      case "newest":
        return b.year - a.year;
      case "oldest":
        return a.year - b.year;
      default:
        return 0;
    }
  });

  const activeFiltersCount = [selectedMake, selectedYear, priceMin, priceMax].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedMake("");
    setSelectedYear("");
    setPriceMin("");
    setPriceMax("");
  };

  // Best Deals - cars priced below predicted price
  const bestDeals = allListings.filter(car => 
    car.predictedPrice && parseInt(car.price.replace(/[$,]/g, '')) < parseInt(car.predictedPrice.replace(/[$,]/g, ''))
  );
  const displayedBestDeals = showAllBestDeals ? bestDeals : bestDeals.slice(0, 4);

  // Recently Added - newest cars
  const recentlyAdded = [...allListings].sort((a, b) => b.year - a.year);
  const displayedRecentlyAdded = showAllRecentlyAdded ? recentlyAdded : recentlyAdded.slice(0, 4);

  // Low Mileage Gems - just using random cars for now
  const lowMileageGems = allListings;
  const displayedLowMileage = showAllLowMileage ? lowMileageGems : lowMileageGems.slice(0, 4);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header with blur effect */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Browse Cars</h1>
          </div>
          <Link href="/profile">
            <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-red-500 transition-all">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Saif" />
              <AvatarFallback>S</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="shrink-0 bg-card border-b border-border px-4 py-4">
        <div className="max-w-6xl mx-auto space-y-4">
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by make, model, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-12 bg-secondary/50 border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="relative"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>

            {/* Active Filter Tags */}
            {activeFiltersCount > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {selectedMake && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {selectedMake}
                    <button onClick={() => setSelectedMake("")} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedCondition && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {selectedCondition}
                    <button onClick={() => setSelectedCondition("")} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedYear && (
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {selectedYear}
                    <button onClick={() => setSelectedYear("")} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="shrink-0 bg-card border-b border-border px-4 py-4">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filters</h3>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Price Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Price</label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Price</label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                />
              </div>

              {/* Make */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Make</label>
                <select
                  value={selectedMake}
                  onChange={(e) => setSelectedMake(e.target.value)}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">All makes</option>
                  {makes.map((make) => (
                    <option key={make} value={make}>
                      {make}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">All years</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Results */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-6xl mx-auto px-4 py-6 pb-safe space-y-8">
          
          {/* Best Deals Section */}
          <div>
            <div className="mb-4">
              <h3 className="text-3xl font-extrabold text-foreground flex items-center gap-2 mb-2">
                <Car className="h-7 w-7 text-primary fill-primary" />
                Best Deals
              </h3>
              <p className="text-base text-muted-foreground">
                Our AI-powered analysis identified these vehicles as exceptional value opportunities, priced below market predictions
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {displayedBestDeals.map((car) => (
                <Card
                  key={car.id}
                  className="overflow-hidden shadow-xl border border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl hover:shadow-2xl hover:border-primary/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative"
                >
                  <div className="relative">
                    <img
                      src={car.image}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full h-48 object-cover"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm shadow-lg transition-all duration-200 active:scale-95"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(car.id);
                      }}
                    >
                      <Heart 
                        className={`h-5 w-5 transition-colors duration-200 ${
                          favorites.includes(car.id) 
                            ? 'text-red-500 fill-red-500' 
                            : 'text-gray-600 hover:text-red-500'
                        }`} 
                      />
                    </Button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-lg text-foreground">
                          {car.year} {car.make} {car.model}
                        </h4>
                        <div className="mt-1 space-y-1">
                          <p className="text-2xl font-bold text-primary">{car.price}</p>
                          {car.predictedPrice && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">AI Predicted:</span>
                              <span className="text-sm text-muted-foreground line-through decoration-2 decoration-muted-foreground/60">
                                {car.predictedPrice}
                              </span>
                              {car.dealLabel && (
                                <Badge 
                                  variant={car.dealLabel === "Good Deal" ? "default" : car.dealLabel === "Overpriced" ? "destructive" : "secondary"}
                                  className={car.dealLabel === "Good Deal" ? "text-xs bg-green-100 text-green-800 border-green-200" : "text-xs"}
                                >
                                  {car.dealLabel}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-4 w-4" />
                        {car.mileage}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {car.location}
                      </span>
                    </div>

                    <Link href={`/listing/${car.id}`}>
                      <Button variant="outline" className="w-full rounded-xl h-11 font-medium border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 transition-all">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>

            {bestDeals.length > 4 && (
              <Button
                variant="outline"
                className="w-full mt-4 h-12 rounded-xl font-medium"
                onClick={() => setShowAllBestDeals(!showAllBestDeals)}
              >
                {showAllBestDeals ? "Show Less" : `Load More (${bestDeals.length - 4} more)`}
              </Button>
            )}
          </div>

          {/* Recently Added Section */}
          <div>
            <div className="mb-4">
              <h3 className="text-3xl font-extrabold text-foreground flex items-center gap-2 mb-2">
                <Car className="h-7 w-7 text-primary fill-primary" />
                Recently Added
              </h3>
              <p className="text-base text-muted-foreground">
                The newest vehicles just added to our marketplace
              </p>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-muted-foreground">Loading listings...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <p className="text-red-800 dark:text-red-300 text-center">{error}</p>
              </Card>
            )}

            {/* Listings */}
            {!isLoading && !error && (
              <div className="grid grid-cols-1 gap-4">
                {displayedRecentlyAdded.map((car) => (
                  <Card
                    key={car.id}
                    className="overflow-hidden shadow-xl border border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl hover:shadow-2xl hover:border-primary/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative"
                  >
                    <div className="relative">
                      <img
                        src={car.image}
                        alt={`${car.year} ${car.make} ${car.model}`}
                        className="w-full h-48 object-cover"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm shadow-lg transition-all duration-200 active:scale-95"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(car.id);
                        }}
                      >
                        <Heart 
                          className={`h-5 w-5 transition-colors duration-200 ${
                            favorites.includes(car.id) 
                              ? 'text-red-500 fill-red-500' 
                              : 'text-gray-600 hover:text-red-500'
                          }`} 
                        />
                      </Button>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-lg text-foreground">
                            {car.year} {car.make} {car.model}
                          </h4>
                          <div className="mt-1 space-y-1">
                            <p className="text-2xl font-bold text-primary">{car.price}</p>
                            {car.predictedPrice && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">AI Predicted:</span>
                                <span className="text-sm text-muted-foreground line-through">
                                  {car.predictedPrice}
                                </span>
                                {car.dealLabel && (
                                  <Badge 
                                    variant={car.dealLabel === "Good Deal" ? "default" : car.dealLabel === "Overpriced" ? "destructive" : "secondary"}
                                    className={car.dealLabel === "Good Deal" ? "text-xs bg-green-100 text-green-800 border-green-200" : "text-xs"}
                                  >
                                    {car.dealLabel}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="h-4 w-4" />
                          {car.mileage}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {car.location}
                        </span>
                      </div>

                      <Link href={`/listing/${car.id}`}>
                        <Button variant="outline" className="w-full rounded-xl h-11 font-medium border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 transition-all">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Low Mileage Gems Section */}
          <div>
            <div className="mb-4">
              <h3 className="text-3xl font-extrabold text-foreground flex items-center gap-2 mb-2">
                <Car className="h-7 w-7 text-primary fill-primary" />
                Low Mileage Gems
              </h3>
              <p className="text-base text-muted-foreground">
                Well-maintained vehicles with impressively low odometer readings
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {displayedLowMileage.map((car) => (
                <Card
                  key={car.id}
                  className="overflow-hidden shadow-xl border border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl hover:shadow-2xl hover:border-primary/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative"
                >
                  <div className="relative">
                    <img
                      src={car.image}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full h-48 object-cover"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm shadow-lg transition-all duration-200 active:scale-95"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(car.id);
                      }}
                    >
                      <Heart 
                        className={`h-5 w-5 transition-colors duration-200 ${
                          favorites.includes(car.id) 
                            ? 'text-red-500 fill-red-500' 
                            : 'text-gray-600 hover:text-red-500'
                        }`} 
                      />
                    </Button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-lg text-foreground">
                          {car.year} {car.make} {car.model}
                        </h4>
                        <div className="mt-1 space-y-1">
                          <p className="text-2xl font-bold text-primary">{car.price}</p>
                          {car.predictedPrice && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">AI Predicted:</span>
                              <span className="text-sm text-muted-foreground line-through">
                                {car.predictedPrice}
                              </span>
                              {car.dealLabel && (
                                <Badge 
                                  variant={car.dealLabel === "Good Deal" ? "default" : car.dealLabel === "Overpriced" ? "destructive" : "secondary"}
                                  className={car.dealLabel === "Good Deal" ? "text-xs bg-green-100 text-green-800 border-green-200" : "text-xs"}
                                >
                                  {car.dealLabel}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-4 w-4" />
                        {car.mileage}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {car.location}
                      </span>
                    </div>

                    <Link href={`/listing/${car.id}`}>
                      <Button variant="outline" className="w-full rounded-xl h-11 font-medium border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 transition-all">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>

            {lowMileageGems.length > 4 && (
              <Button
                variant="outline"
                className="w-full mt-4 h-12 rounded-xl font-medium"
                onClick={() => setShowAllLowMileage(!showAllLowMileage)}
              >
                {showAllLowMileage ? "Show Less" : `Load More (${lowMileageGems.length - 4} more)`}
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}