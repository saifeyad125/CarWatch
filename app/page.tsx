"use client";

import { Plus, TrendingUp, Bell, Star, MapPin, Gauge, Heart, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showAllListings, setShowAllListings] = useState(false);

  // Load favorites from localStorage on component mount
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

  const stats = [
    { label: "Active Alerts", value: "12", icon: Bell, color: "text-primary" },
    { label: "New Matches", value: "3", icon: TrendingUp, color: "text-primary" },
    { label: "Favorites", value: favorites.length.toString(), icon: Heart, color: "text-red-500", clickable: true },
  ];

  const popularListings = [
    {
      id: 1,
      make: "Toyota",
      model: "Camry",
      year: 2022,
      price: "$24,500",
      predictedPrice: "$26,800",
      mileage: "15,000 mi",
      location: "Los Angeles, CA",
      condition: "Used",
      image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=300&fit=crop",
    },
    {
      id: 2,
      make: "Honda",
      model: "Civic",
      year: 2023,
      price: "$28,900",
      predictedPrice: "$31,200",
      mileage: "8,500 mi",
      location: "San Diego, CA",
      condition: "Certified Pre-Owned",
      image: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=400&h=300&fit=crop",
    },
    {
      id: 3,
      make: "Tesla",
      model: "Model 3",
      year: 2023,
      price: "$42,000",
      predictedPrice: "$39,500",
      mileage: "12,000 mi",
      location: "San Francisco, CA",
      condition: "Used",
      image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&h=300&fit=crop",
    },
    {
      id: 4,
      make: "Ford",
      model: "F-150",
      year: 2024,
      price: "$52,900",
      predictedPrice: "$54,700",
      mileage: "New",
      location: "Austin, TX",
      condition: "New",
      image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&h=300&fit=crop",
    },
    {
      id: 5,
      make: "BMW",
      model: "X3",
      year: 2023,
      price: "$48,500",
      predictedPrice: "$46,200",
      mileage: "18,000 mi",
      location: "Chicago, IL",
      condition: "Used",
      image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=300&fit=crop",
    },
    {
      id: 6,
      make: "Mazda",
      model: "CX-5",
      year: 2022,
      price: "$29,800",
      predictedPrice: "$32,100",
      mileage: "22,000 mi",
      location: "Phoenix, AZ",
      condition: "Used",
      image: "https://images.unsplash.com/photo-1494976235849-72d2820cac2c?w=400&h=300&fit=crop",
    },
    {
      id: 7,
      make: "Audi",
      model: "A4",
      year: 2024,
      price: "$45,900",
      predictedPrice: "$44,500",
      mileage: "5,000 mi",
      location: "Miami, FL",
      condition: "Certified Pre-Owned",
      image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400&h=300&fit=crop",
    },
    {
      id: 8,
      make: "Subaru",
      model: "Outback",
      year: 2023,
      price: "$34,200",
      predictedPrice: "$35,800",
      mileage: "14,000 mi",
      location: "Seattle, WA",
      condition: "Used",
      image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop",
    },
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
          <Avatar className="h-10 w-10">
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Saif" />
            <AvatarFallback>S</AvatarFallback>
          </Avatar>
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">AI Predicted:</span>
                            <span className="text-sm text-muted-foreground line-through decoration-2 decoration-muted-foreground/60">
                              {car.predictedPrice}
                            </span>
                            {parseInt(car.price.replace(/[$,]/g, '')) < parseInt(car.predictedPrice.replace(/[$,]/g, '')) && (
                              <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                                Good Deal
                              </Badge>
                            )}
                            {parseInt(car.price.replace(/[$,]/g, '')) > parseInt(car.predictedPrice.replace(/[$,]/g, '')) && (
                              <Badge variant="destructive" className="text-xs">
                                Above Market
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs rounded-full px-3">
                        {car.condition}
                      </Badge>
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
