"use client";

import {
  ArrowLeft, Heart, Share2, MapPin, Gauge, Calendar,
  TrendingUp, CheckCircle, ChevronLeft, ChevronRight, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/ui/car-card";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { motion } from "framer-motion";

interface CarListing extends CarCardData {
  description: string;
  url: string;
  seller: { name: string; avatar: string; phone: string; type: string };
  features: string[];
  images?: string[];
  marketAnalysis: {
    depreciation: { oneYear: number; threeYear: number; fiveYear: number };
    marketTrend: string;
    priceHistory: Array<{ month: string; averagePrice: number }>;
  };
  similarListings?: CarCardData[];
  confidenceLow?: string | null;
  confidenceHigh?: string | null;
}

function ImageCarousel({
  images, alt, activeIndex, onIndexChange, isGoodDeal,
}: {
  images: string[]; alt: string; activeIndex: number;
  onIndexChange: (i: number) => void; isGoodDeal: boolean;
}) {
  const touchStart = useRef<number | null>(null);
  const touchDelta = useRef(0);

  const goNext = useCallback(() => {
    onIndexChange(Math.min(activeIndex + 1, images.length - 1));
  }, [activeIndex, images.length, onIndexChange]);

  const goPrev = useCallback(() => {
    onIndexChange(Math.max(activeIndex - 1, 0));
  }, [activeIndex, onIndexChange]);

  return (
    <div className="relative md:rounded-xl md:overflow-hidden group">
      <div
        className="overflow-hidden"
        onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; touchDelta.current = 0; }}
        onTouchMove={(e) => { if (touchStart.current !== null) touchDelta.current = e.touches[0].clientX - touchStart.current; }}
        onTouchEnd={() => {
          if (Math.abs(touchDelta.current) > 50) { touchDelta.current < 0 ? goNext() : goPrev(); }
          touchStart.current = null; touchDelta.current = 0;
        }}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`${alt} - Image ${i + 1}`}
              className="w-full h-64 md:h-[420px] object-cover shrink-0"
            />
          ))}
        </div>
      </div>

      {isGoodDeal && (
        <div className="absolute top-4 left-4">
          <Badge className="bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500 shadow-sm">Good Deal</Badge>
        </div>
      )}

      {images.length > 1 && (
        <>
          {activeIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-soft"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {activeIndex < images.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-soft"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {(() => {
              const maxDots = 7;
              let start = 0;
              if (images.length > maxDots) {
                start = Math.min(Math.max(activeIndex - Math.floor(maxDots / 2), 0), images.length - maxDots);
              }
              return images.slice(start, start + maxDots).map((_, j) => {
                const idx = start + j;
                return (
                  <button
                    key={idx}
                    onClick={() => onIndexChange(idx)}
                    className={`h-1.5 rounded-full transition-all shrink-0 ${
                      idx === activeIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"
                    }`}
                  />
                );
              });
            })()}
          </div>

          <div className="absolute top-4 right-4 bg-black/50 text-white text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
            {activeIndex + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

export default function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [car, setCar] = useState<CarListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const fetchCarDetails = async () => {
      try {
        setIsLoading(true);
        const data = await apiRequest<CarListing>(API_ENDPOINTS.cars.detail(parseInt(id)));
        setCar(data);
      } catch {
        setError("Failed to load car details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCarDetails();
  }, [id]);

  useEffect(() => {
    const saved = localStorage.getItem("carFavorites");
    if (saved) setIsFavorite(JSON.parse(saved).includes(parseInt(id)));
  }, [id]);

  const toggleFavorite = () => {
    const saved = localStorage.getItem("carFavorites");
    let favs = saved ? JSON.parse(saved) : [];
    if (isFavorite) favs = favs.filter((f: number) => f !== parseInt(id));
    else favs.push(parseInt(id));
    localStorage.setItem("carFavorites", JSON.stringify(favs));
    setIsFavorite(!isFavorite);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = car ? `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""} - ${car.price}` : "Car Listing";
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareText("Link copied!");
      setTimeout(() => setShareText(null), 2000);
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto md:px-6 md:pt-6">
            <div className="md:grid md:grid-cols-5 md:gap-8">
              <div className="md:col-span-3">
                <div className="aspect-[16/10] skeleton md:rounded-xl" />
              </div>
              <div className="md:col-span-2 p-4 md:p-0 space-y-4">
                <div className="h-7 w-2/3 skeleton" />
                <div className="h-5 w-1/2 skeleton" />
                <div className="h-20 skeleton rounded-xl" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-20 skeleton rounded-xl" />
                  <div className="h-20 skeleton rounded-xl" />
                  <div className="h-20 skeleton rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error || !car) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">{error || "Car not found"}</h3>
            <p className="text-sm text-muted-foreground mb-4">This listing may have been removed.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  const isGoodDeal = car.dealLabel === "Good Deal";
  const allImages = car.images?.length ? car.images : [car.image];
  const priceDiff = car.predictedPrice
    ? Math.abs(parseInt(car.predictedPrice.replace(/[^\d]/g, "")) - parseInt(car.price.replace(/[^\d]/g, "")))
    : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-foreground">Car Details</span>
        <div className="flex items-center gap-1">
          <motion.div whileTap={{ scale: 1.2 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
            <Button variant="ghost" size="icon" onClick={toggleFavorite}>
              <Heart className={`h-5 w-5 transition-colors duration-150 ${isFavorite ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
            </Button>
          </motion.div>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="h-5 w-5 text-muted-foreground" />
            </Button>
            {shareText && (
              <span className="absolute -bottom-8 right-0 text-[11px] bg-foreground text-background px-2 py-0.5 rounded whitespace-nowrap">
                {shareText}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto pb-safe">
          <div className="md:grid md:grid-cols-5 md:gap-8 md:px-6 md:pt-6">
            {/* Left: Images */}
            <motion.div
              className="md:col-span-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <ImageCarousel
                images={allImages}
                alt={`${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`}
                activeIndex={activeImageIndex}
                onIndexChange={setActiveImageIndex}
                isGoodDeal={isGoodDeal}
              />
            </motion.div>

            {/* Right: Details */}
            <motion.div
              className="md:col-span-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="px-4 md:px-0 space-y-5 pt-5 md:pt-0">
                {/* Title */}
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    {car.year} {car.make} {car.model}{car.trim ? ` ${car.trim}` : ""}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {car.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" /> {car.mileage}
                    </span>
                  </div>
                </div>

                {/* Price card */}
                <Card className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-3xl font-bold text-primary tracking-tight">{car.price}</span>
                    <div className="flex items-center gap-1.5">
                      {car.dealLabel && (
                        <Badge
                          className={`text-xs font-medium ${
                            isGoodDeal
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-50"
                              : car.dealLabel === "Overpriced"
                                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 hover:bg-red-50"
                                : "bg-muted text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {car.dealLabel}
                        </Badge>
                      )}
                      {car.confidenceLabel && (
                        <Badge
                          className={`text-xs font-medium ${
                            car.confidenceLabel === "Very Confident"
                              ? "bg-blue-500/90 text-white border-blue-500/90 hover:bg-blue-500/90"
                              : "bg-blue-400/70 text-white border-blue-400/70 hover:bg-blue-400/70"
                          }`}
                        >
                          {car.confidenceLabel}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {car.predictedPrice && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">AI Predicted ({car.modelUsed || "CatBoost"}):</span>
                      <span className="text-muted-foreground line-through">{car.predictedPrice}</span>
                      {priceDiff > 0 && (
                        <span className={`font-medium ${isGoodDeal ? "text-emerald-600" : car.dealLabel === "Overpriced" ? "text-red-600" : "text-muted-foreground"}`}>
                          {isGoodDeal ? `د.إ ${priceDiff.toLocaleString()} below` : car.dealLabel === "Overpriced" ? `د.إ ${priceDiff.toLocaleString()} above` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {car.confidenceLow && car.confidenceHigh && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Estimated range: {car.confidenceLow} – {car.confidenceHigh}
                    </p>
                  )}
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Calendar, value: car.year, label: "Year" },
                    { icon: Gauge, value: car.mileage.split(" ")[0], label: "Miles" },
                    { icon: MapPin, value: car.location.split(",")[0], label: "Location" },
                  ].map((stat) => (
                    <Card key={stat.label} className="p-3 text-center">
                      <stat.icon className="h-4 w-4 mx-auto mb-1.5 text-primary" />
                      <div className="text-sm font-semibold text-foreground">{stat.value}</div>
                      <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                    </Card>
                  ))}
                </div>

                {/* Market Analysis */}
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Market Analysis</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">Depreciation</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "1 Year", value: car.marketAnalysis.depreciation.oneYear },
                          { label: "3 Years", value: car.marketAnalysis.depreciation.threeYear },
                          { label: "5 Years", value: car.marketAnalysis.depreciation.fiveYear },
                        ].map((d) => (
                          <div key={d.label} className="text-center p-2.5 bg-muted/50 rounded-lg">
                            <div className="text-sm font-bold text-red-600 dark:text-red-400">-{d.value}%</div>
                            <div className="text-[11px] text-muted-foreground">{d.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2.5">Price Projections</h4>
                      <div className="space-y-2">
                        {(() => {
                          const maxPrice = Math.max(...car.marketAnalysis.priceHistory.map((d: any) => d.averagePrice));
                          return car.marketAnalysis.priceHistory.map((data) => (
                            <div key={data.month} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground w-12 text-xs">{data.month}</span>
                              <div className="flex-1 mx-3 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary/60 rounded-full transition-all"
                                  style={{ width: `${(data.averagePrice / maxPrice) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-14 text-right">{(data.averagePrice / 1000).toFixed(0)}k</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/60">
                      <Link href={`/listing/${car.id}/analysis`}>
                        <Button variant="outline" className="w-full">
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Detailed Analysis
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>

                {/* Features */}
                <Card className="p-5">
                  <h3 className="font-semibold text-foreground mb-3">Features</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {car.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-foreground truncate">{feature}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Description */}
                <Card className="p-5">
                  <h3 className="font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{car.description}</p>
                </Card>
              </div>
            </motion.div>
          </div>

          {/* Similar listings */}
          {car.similarListings && car.similarListings.length > 0 && (
            <motion.section
              className="px-4 md:px-6 py-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-end justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Compare</p>
                  <h3 className="text-xl font-semibold text-foreground tracking-tight">Similar Listings</h3>
                </div>
                <span className="text-xs text-muted-foreground md:hidden">Swipe to see more</span>
              </div>

              <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:mx-0 md:px-0 md:overflow-visible">
                {car.similarListings.map((similar, i) => (
                  <div key={similar.id} className="snap-start shrink-0 w-[calc(100%-24px)] md:w-auto">
                    <CarCard car={similar} index={i} />
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 p-4 border-t border-border/40 bg-card/80 backdrop-blur-nav">
        <div className="max-w-md mx-auto">
          <a href={car.url} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full h-12" size="lg">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on {car.source === "dubicars" ? "DubiCars" : "Dubizzle"}
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
