"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Car, MapPin, DollarSign, Bell, Trash2, Play, Pause, X, Check, AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { motion, AnimatePresence } from "framer-motion";

function LimitModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm overflow-hidden shadow-elevated border border-border/60 bg-card rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 w-full bg-primary" />
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Limit Reached</h3>
              <p className="text-xs text-muted-foreground">Free plan: 2 active watchlists</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pause one of your active watchlists first, or upgrade for unlimited monitoring.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={onClose}>Upgrade</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface WatchlistItem {
  id: number;
  title: string;
  subtitle: string;
  locationLabel: string;
  updatedLabel: string;
  tags: string[];
  isActive: boolean;
  alertsEnabled: boolean;
  newCount: number;
  totalMatches: number;
}

interface WatchlistsResponse {
  summary: { active: number; matches: number; withAlerts: number };
  watchlists: WatchlistItem[];
}

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [summary, setSummary] = useState({ active: 0, matches: 0, withAlerts: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const [formMake, setFormMake] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formYearFrom, setFormYearFrom] = useState("");
  const [formYearTo, setFormYearTo] = useState("");
  const [formPriceMin, setFormPriceMin] = useState("");
  const [formPriceMax, setFormPriceMax] = useState("");
  const [formLocations, setFormLocations] = useState<string[]>([]);
  const [formTitle, setFormTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [allModels, setAllModels] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const brandRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const UAE_LOCATIONS = [
    "Dubai, UAE", "Abu Dhabi, UAE", "Sharjah, UAE", "Ajman, UAE",
    "Ras Al Khaimah, UAE", "Fujairah, UAE", "Al Ain, UAE",
  ];

  useEffect(() => {
    apiRequest<{ brands: string[] }>(API_ENDPOINTS.cars.brands)
      .then((d) => setAllBrands(d.brands))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!formMake.trim()) { setAllModels([]); return; }
    const match = allBrands.find((b) => b.toLowerCase() === formMake.trim().toLowerCase());
    if (match) {
      apiRequest<{ models: string[] }>(API_ENDPOINTS.cars.models(match))
        .then((d) => setAllModels(d.models))
        .catch(() => setAllModels([]));
    }
  }, [formMake, allBrands]);

  useEffect(() => {
    if (!formMake.trim()) setBrandSuggestions(allBrands.slice(0, 8));
    else {
      const q = formMake.trim().toLowerCase();
      setBrandSuggestions(allBrands.filter((b) => b.toLowerCase().includes(q)).slice(0, 8));
    }
  }, [formMake, allBrands]);

  useEffect(() => {
    if (!formModel.trim()) setModelSuggestions(allModels.filter((m) => !selectedModels.includes(m)).slice(0, 8));
    else {
      const q = formModel.trim().toLowerCase();
      setModelSuggestions(allModels.filter((m) => m.toLowerCase().includes(q) && !selectedModels.includes(m)).slice(0, 8));
    }
  }, [formModel, allModels, selectedModels]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setShowBrandDropdown(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModelDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleLocation = (loc: string) => {
    setFormLocations((prev) => prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]);
  };

  const resetForm = () => {
    setFormMake(""); setFormModel(""); setFormYearFrom(""); setFormYearTo("");
    setFormPriceMin(""); setFormPriceMax(""); setFormLocations([]); setFormTitle("");
    setSelectedModels([]); setShowAddForm(false);
  };

  const handleSubmitWatchlist = async () => {
    if (!formMake.trim()) { alert("Please select a make."); return; }
    setIsSubmitting(true);
    try {
      const body = {
        title: formTitle.trim() || `${formMake}${selectedModels.length ? " " + selectedModels.join(", ") : ""}`,
        searchCriteria: {
          make: formMake.trim(),
          ...(selectedModels.length > 0 && { models: selectedModels }),
          ...(formYearFrom && { year_min: parseInt(formYearFrom, 10) }),
          ...(formYearTo && { year_max: parseInt(formYearTo, 10) }),
          ...(formPriceMin && { price_min: parseInt(formPriceMin.replace(/,/g, ""), 10) }),
          ...(formPriceMax && { price_max: parseInt(formPriceMax.replace(/,/g, ""), 10) }),
          ...(formLocations.length > 0 && { locations: formLocations }),
        },
        isActive: false,
        alertsEnabled: false,
      };
      await apiRequest(API_ENDPOINTS.watchlists.create, { method: "POST", body: JSON.stringify(body) });
      const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
      setWatchlistItems(data.watchlists);
      setSummary(data.summary);
      resetForm();
    } catch {
      alert("Failed to create watchlist. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchWatchlists = async () => {
      try {
        setIsLoading(true);
        const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
        setWatchlistItems(data.watchlists);
        setSummary(data.summary);
      } catch {
        setError("Failed to load watchlists.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchWatchlists();
  }, []);

  const toggleWatchlistStatus = async (id: number, currentlyActive: boolean) => {
    const newStatus = !currentlyActive;
    setWatchlistItems((prev) => prev.map((item) => (item.id === id ? { ...item, isActive: newStatus } : item)));
    try {
      await apiRequest(API_ENDPOINTS.watchlists.setStatus(id), { method: "PATCH", body: JSON.stringify({ isActive: newStatus }) });
      const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
      setWatchlistItems(data.watchlists);
      setSummary(data.summary);
    } catch (err: any) {
      setWatchlistItems((prev) => prev.map((item) => (item.id === id ? { ...item, isActive: currentlyActive } : item)));
      if (err?.message?.includes("409")) setShowLimitModal(true);
      else alert("Failed to update watchlist status.");
    }
  };

  const deleteWatchlist = async (id: number) => {
    if (!window.confirm("Delete this watchlist? This cannot be undone.")) return;
    const prev = watchlistItems;
    setWatchlistItems((items) => items.filter((item) => item.id !== id));
    try {
      await apiRequest(API_ENDPOINTS.watchlists.delete(id), { method: "DELETE" });
      const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
      setWatchlistItems(data.watchlists);
      setSummary(data.summary);
    } catch {
      setWatchlistItems(prev);
      alert("Failed to delete watchlist.");
    }
  };

  const filteredItems = watchlistItems
    .filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationLabel.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => (a.isActive !== b.isActive ? (a.isActive ? -1 : 1) : 0));

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Add form view
  if (showAddForm) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={resetForm}>
            <X className="h-4 w-4 mr-1.5" /> Cancel
          </Button>
          <span className="text-sm font-medium">New Watchlist</span>
          <div className="w-16" />
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 md:p-6 space-y-5 pb-32">
            <Card>
              <CardHeader><CardTitle className="text-sm">Name (optional)</CardTitle></CardHeader>
              <CardContent>
                <Input placeholder="e.g., Family SUV Hunt" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Car className="h-4 w-4 text-primary" /> Vehicle Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div ref={brandRef} className="relative">
                  <label className="text-xs font-medium text-muted-foreground">Make *</label>
                  <div className="relative mt-1">
                    <Input
                      placeholder="Search brand..."
                      value={formMake}
                      onChange={(e) => { setFormMake(e.target.value); setShowBrandDropdown(true); setSelectedModels([]); setFormModel(""); }}
                      onFocus={() => setShowBrandDropdown(true)}
                    />
                    {formMake && (
                      <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setFormMake(""); setSelectedModels([]); setFormModel(""); }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {showBrandDropdown && brandSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-elevated max-h-48 overflow-y-auto">
                      {brandSuggestions.map((brand) => (
                        <button
                          key={brand}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${brand.toLowerCase() === formMake.trim().toLowerCase() ? "bg-accent font-medium text-primary" : ""}`}
                          onClick={() => { setFormMake(brand); setShowBrandDropdown(false); setSelectedModels([]); setFormModel(""); }}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={modelRef} className="relative">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  {selectedModels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                      {selectedModels.map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs gap-1 pr-1">
                          {m}
                          <button onClick={() => setSelectedModels((p) => p.filter((x) => x !== m))}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="relative mt-1">
                    <Input
                      placeholder={allModels.length ? "Search model..." : "Select a make first"}
                      value={formModel}
                      onChange={(e) => { setFormModel(e.target.value); setShowModelDropdown(true); }}
                      onFocus={() => setShowModelDropdown(true)}
                      disabled={allModels.length === 0}
                    />
                  </div>
                  {showModelDropdown && modelSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-elevated max-h-48 overflow-y-auto">
                      {modelSuggestions.map((model) => (
                        <button
                          key={model}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => { setSelectedModels((p) => [...p, model]); setFormModel(""); setShowModelDropdown(false); }}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Year From</label>
                    <Input placeholder="2020" type="number" className="mt-1" value={formYearFrom} onChange={(e) => setFormYearFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Year To</label>
                    <Input placeholder="2025" type="number" className="mt-1" value={formYearTo} onChange={(e) => setFormYearTo(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-primary" /> Price Range (AED)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Min</label>
                    <Input placeholder="50,000" type="number" className="mt-1" value={formPriceMin} onChange={(e) => setFormPriceMin(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Max</label>
                    <Input placeholder="200,000" type="number" className="mt-1" value={formPriceMax} onChange={(e) => setFormPriceMax(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary" /> Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Select one or more emirates</p>
                <div className="flex flex-wrap gap-2">
                  {UAE_LOCATIONS.map((loc) => {
                    const label = loc.replace(", UAE", "");
                    const isSelected = formLocations.includes(loc);
                    return (
                      <Button
                        key={loc}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className="text-xs rounded-full"
                        onClick={() => toggleLocation(loc)}
                      >
                        {isSelected && <Check className="h-3 w-3 mr-1" />}
                        {label}
                      </Button>
                    );
                  })}
                </div>
                {formLocations.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">No selection = all emirates</p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSubmitWatchlist} disabled={isSubmitting || !formMake.trim()}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <><Plus className="h-4 w-4 mr-1.5" /> Create Watchlist</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center">
          <h1 className="text-lg font-semibold tracking-tight">Watchlist</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center">
          <h1 className="text-lg font-semibold tracking-tight">Watchlist</h1>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40">
            <p className="text-red-700 dark:text-red-300 text-center text-sm">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <AnimatePresence>{showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}</AnimatePresence>

      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-semibold tracking-tight">Watchlist</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New
          </Button>
          <Link href="/profile">
            <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-border hover:ring-primary/30 transition-all duration-150">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName || "User"}`} />
              <AvatarFallback className="text-xs font-medium">{(userName || "U")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-safe">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search watchlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Active", value: summary.active },
              { label: "Matches", value: summary.matches },
              { label: "With Alerts", value: summary.withAlerts },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </Card>
            ))}
          </div>

          {/* Usage limit */}
          {(() => {
            const activeCount = watchlistItems.filter((i) => i.isActive).length;
            const color = activeCount === 0 ? "amber" : activeCount <= 2 ? "emerald" : "red";
            return (
              <Card className={`p-4 border-${color}-200 dark:border-${color}-900/40 bg-${color}-50/50 dark:bg-${color}-950/20`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg bg-${color}-100 dark:bg-${color}-950/30 flex items-center justify-center`}>
                      <Bell className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{activeCount}/2 Active</p>
                      <p className="text-xs text-muted-foreground">Free plan limit</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Upgrade</Button>
                </div>
              </Card>
            );
          })()}

          {/* Watchlist items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link href={`/watchlist/${item.id}`}>
                  <Card className="group overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                            <Car className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.newCount > 0 && (
                            <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              {item.newCount}
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlistStatus(item.id, item.isActive); }}
                            title={item.isActive ? "Pause" : "Resume"}
                          >
                            {item.isActive ? <Pause className="h-3.5 w-3.5 text-amber-600" /> : <Play className="h-3.5 w-3.5 text-emerald-600" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteWatchlist(item.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {item.locationLabel}
                        </span>
                        <span>{item.updatedLabel}</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="text-xs text-muted-foreground">
                          {item.totalMatches} {item.totalMatches === 1 ? "match" : "matches"}
                        </span>
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
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Car className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">
                {searchQuery ? "No matches" : "No watchlists yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? "Try a different search." : "Create your first watchlist to start monitoring prices."}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Create Watchlist
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
