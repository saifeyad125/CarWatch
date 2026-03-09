"use client";

import { TrendingUp, Bell, Heart, Car, LogIn, ArrowRight, Sparkles, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CarCard, CarCardSkeleton, type CarCardData } from "@/components/ui/car-card";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { motion } from "framer-motion";

interface WatchlistItem {
  id: number;
  title: string;
  subtitle: string;
  tags: string[];
  isActive: boolean;
  newCount: number;
  totalMatches: number;
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, avatarSeed } = useAuth();
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showAllListings, setShowAllListings] = useState(false);
  const [popularListings, setPopularListings] = useState<CarCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const savedFavorites = localStorage.getItem("carFavorites");
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
  }, []);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiRequest<CarCardData[]>(`${API_ENDPOINTS.cars.list}?limit=8`);
        setPopularListings(data);
      } catch {
        setError("Failed to load listings. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchListings();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      try {
        const data = await apiRequest<{ watchlists: WatchlistItem[] }>(API_ENDPOINTS.watchlists.list);
        setWatchlists(data.watchlists || []);
      } catch {}
      try {
        const data = await apiRequest<{ unreadCount: number }>(API_ENDPOINTS.notifications.unreadCount);
        setUnreadCount(data.unreadCount || 0);
      } catch {}
    };
    fetchUserData();
  }, [user]);

  const toggleFavorite = (carId: number) => {
    const newFavorites = favorites.includes(carId)
      ? favorites.filter((id) => id !== carId)
      : [...favorites, carId];
    setFavorites(newFavorites);
    localStorage.setItem("carFavorites", JSON.stringify(newFavorites));
  };

  const activeWatchlists = watchlists.filter((w) => w.isActive).length;
  const totalNewMatches = watchlists.reduce((sum, w) => sum + (w.newCount || 0), 0);
  const displayedListings = showAllListings ? popularListings : popularListings.slice(0, 6);
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;

  const stats = [
    { label: "Active Alerts", value: user ? activeWatchlists.toString() : "0", icon: Bell, href: "/watchlist" },
    { label: "New Matches", value: user ? totalNewMatches.toString() : "0", icon: TrendingUp, href: "/watchlist" },
    { label: "Favorites", value: favorites.length.toString(), icon: Heart, href: "/favorites" },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-foreground md:hidden tracking-tight">CarWatch</h1>
          <h1 className="hidden md:block text-lg font-semibold text-foreground tracking-tight">Dashboard</h1>
        </div>
        {user ? (
          <Link href="/profile">
            <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-border hover:ring-primary/30 transition-all duration-150">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
              <AvatarFallback className="text-xs font-medium">{(userName || "U")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Link href="/login">
            <Button variant="outline" size="sm">
              <LogIn className="h-3.5 w-3.5 mr-1.5" />
              Sign In
            </Button>
          </Link>
        )}
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pb-safe">

          {/* Hero Section */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="pt-6 md:pt-10 pb-2"
          >
            <div className="relative rounded-2xl overflow-hidden bg-gradient-subtle bg-card border border-border/40">
              {/* Glow orb */}
              <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/[0.06] blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />

              <div className="relative px-6 py-10 md:px-10 md:py-14">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
                  AI-Powered Price Intelligence
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-2">
                  {userName ? `Welcome back, ${userName}` : "Find your best deal"}
                </h2>
                <p className="text-base text-muted-foreground max-w-lg mb-6 leading-relaxed">
                  {userName
                    ? "Track your dream cars and get notified when prices drop below market value."
                    : "AI-powered UAE used car price predictions. Know instantly if a deal is worth it."}
                </p>

                <div className="flex flex-wrap gap-3 mb-8">
                  <Link href="/browse">
                    <Button size="lg">
                      Browse Cars
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                  {!user && (
                    <Link href="/signup">
                      <Button variant="outline" size="lg">
                        Create Free Account
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Trust row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI-Powered Predictions
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Updated Hourly
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    {popularListings.length > 0 ? `${popularListings.length}+ Listings` : "Live Listings"}
                  </span>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Stats */}
          <section className="py-6">
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Card
                      className="p-4 md:p-5 border-border/50 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
                      onClick={() => router.push(stat.href)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                          <Icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground font-medium truncate">{stat.label}</p>
                          <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Popular Listings */}
          <section className="py-6">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Featured</p>
                <h3 className="text-2xl font-semibold text-foreground tracking-tight">Popular Listings</h3>
              </div>
              <Link href="/browse">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  View all
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {/* Loading skeletons */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CarCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40">
                <p className="text-red-700 dark:text-red-300 text-center text-sm">{error}</p>
              </Card>
            )}

            {/* Listings grid */}
            {!isLoading && !error && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {displayedListings.map((car, i) => (
                    <CarCard
                      key={car.id}
                      car={car}
                      index={i}
                      isFavorite={favorites.includes(car.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>

                {!showAllListings && popularListings.length > 6 && (
                  <div className="mt-8 text-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllListings(true)}
                    >
                      Show More ({popularListings.length - 6} more)
                    </Button>
                  </div>
                )}

                {showAllListings && (
                  <div className="mt-8 text-center">
                    <Button variant="outline" onClick={() => setShowAllListings(false)}>
                      Show Less
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Active Monitors */}
          {user && watchlists.length > 0 && (
            <section className="py-6">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Monitoring</p>
                  <h3 className="text-2xl font-semibold text-foreground tracking-tight">Active Watchlists</h3>
                </div>
                <Link href="/watchlist">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    View all
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {watchlists.slice(0, 2).map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link href={`/watchlist/${item.id}`}>
                      <Card className="group overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                        <div className="p-5 flex items-start gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                            <Car className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-foreground truncate">{item.title}</h4>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.newCount > 0 && (
                                  <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                    {item.newCount} new
                                  </span>
                                )}
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                  item.isActive
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                                  {item.isActive ? "Active" : "Paused"}
                                </span>
                              </div>
                            </div>
                            {item.subtitle && (
                              <p className="text-sm text-muted-foreground mb-2 truncate">{item.subtitle}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {item.totalMatches} {item.totalMatches === 1 ? "match" : "matches"}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Sign-in prompt */}
          {!user && !authLoading && (
            <section className="py-6 pb-12">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/[0.05] blur-2xl pointer-events-none" />
                  <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Bell className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground mb-1">Never miss a deal</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Create watchlists to get notified when your dream car drops below market value.
                      </p>
                    </div>
                    <Link href="/login">
                      <Button>
                        <LogIn className="h-4 w-4 mr-2" />
                        Get Started
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
