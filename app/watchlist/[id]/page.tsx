"use client";

import React, { useState } from "react";
import { ArrowLeft, MapPin, Gauge, Calendar, Bell, BellOff, Settings, Filter, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";

interface CarListing {
  id: number;
  make: string;
  model: string;
  year: number;
  price: string;
  predictedPrice: string;
  mileage: string;
  location: string;
  condition: string;
  image: string;
  daysOnMarket: number;
  matchScore: number;
}

interface WatchlistDetails {
  id: number;
  title: string;
  make: string;
  model: string;
  yearRange: string;
  priceRange: string;
  location: string;
  isActive: boolean;
  lastChecked: string;
  conditions: string[];
  totalMatches: number;
  newMatches: number;
  listings: CarListing[];
}

// Mock data - in real app this would come from an API
const getWatchlistDetails = (id: string): WatchlistDetails => {
  const watchlists: Record<string, WatchlistDetails> = {
    "1": {
      id: 1,
      title: "Toyota Camry 2020-2023",
      make: "Toyota",
      model: "Camry",
      yearRange: "2020-2023",
      priceRange: "$20,000 - $28,000",
      location: "Los Angeles Area",
      isActive: true,
      lastChecked: "2 hours ago",
      conditions: ["Used", "Certified Pre-Owned"],
      totalMatches: 8,
      newMatches: 3,
      listings: [
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
          daysOnMarket: 5,
          matchScore: 95
        },
        {
          id: 5,
          make: "Toyota",
          model: "Camry",
          year: 2021,
          price: "$22,900",
          predictedPrice: "$24,500",
          mileage: "28,000 mi",
          location: "Pasadena, CA",
          condition: "Used",
          image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=300&fit=crop",
          daysOnMarket: 12,
          matchScore: 88
        },
        {
          id: 6,
          make: "Toyota",
          model: "Camry",
          year: 2023,
          price: "$27,200",
          predictedPrice: "$28,900",
          mileage: "12,000 mi",
          location: "Long Beach, CA",
          condition: "Certified Pre-Owned",
          image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=300&fit=crop",
          daysOnMarket: 8,
          matchScore: 92
        }
      ]
    },
    "2": {
      id: 2,
      title: "Honda Accord Sport",
      make: "Honda",
      model: "Accord",
      yearRange: "2021-2024",
      priceRange: "$22,000 - $30,000",
      location: "San Diego",
      isActive: true,
      lastChecked: "1 hour ago",
      conditions: ["Used"],
      totalMatches: 5,
      newMatches: 1,
      listings: [
        {
          id: 2,
          make: "Honda",
          model: "Accord",
          year: 2023,
          price: "$28,900",
          predictedPrice: "$31,200",
          mileage: "8,500 mi",
          location: "San Diego, CA",
          condition: "Used",
          image: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=400&h=300&fit=crop",
          daysOnMarket: 3,
          matchScore: 96
        }
      ]
    },
    "3": {
      id: 3,
      title: "Tesla Model 3",
      make: "Tesla",
      model: "Model 3",
      yearRange: "2022-2024",
      priceRange: "$35,000 - $45,000",
      location: "Bay Area",
      isActive: true,
      lastChecked: "30 minutes ago",
      conditions: ["Used", "New"],
      totalMatches: 0,
      newMatches: 0,
      listings: []
    },
    // Add more watchlists as needed
  };

  return watchlists[id] || watchlists["1"];
};

export default function WatchlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const watchlist = getWatchlistDetails(id);
  const [sortBy, setSortBy] = useState<"match" | "price" | "days">("match");
  
  const sortedListings = [...watchlist.listings].sort((a, b) => {
    switch (sortBy) {
      case "match":
        return b.matchScore - a.matchScore;
      case "price":
        return parseInt(a.price.replace(/[$,]/g, '')) - parseInt(b.price.replace(/[$,]/g, ''));
      case "days":
        return a.daysOnMarket - b.daysOnMarket;
      default:
        return 0;
    }
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Watchlist Details</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
            >
              {watchlist.isActive ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Watchlist Info Card */}
        <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{watchlist.title}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="font-medium">{watchlist.yearRange}</span>
                  <span>•</span>
                  <span className="font-medium">{watchlist.priceRange}</span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${watchlist.isActive ? "bg-green-500" : "bg-gray-400"}`} />
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {watchlist.location}
              </span>
              <span>•</span>
              <span>Updated {watchlist.lastChecked}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {watchlist.conditions.map((condition) => (
                  <Badge key={condition} variant="secondary" className="text-xs rounded-full">
                    {condition}
                  </Badge>
                ))}
              </div>
              {watchlist.newMatches > 0 && (
                <Badge variant="default" className="text-xs bg-red-500 text-white rounded-full px-3">
                  {watchlist.newMatches} new
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-primary">{watchlist.totalMatches}</div>
              <div className="text-sm text-muted-foreground">Total Matches</div>
            </Card>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-green-600">{watchlist.newMatches}</div>
              <div className="text-sm text-muted-foreground">New Today</div>
            </Card>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-blue-600">
                {watchlist.listings.length > 0 ? Math.round(watchlist.listings.reduce((sum, item) => sum + item.matchScore, 0) / watchlist.listings.length) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Match</div>
            </Card>
          </div>

          {/* Sort Controls */}
          <Card className="p-4 bg-card/50 backdrop-blur-sm rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Sort by:</span>
              <div className="flex gap-2">
                {[
                  { key: "match", label: "Best Match" },
                  { key: "price", label: "Price" },
                  { key: "days", label: "Newest" }
                ].map((option) => (
                  <Button
                    key={option.key}
                    variant={sortBy === option.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy(option.key as any)}
                    className="text-xs rounded-xl"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* Listings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Star className="h-5 w-5 text-primary fill-primary" />
              Matching Listings ({sortedListings.length})
            </h3>
            
            {sortedListings.map((car) => {
              const isGoodDeal = parseInt(car.price.replace(/[$,]/g, '')) < parseInt(car.predictedPrice.replace(/[$,]/g, ''));
              
              return (
                <Card
                  key={car.id}
                  className="overflow-hidden shadow-xl border border-border/30 bg-card/50 backdrop-blur-sm rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="relative">
                    <img
                      src={car.image}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <Badge className="bg-primary text-white text-xs rounded-full px-3">
                        {car.matchScore}% match
                      </Badge>
                      {isGoodDeal && (
                        <Badge className="bg-green-500 text-white text-xs rounded-full">
                          Good Deal
                        </Badge>
                      )}
                      {car.daysOnMarket <= 7 && (
                        <Badge variant="secondary" className="text-xs rounded-full">
                          New
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-5 h-[280px] flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg text-foreground truncate">
                          {car.year} {car.make} {car.model}
                        </h4>
                        <div className="mt-1 space-y-1">
                          <p className="text-2xl font-bold text-primary">{car.price}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-muted-foreground">AI Predicted:</span>
                            <span className="text-sm text-muted-foreground line-through decoration-2 decoration-muted-foreground/60">
                              {car.predictedPrice}
                            </span>
                            {isGoodDeal && (
                              <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                                Good Deal
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs rounded-full px-3 ml-2 shrink-0">
                        {car.condition}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4 flex-1">
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-4 w-4 shrink-0" />
                        <span className="truncate">{car.mileage}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{car.location}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span className="truncate">{car.daysOnMarket} days on market</span>
                      </span>
                    </div>

                    <div className="mt-auto">
                      <Link href={`/listing/${car.id}`}>
                        <Button variant="outline" className="w-full rounded-xl h-11 font-medium">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {sortedListings.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No matches yet</h3>
              <p className="text-muted-foreground mb-4">
                We're actively searching for cars that match your criteria. New listings are checked every hour.
              </p>
              <Button variant="outline" className="rounded-2xl">
                <Bell className="h-4 w-4 mr-2" />
                Get Notified
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
