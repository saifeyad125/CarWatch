"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Heart, Search, Filter, Star, MapPin, Gauge, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
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
}

const allListings: CarListing[] = [
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
];

export default function FavoritesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<number[]>([]);

  // Load favorites from localStorage on component mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('carFavorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  const removeFavorite = (carId: number) => {
    const newFavorites = favorites.filter(id => id !== carId);
    setFavorites(newFavorites);
    localStorage.setItem('carFavorites', JSON.stringify(newFavorites));
  };

  const favoriteListings = allListings.filter(car => favorites.includes(car.id));

  const filteredListings = favoriteListings.filter(car =>
    car.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    car.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${car.year}`.includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">My Favorites</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Search Bar */}
        {favoriteListings.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search favorites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-12 h-12 rounded-2xl border-border/50 bg-background/50 backdrop-blur-sm"
            />
            <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-xl">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Stats */}
          {favoriteListings.length > 0 && (
            <Card className="p-4 bg-gradient-to-r from-red-50 to-red-100/50 backdrop-blur-sm rounded-2xl border border-red-200 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shadow-md">
                    <Heart className="h-6 w-6 text-red-500 fill-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Your Favorites</h2>
                    <p className="text-sm text-red-700">
                      {favoriteListings.length} {favoriteListings.length === 1 ? 'car' : 'cars'} saved
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs rounded-full px-3 bg-red-100 text-red-700 border-red-200">
                  {favoriteListings.length}
                </Badge>
              </div>
            </Card>
          )}

          {/* Favorite Listings */}
          {filteredListings.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Star className="h-5 w-5 text-primary fill-primary" />
                Saved Cars ({filteredListings.length})
              </h3>
              
              {filteredListings.map((car) => {
                const isGoodDeal = parseInt(car.price.replace(/[$,]/g, '')) < parseInt(car.predictedPrice.replace(/[$,]/g, ''));
                
                return (
                  <Card
                    key={car.id}
                    className="overflow-hidden shadow-xl border-0 bg-card/50 backdrop-blur-sm rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative"
                  >
                    <div className="relative">
                      <img
                        src={car.image}
                        alt={`${car.year} ${car.make} ${car.model}`}
                        className="w-full h-48 object-cover"
                      />
                      {/* Remove from favorites button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/80 hover:bg-white backdrop-blur-sm shadow-lg transition-all duration-200 active:scale-95"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFavorite(car.id);
                        }}
                      >
                        <Trash2 className="h-5 w-5 text-red-500 hover:text-red-600" />
                      </Button>
                      
                      {/* Good deal badge */}
                      {isGoodDeal && (
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-green-500 text-white text-xs rounded-full">
                            Good Deal
                          </Badge>
                        </div>
                      )}
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
                              {isGoodDeal && (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                                  Good Deal
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
                        <Button variant="outline" className="w-full rounded-xl h-11 font-medium border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : favoriteListings.length === 0 ? (
            /* Empty state - no favorites */
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-r from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Heart className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No favorites yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Start exploring car listings and tap the heart icon to save your favorites here.
              </p>
              <Button 
                onClick={() => router.push('/')}
                className="rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              >
                Browse Listings
              </Button>
            </div>
          ) : (
            /* No search results */
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No matches found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms or browse all your favorites.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery('')}
                className="rounded-2xl border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white"
              >
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
