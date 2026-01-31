"use client";

import { Plus, TrendingUp, Bell, Star, MapPin, Gauge, Heart, Car, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function Home() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showAllListings, setShowAllListings] = useState(false);
  const [popularListings, setPopularListings] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load favorites from localStorage on component mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('carFavorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Fetch popular listings from API
  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiRequest<CarListing[]>(`${API_ENDPOINTS.cars.list}?limit=8`);
        setPopularListings(data);
      } catch (err) {
        console.error('Failed to fetch listings:', err);
        setError('Failed to load listings. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, []);

  const toggleFavorite = (carId: number) => {
    const newFavorites = favorites.includes(carId) 
      ? favorites.filter(id => id !== carId)
      : [...favorites, carId];
    
    setFavorites(newFavorites);
    localStorage.setItem('carFavorites', JSON.stringify(newFavorites));
  };

  const stats = [
    { label: "Active Alerts", value: "12", icon: Bell, color: "text-primary" },
    { label: "New Matches", value: "3", icon: TrendingUp, color: "text-primary" },
    { label: "Favorites", value: favorites.length.toString(), icon: Heart, color: "text-red-500", clickable: true },
  ];

  // Show only first 4 listings initially, then all if showAllListings is true
  const displayedListings = showAllListings ? popularListings : popularListings.slice(0, 4);

  const recentMonitors = [
    {
      id: 1,
      title: "Toyota Camry 2020-2023",
      make: "Toyota",
      model: "Camry",
      yearRange: "2020-2023",
      priceRange: "$20,000 - $28,000",
      location: "Los Angeles Area",
      matches: 3,
      isActive: true,
      lastChecked: "2 hours ago",
      conditions: ["Used", "Certified Pre-Owned"],
    },
    {
      id: 2,
      title: "Honda Accord Sport",
      make: "Honda", 
      model: "Accord",
      yearRange: "2021-2024",
      priceRange: "$22,000 - $30,000",
      location: "San Diego",
      matches: 1,
      isActive: true,
      lastChecked: "1 hour ago",
      conditions: ["Used"],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header with blur effect */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">CarWatch</h1>
          </div>
          <Link href="/profile">
            <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-red-500 transition-all">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Saif" />
              <AvatarFallback>S</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Hero Section */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="w-full h-52 bg-gradient-to-r from-red-500 via-red-600 to-red-700"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-red-900/60 to-red-800/30 flex items-center">
              <div className="px-6 text-white">
                <h2 className="text-3xl font-bold mb-2">Hi Saif 👋</h2>
                <p className="text-lg opacity-90">
                  Track your dream cars and never miss a deal
                </p>
              </div>
            </div>
          </div>



          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat) => (
              <Card
                key={stat.label}
                className={`p-4 shadow-lg border-0 bg-card/50 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all duration-200 ${
                  stat.clickable ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-2 hover:border-primary/30' : ''
                }`}
                onClick={() => {
                  if (stat.clickable && stat.label === "Favorites") {
                    router.push('/favorites');
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2 font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  </div>
                  <div className="p-2 bg-primary/15 rounded-xl border border-primary/20">
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Add New Button */}
          <Button className="w-full h-14 text-base font-semibold shadow-lg rounded-2xl bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-200 active:scale-98">
            <Plus className="mr-2 h-5 w-5" />
            Add New Car Listing to Monitor
          </Button>

          {/* Popular Listings */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Star className="h-6 w-6 text-primary fill-primary" />
                Popular Listings
              </h3>
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

            {/* Listings Grid */}
            {!isLoading && !error && (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {displayedListings.map((car) => (
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
                        {/* Favorite Heart Icon */}
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

                {/* Load More Button */}
                {!showAllListings && popularListings.length > 4 && (
                  <div className="mt-6 text-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAllListings(true)}
                      className="rounded-2xl h-12 px-8 font-medium shadow-lg hover:shadow-xl border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white transition-all duration-200 active:scale-95"
                    >
                      Load More Cars ({popularListings.length - 4} more)
                    </Button>
                  </div>
                )}

                {/* Show Less Button */}
                {showAllListings && (
                  <div className="mt-6 text-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAllListings(false)}
                      className="rounded-2xl h-12 px-8 font-medium shadow-lg hover:shadow-xl border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white transition-all duration-200 active:scale-95"
                    >
                      Show Less
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Active Monitors */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground">Active Monitors</h3>
              <Link href="/watchlist">
                <Button variant="outline" size="sm" className="rounded-xl border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white">
                  View All
                </Button>
              </Link>
            </div>

            <div className="space-y-4">
              {recentMonitors.map((item) => (
                <Link key={item.id} href={`/watchlist/${item.id}`}>
                  <Card className="overflow-hidden border-2 border-border/50 bg-card/60 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                    <div className="p-5 space-y-4">
                      {/* Header Section */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                              <Car className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-bold text-lg text-foreground">{item.title}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium">{item.yearRange}</span>
                                <span>•</span>
                                <span className="font-semibold text-primary">{item.priceRange}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {item.matches > 0 && (
                            <Badge variant="default" className="text-xs rounded-full px-3 bg-red-500 text-white">
                              {item.matches} new
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Active
                          </div>
                        </div>
                      </div>

                      {/* Details Section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {item.location}
                          </span>
                          <span>•</span>
                          <span>Updated {item.lastChecked}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            {item.conditions.map((condition) => (
                              <Badge key={condition} variant="outline" className="text-xs rounded-full px-3 border-border/60">
                                {condition}
                              </Badge>
                            ))}
                          </div>
                          
                          {item.matches > 0 ? (
                            <span className="text-primary font-medium text-sm">
                              {item.matches} new {item.matches === 1 ? "match" : "matches"} found
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              No new matches
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
