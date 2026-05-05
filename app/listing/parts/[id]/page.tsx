"use client";

import {
  ArrowLeft, Heart, Share2, MapPin, Phone, ChevronLeft, ChevronRight, Tag, Wrench, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { isFavorite as isFav, toggleFavorite as toggleFav } from "@/lib/favorites";
import { motion } from "framer-motion";

interface PartDetail {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  priceRaw: number;
  partNumber?: string | null;
  image?: string | null;
  images: string[];
  categoryBreadcrumb: Array<{ id: number; name: string; slug: string; icon?: string | null }>;
  compatibilities: Array<{ brand: string; model: string; yearFrom?: number | null; yearTo?: number | null }>;
  sellerName: string;
  sellerPhone?: string | null;
  sellerLocation?: string | null;
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

export default function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [part, setPart] = useState<PartDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const fetchPart = async () => {
      try {
        setIsLoading(true);
        const data = await apiRequest<PartDetail>(API_ENDPOINTS.parts.detail(parseInt(id)));
        setPart(data);
      } catch {
        setError("Failed to load part details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPart();
  }, [id]);

  useEffect(() => {
    setIsFavorite(isFav("part", parseInt(id)));
  }, [id]);

  const toggleFavorite = () => {
    toggleFav("part", parseInt(id));
    setIsFavorite(!isFavorite);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = part ? `${part.name} - ${part.price}` : "Part Listing";
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
              <div className="md:col-span-3">
                <div className="aspect-square skeleton md:rounded-xl" />
              </div>
              <div className="md:col-span-2 p-4 md:p-0 space-y-4">
                <div className="h-4 w-40 skeleton" />
                <div className="h-7 w-2/3 skeleton" />
                <div className="h-10 w-1/3 skeleton" />
                <div className="h-24 skeleton rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !part) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">{error || "Part not found"}</h3>
            <p className="text-sm text-muted-foreground mb-4">This part may have been removed.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  const allImages = part.images?.length ? part.images : part.image ? [part.image] : [];

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-foreground">Part Details</span>
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
              {allImages.length > 0 ? (
                <ImageCarousel
                  images={allImages}
                  alt={part.name}
                  activeIndex={activeImageIndex}
                  onIndexChange={setActiveImageIndex}
                />
              ) : (
                <div className="aspect-square bg-muted flex items-center justify-center md:rounded-xl">
                  <span className="text-muted-foreground">No Image</span>
                </div>
              )}
            </motion.div>

            <motion.div
              className="md:col-span-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="px-4 md:px-0 space-y-5 pt-5 md:pt-0">
                {part.categoryBreadcrumb.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                    <Link href="/browse/parts" className="hover:text-foreground transition-colors">Parts</Link>
                    {part.categoryBreadcrumb.map((crumb, i) => (
                      <span key={crumb.id} className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        {i === part.categoryBreadcrumb.length - 1 ? (
                          <span className="text-foreground">{crumb.name}</span>
                        ) : (
                          <Link href={`/browse/parts/category/${crumb.id}`} className="hover:text-foreground transition-colors">
                            {crumb.name}
                          </Link>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">{part.name}</h2>
                  {part.partNumber && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Part #: {part.partNumber}
                    </p>
                  )}
                </div>

                <Card className="p-5">
                  <span className="text-3xl font-bold text-primary tracking-tight">{part.price}</span>
                </Card>

                {part.compatibilities.length > 0 && (
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-foreground">Compatible Vehicles</h3>
                    </div>
                    <div className="space-y-2">
                      {part.compatibilities.map((compat, i) => {
                        const yearRange = compat.yearFrom && compat.yearTo
                          ? ` (${compat.yearFrom}–${compat.yearTo})`
                          : compat.yearFrom
                            ? ` (${compat.yearFrom}+)`
                            : "";
                        return (
                          <Link
                            key={i}
                            href={`/browse/used?search=${encodeURIComponent(`${compat.brand} ${compat.model}`)}`}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                          >
                            <span className="text-sm text-foreground">
                              {compat.brand} {compat.model}{yearRange}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </Link>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {part.description && (
                  <Card className="p-5">
                    <h3 className="font-semibold text-foreground mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{part.description}</p>
                  </Card>
                )}

                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Seller Information</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-foreground">{part.sellerName}</p>
                    {part.sellerLocation && (
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> {part.sellerLocation}
                      </p>
                    )}
                    {part.sellerPhone && (
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {part.sellerPhone}
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-border/40 bg-card/80 backdrop-blur-nav">
        <div className="max-w-md mx-auto">
          {part.sellerPhone ? (
            <a href={`tel:${part.sellerPhone}`} className="block">
              <Button className="w-full h-12" size="lg">
                <Phone className="mr-2 h-4 w-4" />
                Contact Seller
              </Button>
            </a>
          ) : (
            <Button className="w-full h-12" size="lg" disabled>
              <Phone className="mr-2 h-4 w-4" />
              Contact Seller
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
