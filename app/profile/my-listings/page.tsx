"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ListingItem {
  id: number;
  type: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  price: string;
  mileage: string;
  location: string;
  image: string;
  status: string;
  createdAt: string;
}

interface MyListingsData {
  cars: ListingItem[];
  motorcycles: ListingItem[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending Review", className: "bg-amber-500/90 text-white" },
  approved: { label: "Live", className: "bg-green-500/90 text-white" },
  rejected: { label: "Rejected", className: "bg-red-500/90 text-white" },
};

export default function MyListingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MyListingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"cars" | "motorcycles">("cars");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const fetchListings = useCallback(async () => {
    try {
      const result = await apiRequest<MyListingsData>(API_ENDPOINTS.sell.myListings);
      setData(result);
    } catch {
      setData({ cars: [], motorcycles: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchListings();
  }, [user, fetchListings]);

  const handleDelete = async (type: string, id: number) => {
    setDeletingId(id);
    try {
      await apiRequest(API_ENDPOINTS.sell.delete(type, id), { method: "DELETE" });
      setData((prev) => {
        if (!prev) return prev;
        return {
          cars: type === "car" ? prev.cars.filter((l) => l.id !== id) : prev.cars,
          motorcycles: type === "motorcycle" ? prev.motorcycles.filter((l) => l.id !== id) : prev.motorcycles,
        };
      });
    } catch {
      // silent fail
    } finally {
      setDeletingId(null);
    }
  };

  const listings = data ? data[activeTab] : [];
  const carCount = data?.cars.length ?? 0;
  const motoCount = data?.motorcycles.length ?? 0;

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center gap-3">
        <Link href="/profile">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">My Listings</h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-safe">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border/40">
            {([
              { key: "cars" as const, label: "Cars", count: carCount },
              { key: "motorcycles" as const, label: "Motorcycles", count: motoCount },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label} ({tab.count})
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="flex gap-4 p-4">
                    <div className="w-28 h-20 rounded-lg bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && listings.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Plus className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                You haven&apos;t listed any vehicles yet
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                List your car or motorcycle for sale on CarWatch
              </p>
              <Button asChild>
                <Link href="/sell">
                  <Plus className="h-4 w-4 mr-2" />
                  Sell Your Vehicle
                </Link>
              </Button>
            </motion.div>
          )}

          {/* Listing cards */}
          {!loading && listings.length > 0 && (
            <AnimatePresence mode="popLayout">
              {listings.map((item) => {
                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const canDelete = item.status !== "approved";
                return (
                  <motion.div
                    key={`${item.type}-${item.id}`}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Link href={item.type === "car" ? `/listing/${item.id}` : `/listing/motorcycle/${item.id}`} className="block group">
                      <Card className="overflow-hidden transition-all group-hover:shadow-card-hover group-hover:-translate-y-0.5">
                        <CardContent className="p-0">
                          <div className="flex gap-4 p-4">
                            <div className="relative w-28 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                              {item.image ? (
                                <Image
                                  src={item.image}
                                  alt={`${item.year} ${item.make} ${item.model}`}
                                  fill
                                  className="object-cover"
                                  sizes="112px"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                  No Image
                                </div>
                              )}
                              <Badge className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 ${statusCfg.className}`}>
                                {statusCfg.label}
                              </Badge>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground truncate">
                                {item.year} {item.make} {item.model}
                                {item.trim ? ` ${item.trim}` : ""}
                              </h3>
                              <p className="text-sm font-bold text-primary mt-0.5">{item.price}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{item.location}</span>
                                <span>{item.mileage}</span>
                              </div>
                            </div>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:text-red-500 self-center"
                                disabled={deletingId === item.id}
                                onClick={(e) => { e.preventDefault(); handleDelete(item.type, item.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
