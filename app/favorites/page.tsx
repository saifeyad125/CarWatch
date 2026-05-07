"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Heart, Search, Car, Building2, Wrench, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/ui/car-card";
import { DealerCarCard, DealerCarCardSkeleton, type DealerCarCardData } from "@/components/ui/dealer-car-card";
import { PartCard, PartCardSkeleton, type PartCardData } from "@/components/ui/part-card";
import { MotorcycleCard, type MotorcycleCardData } from "@/components/ui/motorcycle-card";
import { DealerMotorcycleCard, type DealerMotorcycleCardData } from "@/components/ui/dealer-motorcycle-card";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { getFavorites, getFavoritesByType, toggleFavorite } from "@/lib/favorites";
import { motion } from "framer-motion";

type TabKey = "all" | "used" | "dealer" | "part" | "motorcycle" | "dealer_motorcycle";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: null },
  { key: "used", label: "Used Cars", icon: <Car className="h-3.5 w-3.5" /> },
  { key: "dealer", label: "Dealer Cars", icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: "part", label: "Parts", icon: <Wrench className="h-3.5 w-3.5" /> },
  { key: "motorcycle", label: "Motorcycles", icon: <Bike className="h-3.5 w-3.5" /> },
  { key: "dealer_motorcycle", label: "Dealer Motorcycles", icon: <Bike className="h-3.5 w-3.5" /> },
];

export default function FavoritesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [isLoading, setIsLoading] = useState(true);

  const [usedListings, setUsedListings] = useState<CarCardData[]>([]);
  const [dealerListings, setDealerListings] = useState<DealerCarCardData[]>([]);
  const [partListings, setPartListings] = useState<PartCardData[]>([]);
  const [motoListings, setMotoListings] = useState<MotorcycleCardData[]>([]);
  const [dealerMotoListings, setDealerMotoListings] = useState<DealerMotorcycleCardData[]>([]);

  const totalCount = usedListings.length + dealerListings.length + partListings.length + motoListings.length + dealerMotoListings.length;

  useEffect(() => {
    const loadFavorites = async () => {
      const favs = getFavorites();
      if (favs.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const usedIds = getFavoritesByType("used");
      const dealerIds = getFavoritesByType("dealer");
      const partIds = getFavoritesByType("part");
      const motoIds = getFavoritesByType("motorcycle");
      const dealerMotoIds = getFavoritesByType("dealer_motorcycle");

      const [used, dealer, parts, motos, dealerMotos] = await Promise.all([
        Promise.all(usedIds.map((id) => apiRequest<CarCardData>(API_ENDPOINTS.cars.detail(id)).catch(() => null))),
        Promise.all(dealerIds.map((id) => apiRequest<DealerCarCardData>(API_ENDPOINTS.dealerCars.detail(id)).catch(() => null))),
        Promise.all(partIds.map((id) => apiRequest<PartCardData>(API_ENDPOINTS.parts.detail(id)).catch(() => null))),
        Promise.all(motoIds.map((id) => apiRequest<MotorcycleCardData>(API_ENDPOINTS.motorcycles.detail(id)).catch(() => null))),
        Promise.all(dealerMotoIds.map((id) => apiRequest<DealerMotorcycleCardData>(API_ENDPOINTS.motorcycleDealerCars.detail(id)).catch(() => null))),
      ]);
      setUsedListings(used.filter((r): r is CarCardData => r !== null));
      setDealerListings(dealer.filter((r): r is DealerCarCardData => r !== null));
      setPartListings(parts.filter((r): r is PartCardData => r !== null));
      setMotoListings(motos.filter((r): r is MotorcycleCardData => r !== null));
      setDealerMotoListings(dealerMotos.filter((r): r is DealerMotorcycleCardData => r !== null));
      setIsLoading(false);
    };
    loadFavorites();
  }, []);

  const removeFavorite = (type: "used" | "dealer" | "part" | "motorcycle" | "dealer_motorcycle", id: number) => {
    toggleFavorite(type, id);
    if (type === "used") setUsedListings((prev) => prev.filter((c) => c.id !== id));
    if (type === "dealer") setDealerListings((prev) => prev.filter((c) => c.id !== id));
    if (type === "part") setPartListings((prev) => prev.filter((p) => p.id !== id));
    if (type === "motorcycle") setMotoListings((prev) => prev.filter((m) => m.id !== id));
    if (type === "dealer_motorcycle") setDealerMotoListings((prev) => prev.filter((m) => m.id !== id));
  };

  const q = searchQuery.toLowerCase();
  const filteredUsed = usedListings.filter(
    (c) => c.make.toLowerCase().includes(q) || c.model.toLowerCase().includes(q) || `${c.year}`.includes(q)
  );
  const filteredDealer = dealerListings.filter(
    (c) => c.make.toLowerCase().includes(q) || c.model.toLowerCase().includes(q) || `${c.year}`.includes(q)
  );
  const filteredParts = partListings.filter(
    (p) => p.name.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q)
  );
  const filteredMotos = motoListings.filter(
    (m) => m.make.toLowerCase().includes(q) || m.model.toLowerCase().includes(q) || `${m.year}`.includes(q)
  );
  const filteredDealerMotos = dealerMotoListings.filter(
    (m) => m.make.toLowerCase().includes(q) || m.model.toLowerCase().includes(q) || `${m.year}`.includes(q)
  );

  const showUsed = (activeTab === "all" || activeTab === "used") && filteredUsed.length > 0;
  const showDealer = (activeTab === "all" || activeTab === "dealer") && filteredDealer.length > 0;
  const showParts = (activeTab === "all" || activeTab === "part") && filteredParts.length > 0;
  const showMotos = (activeTab === "all" || activeTab === "motorcycle") && filteredMotos.length > 0;
  const showDealerMotos = (activeTab === "all" || activeTab === "dealer_motorcycle") && filteredDealerMotos.length > 0;
  const hasResults = showUsed || showDealer || showParts || showMotos || showDealerMotos;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Favorites</h1>
          {!isLoading && totalCount > 0 && (
            <Badge variant="secondary" className="text-xs font-medium">{totalCount}</Badge>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 pb-safe">
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <CarCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isLoading && totalCount === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center py-20"
            >
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Heart className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No favorites yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
                Browse listings and tap the heart icon to save your favorites here.
              </p>
              <Button onClick={() => router.push("/browse")}>Browse Listings</Button>
            </motion.div>
          )}

          {!isLoading && totalCount > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {TABS.map((tab) => {
                    const count =
                      tab.key === "all" ? totalCount
                      : tab.key === "used" ? usedListings.length
                      : tab.key === "dealer" ? dealerListings.length
                      : tab.key === "part" ? partListings.length
                      : tab.key === "motorcycle" ? motoListings.length
                      : dealerMotoListings.length;
                    if (tab.key !== "all" && count === 0) return null;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                          activeTab === tab.key
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                        <span className="text-xs opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative sm:ml-auto max-w-md w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search favorites..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>

              {!hasResults && (
                <div className="text-center py-12">
                  <h3 className="font-semibold text-foreground mb-1">No matches</h3>
                  <p className="text-sm text-muted-foreground mb-4">Try a different search term.</p>
                  <Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>
                </div>
              )}

              {showUsed && (
                <section>
                  {activeTab === "all" && (
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Used Cars</h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredUsed.map((car, i) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        index={i}
                        isFavorite={true}
                        onToggleFavorite={(id) => removeFavorite("used", id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showDealer && (
                <section>
                  {activeTab === "all" && (
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Dealer Cars</h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredDealer.map((car, i) => (
                      <DealerCarCard
                        key={car.id}
                        car={car}
                        index={i}
                        isFavorite={true}
                        onToggleFavorite={(id) => removeFavorite("dealer", id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showParts && (
                <section>
                  {activeTab === "all" && (
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Parts</h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                    {filteredParts.map((part, i) => (
                      <PartCard
                        key={part.id}
                        part={part}
                        index={i}
                        isFavorite={true}
                        onToggleFavorite={(id) => removeFavorite("part", id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showMotos && (
                <section>
                  {activeTab === "all" && (
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Motorcycles</h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredMotos.map((m, i) => (
                      <MotorcycleCard
                        key={m.id}
                        motorcycle={m}
                        index={i}
                        isFavorite={true}
                        onToggleFavorite={(id) => removeFavorite("motorcycle", id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showDealerMotos && (
                <section>
                  {activeTab === "all" && (
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Dealer Motorcycles</h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredDealerMotos.map((m, i) => (
                      <DealerMotorcycleCard
                        key={m.id}
                        motorcycle={m}
                        index={i}
                        isFavorite={true}
                        onToggleFavorite={(id) => removeFavorite("dealer_motorcycle", id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
