"use client"

import { ArrowLeft, Heart, Share2, MapPin, Gauge, Calendar, Shield, TrendingDown, TrendingUp, Phone, MessageCircle, Star, User, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use } from "react";

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
  description: string;
  vin: string;
  seller: {
    name: string;
    rating: number;
    totalSales: number;
    memberSince: string;
    verified: boolean;
    avatar: string;
    phone: string;
  };
  features: string[];
  marketAnalysis: {
    depreciation: {
      oneYear: number;
      threeYear: number;
      fiveYear: number;
    };
    marketTrend: "rising" | "stable" | "declining";
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

// Mock data - in real app this would come from an API
const getCarListing = (id: string): CarListing => {
  const listings: Record<string, CarListing> = {
    "1": {
      id: 1,
      make: "Toyota",
      model: "Camry",
      year: 2022,
      price: "$24,500",
      predictedPrice: "$26,800",
      mileage: "15,000 mi",
      location: "Los Angeles, CA",
      condition: "Used",
      image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
      description: "Well-maintained 2022 Toyota Camry with low mileage. Single owner, garage kept. Regular maintenance records available. This reliable sedan offers excellent fuel economy and Toyota's renowned reliability.",
      vin: "4T1C11AK8NU123456",
      seller: {
        name: "Mike Chen",
        rating: 4.8,
        totalSales: 23,
        memberSince: "2019",
        verified: true,
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
        phone: "+1 (555) 123-4567"
      },
      features: [
        "Backup Camera", "Bluetooth Connectivity", "Cruise Control", "USB Ports",
        "Air Conditioning", "Power Windows", "Keyless Entry", "Safety Sense 2.0"
      ],
      marketAnalysis: {
        depreciation: { oneYear: 12, threeYear: 32, fiveYear: 55 },
        marketTrend: "stable",
        priceHistory: [
          { month: "Jan", averagePrice: 27500 },
          { month: "Feb", averagePrice: 27200 },
          { month: "Mar", averagePrice: 26900 },
          { month: "Apr", averagePrice: 26700 },
          { month: "May", averagePrice: 26500 },
          { month: "Jun", averagePrice: 26800 }
        ],
        similarListings: [
          { price: "$25,200", mileage: "18,000 mi", daysOnMarket: 12 },
          { price: "$23,800", mileage: "22,000 mi", daysOnMarket: 8 },
          { price: "$26,100", mileage: "12,000 mi", daysOnMarket: 24 }
        ]
      }
    },
    "2": {
      id: 2,
      make: "Honda",
      model: "Civic",
      year: 2023,
      price: "$28,900",
      predictedPrice: "$31,200",
      mileage: "8,500 mi",
      location: "San Diego, CA",
      condition: "Certified Pre-Owned",
      image: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&h=600&fit=crop",
      description: "Honda Certified Pre-Owned Civic with low mileage and extended warranty. This sporty compact sedan features Honda Sensing safety suite and excellent fuel efficiency. Perfect for daily commuting.",
      vin: "2HGFC2F59NH123456",
      seller: {
        name: "Sarah Johnson",
        rating: 4.9,
        totalSales: 34,
        memberSince: "2018",
        verified: true,
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        phone: "+1 (555) 234-5678"
      },
      features: [
        "Honda Sensing", "Apple CarPlay", "Android Auto", "Heated Seats",
        "Sunroof", "Alloy Wheels", "LED Headlights", "Remote Start"
      ],
      marketAnalysis: {
        depreciation: { oneYear: 15, threeYear: 35, fiveYear: 58 },
        marketTrend: "rising",
        priceHistory: [
          { month: "Jan", averagePrice: 29500 },
          { month: "Feb", averagePrice: 30200 },
          { month: "Mar", averagePrice: 30800 },
          { month: "Apr", averagePrice: 31000 },
          { month: "May", averagePrice: 31200 },
          { month: "Jun", averagePrice: 31500 }
        ],
        similarListings: [
          { price: "$29,800", mileage: "12,000 mi", daysOnMarket: 5 },
          { price: "$27,900", mileage: "15,000 mi", daysOnMarket: 18 },
          { price: "$30,500", mileage: "6,000 mi", daysOnMarket: 3 }
        ]
      }
    },
    "3": {
      id: 3,
      make: "Tesla",
      model: "Model 3",
      year: 2023,
      price: "$42,000",
      predictedPrice: "$39,500",
      mileage: "12,000 mi",
      location: "San Francisco, CA",
      condition: "Used",
      image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&h=600&fit=crop",
      description: "Tesla Model 3 Standard Range Plus in excellent condition. Autopilot included, over-the-air updates, and access to Supercharger network. Clean title, no accidents. Premium interior upgrade package.",
      vin: "5YJ3E1EA4NF123456",
      seller: {
        name: "David Rodriguez",
        rating: 4.7,
        totalSales: 12,
        memberSince: "2020",
        verified: true,
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
        phone: "+1 (555) 345-6789"
      },
      features: [
        "Autopilot", "Premium Audio", "Glass Roof", "Wireless Charging",
        "Heated Seats", "Navigation", "Mobile Connector", "Supercharging"
      ],
      marketAnalysis: {
        depreciation: { oneYear: 20, threeYear: 45, fiveYear: 65 },
        marketTrend: "declining",
        priceHistory: [
          { month: "Jan", averagePrice: 44500 },
          { month: "Feb", averagePrice: 43200 },
          { month: "Mar", averagePrice: 41800 },
          { month: "Apr", averagePrice: 40500 },
          { month: "May", averagePrice: 39800 },
          { month: "Jun", averagePrice: 39200 }
        ],
        similarListings: [
          { price: "$41,500", mileage: "15,000 mi", daysOnMarket: 21 },
          { price: "$43,200", mileage: "8,000 mi", daysOnMarket: 14 },
          { price: "$40,800", mileage: "18,000 mi", daysOnMarket: 32 }
        ]
      }
    },
    "4": {
      id: 4,
      make: "Ford",
      model: "F-150",
      year: 2024,
      price: "$52,900",
      predictedPrice: "$54,700",
      mileage: "New",
      location: "Austin, TX",
      condition: "New",
      image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&h=600&fit=crop",
      description: "Brand new 2024 Ford F-150 XLT SuperCrew. America's best-selling truck with advanced towing capabilities and Ford Co-Pilot360 safety features. Factory warranty included.",
      vin: "1FTFW1E59NFE12345",
      seller: {
        name: "Austin Ford Dealership",
        rating: 4.6,
        totalSales: 156,
        memberSince: "2015",
        verified: true,
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ford",
        phone: "+1 (555) 456-7890"
      },
      features: [
        "Co-Pilot360", "SYNC 4", "Pro Trailer Backup", "4WD",
        "Bed Liner", "Running Boards", "Tow Package", "Remote Start"
      ],
      marketAnalysis: {
        depreciation: { oneYear: 18, threeYear: 40, fiveYear: 62 },
        marketTrend: "stable",
        priceHistory: [
          { month: "Jan", averagePrice: 53500 },
          { month: "Feb", averagePrice: 54000 },
          { month: "Mar", averagePrice: 54200 },
          { month: "Apr", averagePrice: 54500 },
          { month: "May", averagePrice: 54700 },
          { month: "Jun", averagePrice: 54800 }
        ],
        similarListings: [
          { price: "$53,800", mileage: "0 mi", daysOnMarket: 7 },
          { price: "$51,900", mileage: "2,500 mi", daysOnMarket: 15 },
          { price: "$55,200", mileage: "0 mi", daysOnMarket: 4 }
        ]
      }
    }
  };

  return listings[id] || listings["1"];
};

export default function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const car = getCarListing(id);

  const isGoodDeal = parseInt(car.price.replace(/[$,]/g, '')) < parseInt(car.predictedPrice.replace(/[$,]/g, ''));

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
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Heart className="h-5 w-5" />
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
                    <Badge variant="secondary">{car.condition}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">AI Predicted:</span>
                    <span className="text-sm text-muted-foreground line-through decoration-2">
                      {car.predictedPrice}
                    </span>
                    {isGoodDeal ? (
                      <span className="text-green-600 text-sm font-medium">
                        ${parseInt(car.predictedPrice.replace(/[$,]/g, '')) - parseInt(car.price.replace(/[$,]/g, ''))} below market
                      </span>
                    ) : (
                      <span className="text-red-600 text-sm font-medium">
                        ${parseInt(car.price.replace(/[$,]/g, '')) - parseInt(car.predictedPrice.replace(/[$,]/g, ''))} above market
                      </span>
                    )}
                  </div>
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
                <Shield className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-lg font-bold text-foreground">{car.condition}</div>
                <div className="text-xs text-muted-foreground">Condition</div>
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
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">VIN:</span> {car.vin}
                </div>
              </div>
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
                    {car.seller.verified && (
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">{car.seller.rating}</span>
                    <span className="text-sm text-muted-foreground">
                      • {car.seller.totalSales} sales
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Member since {car.seller.memberSince}
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
