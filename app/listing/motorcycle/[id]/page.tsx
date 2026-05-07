"use client";

import {
  ArrowLeft, Heart, Share2, MapPin, Gauge, Calendar,
  ChevronLeft, ChevronRight, CheckCircle, Bike,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { isFavorite as checkFav, toggleFavorite as toggleFav } from "@/lib/favorites";
import { motion } from "framer-motion";

interface MotorcycleDetail {
  id: number;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: string;
  mileage: string;
  location: string;
  image: string;
  source: string;
  engineCc?: number | null;
  motorcycleType?: string | null;
  description: string;
  features: string[];
  images: string[];
  seller: { name: string; avatar: string; phone: string; type: string };
}

function ImageCarousel({
  images, alt, activeIndex, onIndexChange,
}: {
  images: string[]; alt: string; activeIndex: number;
  onIndexChange: (i: number) => void;
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
            <img key={i} src={img} alt={`${alt} - Image ${i + 1}`} className="w-full h-64 md:h-[420px] object-cover shrink-0" />
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <>
          {activeIndex > 0 && (
            <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-soft">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {activeIndex < images.length - 1 && (
            <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-soft">
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
                  <button key={idx} onClick={() => onIndexChange(idx)} className={`h-1.5 rounded-full transition-all shrink-0 ${idx === activeIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
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

export default function MotorcycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [motorcycle, setMotorcycle] = useState<MotorcycleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        const data = await apiRequest<MotorcycleDetail>(API_ENDPOINTS.motorcycles.detail(parseInt(id)));
        setMotorcycle(data);
      } catch {
        setError("Failed to load motorcycle details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  useEffect(() => {
    setIsFavorite(checkFav("motorcycle", parseInt(id)));
  }, [id]);

  const toggleFavorite = () => {
    toggleFav("motorcycle", parseInt(id));
    setIsFavorite(!isFavorite);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = motorcycle ? `${motorcycle.year} ${motorcycle.make} ${motorcycle.model} - ${motorcycle.price}` : "Motorcycle Listing";
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareText("Link copied!");
      setTimeout(() => setShareText(null), 2000);
    }
  };

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
              <div className="md:col-span-3"><div className="aspect-[16/10] skeleton md:rounded-xl" /></div>
              <div className="md:col-span-2 p-4 md:p-0 space-y-4">
                <div className="h-7 w-2/3 skeleton" />
                <div className="h-5 w-1/2 skeleton" />
                <div className="h-20 skeleton rounded-xl" />
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !motorcycle) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">{error || "Motorcycle not found"}</h3>
            <p className="text-sm text-muted-foreground mb-4">This listing may have been removed.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  const allImages = motorcycle.images?.length ? motorcycle.images : [motorcycle.image];

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-foreground">Motorcycle Details</span>
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

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto pb-safe">
          <div className="md:grid md:grid-cols-5 md:gap-8 md:px-6 md:pt-6">
            <motion.div className="md:col-span-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <ImageCarousel
                images={allImages}
                alt={`${motorcycle.year} ${motorcycle.make} ${motorcycle.model}`}
                activeIndex={activeImageIndex}
                onIndexChange={setActiveImageIndex}
              />
            </motion.div>

            <motion.div
              className="md:col-span-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="px-4 md:px-0 space-y-5 pt-5 md:pt-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {motorcycle.motorcycleType && (
                      <Badge className="text-xs bg-violet-500 text-white border-violet-500 hover:bg-violet-500">
                        {motorcycle.motorcycleType}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    {motorcycle.year} {motorcycle.make} {motorcycle.model}{motorcycle.trim ? ` ${motorcycle.trim}` : ""}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {motorcycle.location}</span>
                    <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> {motorcycle.mileage}</span>
                  </div>
                </div>

                <Card className="p-5">
                  <span className="text-3xl font-bold text-primary tracking-tight">{motorcycle.price}</span>
                </Card>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Calendar, value: motorcycle.year, label: "Year" },
                    { icon: Gauge, value: motorcycle.mileage.split(" ")[0], label: "Mileage" },
                    { icon: Bike, value: motorcycle.engineCc ? `${motorcycle.engineCc}cc` : "N/A", label: "Engine" },
                  ].map((stat) => (
                    <Card key={stat.label} className="p-3 text-center">
                      <stat.icon className="h-4 w-4 mx-auto mb-1.5 text-violet-600 dark:text-violet-400" />
                      <div className="text-sm font-semibold text-foreground">{stat.value}</div>
                      <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                    </Card>
                  ))}
                </div>

                <Card className="p-5">
                  <h3 className="font-semibold text-foreground mb-3">Features</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {motorcycle.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-foreground truncate">{feature}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{motorcycle.description}</p>
                </Card>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
