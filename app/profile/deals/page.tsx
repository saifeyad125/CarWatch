"use client";

import React from "react";
import { ArrowLeft, TrendingDown, MapPin, Gauge, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Deal {
  id: number;
  carId: number;
  make: string;
  model: string;
  year: number;
  price: string;
  predictedPrice: string;
  savings: string;
  mileage: string;
  location: string;
  foundDate: string;
  image: string;
}

const mockDeals: Deal[] = [
  {
    id: 1,
    carId: 1,
    make: "Toyota",
    model: "Camry",
    year: 2022,
    price: "$24,500",
    predictedPrice: "$26,800",
    savings: "$2,300",
    mileage: "15,000 mi",
    location: "Los Angeles, CA",
    foundDate: "2 days ago",
    image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    carId: 2,
    make: "Honda",
    model: "Civic",
    year: 2023,
    price: "$28,900",
    predictedPrice: "$31,200",
    savings: "$2,300",
    mileage: "8,500 mi",
    location: "San Diego, CA",
    foundDate: "5 days ago",
    image: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    carId: 5,
    make: "BMW",
    model: "X3",
    year: 2023,
    price: "$48,500",
    predictedPrice: "$51,200",
    savings: "$2,700",
    mileage: "18,000 mi",
    location: "Chicago, IL",
    foundDate: "1 week ago",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=300&fit=crop"
  }
];

export default function DealsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Deals Found</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Stats Card */}
          <Card className="p-4 bg-gradient-to-r from-green-50 to-green-100/50 backdrop-blur-sm rounded-2xl border border-green-200 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center shadow-md">
                  <TrendingDown className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">8 Great Deals</h2>
                  <p className="text-sm text-green-700">
                    Total savings: $18,400 below market value
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Deals List */}
          <div className="space-y-4">
            {mockDeals.map((deal) => (
              <Card
                key={deal.id}
                className="overflow-hidden shadow-xl border-0 bg-card/50 backdrop-blur-sm rounded-2xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="relative">
                  <img
                    src={deal.image}
                    alt={`${deal.year} ${deal.make} ${deal.model}`}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white text-xs rounded-full shadow-lg">
                      Save {deal.savings}
                    </Badge>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-lg text-foreground">
                        {deal.year} {deal.make} {deal.model}
                      </h4>
                      <div className="mt-1 space-y-1">
                        <p className="text-2xl font-bold text-primary">{deal.price}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Market value:</span>
                          <span className="text-sm text-muted-foreground line-through decoration-2">
                            {deal.predictedPrice}
                          </span>
                          <span className="text-green-600 text-sm font-medium">
                            {deal.savings} below market
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="h-4 w-4" />
                      {deal.mileage}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {deal.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Found {deal.foundDate}
                    </span>
                  </div>

                  <Link href={`/listing/${deal.carId}`}>
                    <Button variant="outline" className="w-full rounded-xl h-11 font-medium border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Deal Details
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Empty state */}
          {mockDeals.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-r from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <TrendingDown className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No deals found yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                We'll notify you when we find cars priced below market value that match your watchlists.
              </p>
              <Button 
                onClick={() => router.push('/watchlist')}
                className="rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              >
                Create Watchlist
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
