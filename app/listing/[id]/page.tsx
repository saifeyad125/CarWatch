"use client"

import { ArrowLeft, Heart, Share2, MapPin, Gauge, Calendar, Shield, TrendingDown, TrendingUp, Phone, MessageCircle, Star, User, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use, useEffect, useState } from "react";
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
  description: string;
  url: string;
  seller: {
    name: string;
    avatar: string;
    phone: string;
    type: string;
  };
  features: string[];
  marketAnalysis: {
    depreciation: {
      oneYear: number;
      threeYear: number;
      fiveYear: number;
    };
    marketTrend: string;
    priceHistory: Array<{
      month: string;
      averagePrice: number;
    }>;
    similarListings: Array<{
      price: string;
      mileage: string;
      daysOnMarket: number;
    }>;
  };
}

export default function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [car, setCar] = useState<CarListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  // Fetch car details from API
  useEffect(() => {
    const fetchCarDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiRequest<CarListing>(API_ENDPOINTS.cars.detail(parseInt(id)));
        setCar(data);
      } catch (err) {
        console.error('Failed to fetch car details:', err);
        setError('Failed to load car details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCarDetails();
  }, [id]);

  // Check if car is in favorites
  useEffect(() => {
    const savedFavorites = localStorage.getItem('carFavorites');
    if (savedFavorites) {
      const favorites = JSON.parse(savedFavorites);
      setIsFavorite(favorites.includes(parseInt(id)));
    }
  }, [id]);

  const toggleFavorite = () => {
    const savedFavorites = localStorage.getItem('carFavorites');
    let favorites = savedFavorites ? JSON.parse(savedFavorites) : [];
    
    if (isFavorite) {
      favorites = favorites.filter((fav: number) => fav !== parseInt(id));
    } else {
      favorites.push(parseInt(id));
    }
    
    localStorage.setItem('carFavorites', JSON.stringify(favorites));
    setIsFavorite(!isFavorite);
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Car Details</h1>
            <div className="w-20"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Loading car details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !car) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Car Details</h1>
            <div className="w-20"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <p className="text-red-800 dark:text-red-300 text-center">
              {error || 'Car not found'}
            </p>
            <Button onClick={() => router.back()} className="w-full mt-4">
              Go Back
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const isGoodDeal = car.dealLabel === "Good Deal";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Car Details</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10"
              onClick={toggleFavorite}
            >
              <Heart 
                className={`h-5 w-5 transition-colors duration-200 ${
                  isFavorite 
                    ? 'text-red-500 fill-red-500' 
                    : 'text-gray-600'
                }`} 
              />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="space-y-6 pb-safe">
          {/* Car Image */}
          <div className="relative">
            <img
              src={car.image}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="w-full h-64 object-cover"
            />
            <div className="absolute top-4 left-4">
              {isGoodDeal && (
                <Badge className="bg-green-500 text-white">
                  Good Deal
                </Badge>
              )}
            </div>
          </div>

          <div className="px-4 space-y-6">
            {/* Main Info */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {car.year} {car.make} {car.model}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {car.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-4 w-4" />
                    {car.mileage}
                  </span>
                </div>
              </div>

              {/* Price Section */}
              <Card className="p-4 bg-card/50 backdrop-blur-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-primary">{car.price}</span>
                    {car.dealLabel && (
                      <Badge 
                        variant={car.dealLabel === "Good Deal" ? "default" : car.dealLabel === "Overpriced" ? "destructive" : "secondary"}
                        className={car.dealLabel === "Good Deal" ? "bg-green-100 text-green-800 border-green-200" : ""}
                      >
                        {car.dealLabel}
                      </Badge>
                    )}
                  </div>
                  {car.predictedPrice && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">AI Predicted:</span>
                      <span className="text-sm text-muted-foreground line-through decoration-2">
                        {car.predictedPrice}
                      </span>
                      {isGoodDeal ? (
                        <span className="text-green-600 text-sm font-medium">
                          ${parseInt(car.predictedPrice.replace(/[$,]/g, '')) - parseInt(car.price.replace(/[$,]/g, ''))} below market
                        </span>
                      ) : car.dealLabel === "Overpriced" ? (
                        <span className="text-red-600 text-sm font-medium">
                          ${parseInt(car.price.replace(/[$,]/g, '')) - parseInt(car.predictedPrice.replace(/[$,]/g, ''))} above market
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center bg-card/50 backdrop-blur-sm">
                <Calendar className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-lg font-bold text-foreground">{car.year}</div>
                <div className="text-xs text-muted-foreground">Year</div>
              </Card>
              <Card className="p-4 text-center bg-card/50 backdrop-blur-sm">
                <Gauge className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-lg font-bold text-foreground">{car.mileage.split(' ')[0]}</div>
                <div className="text-xs text-muted-foreground">Miles</div>
              </Card>
              <Card className="p-4 text-center bg-card/50 backdrop-blur-sm">
                <MapPin className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-lg font-bold text-foreground">{car.location.split(',')[0]}</div>
                <div className="text-xs text-muted-foreground">Location</div>
              </Card>
            </div>

            {/* Market Analysis */}
            <Card className="p-5 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Market Analysis</h3>
              </div>
              
              <div className="space-y-4">
                {/* Value Depreciation */}
                <div>
                  <h4 className="font-medium text-foreground mb-3">Expected Value Depreciation</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <div className="text-lg font-bold text-red-600">-{car.marketAnalysis.depreciation.oneYear}%</div>
                      <div className="text-xs text-muted-foreground">1 Year</div>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">-{car.marketAnalysis.depreciation.threeYear}%</div>
                      <div className="text-xs text-muted-foreground">3 Years</div>
                    </div>
                    <div className="text-center p-3 bg-background/50 rounded-lg">
                      <div className="text-lg font-bold text-red-700">-{car.marketAnalysis.depreciation.fiveYear}%</div>
                      <div className="text-xs text-muted-foreground">5 Years</div>
                    </div>
                  </div>
                </div>

                {/* Market Trend */}
                <div>
                  <h4 className="font-medium text-foreground mb-3">6-Month Price Trend</h4>
                  <div className="space-y-2">
                    {car.marketAnalysis.priceHistory.map((data, index) => (
                      <div key={data.month} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{data.month}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ 
                                width: `${(data.averagePrice / 28000) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">${(data.averagePrice / 1000).toFixed(0)}k</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* More Detail Analysis Button */}
                <div className="pt-4 border-t border-border">
                  <Link href={`/listing/${car.id}/analysis`}>
                    <Button variant="outline" className="w-full h-12 rounded-xl">
                      <TrendingUp className="mr-2 h-5 w-5" />
                      View Detailed Market Analysis
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            {/* Features */}
            <Card className="p-5 bg-card/50 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">Features & Equipment</h3>
              <div className="grid grid-cols-2 gap-3">
                {car.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Description */}
            <Card className="p-5 bg-card/50 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-foreground mb-3">Description</h3>
              <p className="text-muted-foreground leading-relaxed">{car.description}</p>
              {/* TODO: Add VIN field to backend schema */}
              {/* <div className="mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">VIN:</span> MOCK_VIN_NUMBER
                </div>
              </div> */}
            </Card>

            {/* Seller Info */}
            <Card className="p-5 bg-card/50 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">Seller Information</h3>
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={car.seller.avatar} />
                  <AvatarFallback>{car.seller.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">{car.seller.name}</h4>
                    {/* TODO: Add verified, rating, totalSales, memberSince to backend seller schema */}
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {car.seller.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Phone: {car.seller.phone}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="shrink-0 p-4 border-t border-border bg-card/80 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 rounded-xl">
            <MessageCircle className="mr-2 h-5 w-5" />
            Message
          </Button>
          <Button className="h-12 rounded-xl bg-primary hover:bg-primary/90">
            <Phone className="mr-2 h-5 w-5" />
            Call Seller
          </Button>
        </div>
      </div>
    </div>
  );
}
