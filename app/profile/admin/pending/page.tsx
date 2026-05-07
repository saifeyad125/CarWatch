"use client";

import React, { useState, useEffect } from "react";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, Car, Bike } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ListingItem {
  id: number;
  type: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: string;
  mileage: string;
  location: string;
  image: string;
  status: string;
  createdAt: string;
}

interface PendingResponse {
  cars: ListingItem[];
  motorcycles: ListingItem[];
}

interface ProfileData {
  status: string;
}

export default function AdminPendingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const checkAdmin = async () => {
      try {
        const profile = await apiRequest<ProfileData>(API_ENDPOINTS.profile);
        setIsAdmin(profile.status === "admin");
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (isAdmin !== true) return;

    const fetchPending = async () => {
      try {
        const data = await apiRequest<PendingResponse>(API_ENDPOINTS.sell.pending);
        const combined = [...data.cars, ...data.motorcycles].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setListings(combined);
      } catch (err) {
        console.error("Failed to fetch pending listings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPending();
  }, [isAdmin]);

  const handleAction = async (item: ListingItem, newStatus: "approved" | "rejected") => {
    const key = `${item.type}-${item.id}`;
    setActioningId(key);
    try {
      await apiRequest(API_ENDPOINTS.sell.updateStatus(item.type, item.id), {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setListings((prev) => prev.filter((l) => !(l.type === item.type && l.id === item.id)));
    } catch (err) {
      console.error(`Failed to ${newStatus} listing:`, err);
    } finally {
      setActioningId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center gap-3">
          <Link href="/profile">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Pending Reviews</h1>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
              <Link href="/profile">
                <Button variant="outline" className="mt-4">Back to Profile</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
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
        <h1 className="text-lg font-semibold tracking-tight">Pending Reviews</h1>
        {!loading && (
          <Badge variant="secondary" className="ml-auto">{listings.length} pending</Badge>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-4 pb-safe">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="flex gap-4 p-4">
                  <div className="w-24 h-24 rounded-lg bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              </Card>
            ))
          ) : listings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <Check className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No pending listings to review</p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {listings.map((item) => {
                const key = `${item.type}-${item.id}`;
                const isActioning = actioningId === key;
                return (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                  >
                    <Card className="overflow-hidden">
                      <div className="flex gap-4 p-4">
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={`${item.year} ${item.make} ${item.model}`}
                              fill
                              className="object-cover"
                              sizes="96px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {item.type === "car" ? (
                                <Car className="h-8 w-8 text-muted-foreground/40" />
                              ) : (
                                <Bike className="h-8 w-8 text-muted-foreground/40" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm truncate">
                              {item.year} {item.make} {item.model}
                            </h3>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {item.type === "car" ? "Car" : "Motorcycle"}
                            </Badge>
                          </div>
                          <p className="text-primary font-semibold text-sm mt-0.5">{item.price}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">{item.location}</p>
                          <p className="text-muted-foreground text-xs">{item.mileage}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 px-4 pb-4">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={isActioning}
                          onClick={() => handleAction(item, "approved")}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                          disabled={isActioning}
                          onClick={() => handleAction(item, "rejected")}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </Card>
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
