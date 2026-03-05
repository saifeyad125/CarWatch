"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Filter, Car, MapPin, DollarSign, Bell, Settings, Trash2, Play, Pause, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

// ── Limit-reached modal ──────────────────────────────────────────────────────
function LimitModal({ onClose }: { onClose: () => void }) {
  // Close on backdrop click
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Card — same style as the popular-listing cards */}
      <div
        className="relative w-full max-w-sm overflow-hidden shadow-2xl border border-border/50 bg-card/95 backdrop-blur-sm rounded-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-red-500 to-red-600" />

        <div className="p-6 space-y-5">
          {/* Icon + heading */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Watchlist Limit Reached</h3>
              <p className="text-sm text-muted-foreground">Free trial</p>
            </div>
          </div>

          {/* Body */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can have up to <span className="font-semibold text-foreground">2 active watchlists</span> on
            the free plan. Pause one of your active watchlists first, or upgrade for unlimited monitoring.
          </p>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-border/60 text-muted-foreground hover:bg-muted/50"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              onClick={onClose}
            >
              Upgrade
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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
  summary: {
    active: number;
    matches: number;
    withAlerts: number;
  };
  watchlists: WatchlistItem[];
}

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [summary, setSummary] = useState({ active: 0, matches: 0, withAlerts: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // ── Add-form state ──
  const [formMake, setFormMake] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formYearFrom, setFormYearFrom] = useState("");
  const [formYearTo, setFormYearTo] = useState("");
  const [formPriceMin, setFormPriceMin] = useState("");
  const [formPriceMax, setFormPriceMax] = useState("");
  const [formLocations, setFormLocations] = useState<string[]>([]);
  const [formTitle, setFormTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Brand / model autocomplete
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
    "Dubai, UAE",
    "Abu Dhabi, UAE",
    "Sharjah, UAE",
    "Ajman, UAE",
    "Ras Al Khaimah, UAE",
    "Fujairah, UAE",
    "Al Ain, UAE",
  ];

  // Fetch brands once
  useEffect(() => {
    apiRequest<{ brands: string[] }>(API_ENDPOINTS.cars.brands)
      .then((d) => setAllBrands(d.brands))
      .catch(() => {});
  }, []);

  // Fetch models when brand changes
  useEffect(() => {
    if (!formMake.trim()) {
      setAllModels([]);
      return;
    }
    // Only fetch when we have a full brand match
    const match = allBrands.find(
      (b) => b.toLowerCase() === formMake.trim().toLowerCase()
    );
    if (match) {
      apiRequest<{ models: string[] }>(API_ENDPOINTS.cars.models(match))
        .then((d) => setAllModels(d.models))
        .catch(() => setAllModels([]));
    }
  }, [formMake, allBrands]);

  // Filter brand suggestions
  useEffect(() => {
    if (!formMake.trim()) {
      setBrandSuggestions(allBrands.slice(0, 8));
    } else {
      const q = formMake.trim().toLowerCase();
      setBrandSuggestions(
        allBrands.filter((b) => b.toLowerCase().includes(q)).slice(0, 8)
      );
    }
  }, [formMake, allBrands]);

  // Filter model suggestions
  useEffect(() => {
    if (!formModel.trim()) {
      setModelSuggestions(allModels.filter((m) => !selectedModels.includes(m)).slice(0, 8));
    } else {
      const q = formModel.trim().toLowerCase();
      setModelSuggestions(
        allModels.filter((m) => m.toLowerCase().includes(q) && !selectedModels.includes(m)).slice(0, 8)
      );
    }
  }, [formModel, allModels, selectedModels]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setShowBrandDropdown(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleLocation = (loc: string) => {
    setFormLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const resetForm = () => {
    setFormMake("");
    setFormModel("");
    setFormYearFrom("");
    setFormYearTo("");
    setFormPriceMin("");
    setFormPriceMax("");
    setFormLocations([]);
    setFormTitle("");
    setSelectedModels([]);
    setShowAddForm(false);
  };

  const handleSubmitWatchlist = async () => {
    if (!formMake.trim()) {
      alert("Please select a make.");
      return;
    }
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
        isActive: false,   // inactive by default — user activates via the play button
        alertsEnabled: false,
      };
      await apiRequest(API_ENDPOINTS.watchlists.create, {
        method: "POST",
        body: JSON.stringify(body),
      });
      // Re-fetch the list
      const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
      setWatchlistItems(data.watchlists);
      setSummary(data.summary);
      resetForm();
    } catch (err) {
      console.error("Failed to create watchlist:", err);
      alert("Failed to create watchlist. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch watchlists from API
  useEffect(() => {
    const fetchWatchlists = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
        setWatchlistItems(data.watchlists);
        setSummary(data.summary);
      } catch (err) {
        console.error('Failed to fetch watchlists:', err);
        setError('Failed to load watchlists. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchlists();
  }, []);

  const toggleWatchlistStatus = async (id: number, currentlyActive: boolean) => {
    const newStatus = !currentlyActive;

    // Optimistic update
    setWatchlistItems(prev =>
      prev.map(item => item.id === id ? { ...item, isActive: newStatus } : item)
    );

    try {
      await apiRequest(API_ENDPOINTS.watchlists.setStatus(id), {
        method: "PATCH",
        body: JSON.stringify({ isActive: newStatus }),
      });
      // Re-fetch to get authoritative state + updated summary
      const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
      setWatchlistItems(data.watchlists);
      setSummary(data.summary);
    } catch (err: any) {
      // Roll back optimistic update
      setWatchlistItems(prev =>
        prev.map(item => item.id === id ? { ...item, isActive: currentlyActive } : item)
      );
      // Show the styled modal for the limit error, plain alert for anything else
      if (err?.message?.includes("409")) {
        setShowLimitModal(true);
      } else {
        alert("Failed to update watchlist status.");
      }
    }
  };

  const deleteWatchlist = async (id: number) => {
    if (!window.confirm("Delete this watchlist? This cannot be undone.")) return;

    // Optimistic removal
    const prev = watchlistItems;
    setWatchlistItems(items => items.filter(item => item.id !== id));

    try {
      await apiRequest(API_ENDPOINTS.watchlists.delete(id), { method: "DELETE" });
      // Re-fetch to get updated summary
      const data = await apiRequest<WatchlistsResponse>(API_ENDPOINTS.watchlists.list);
      setWatchlistItems(data.watchlists);
      setSummary(data.summary);
    } catch {
      // Roll back
      setWatchlistItems(prev);
      alert("Failed to delete watchlist.");
    }
  };

  const filteredItems = watchlistItems
    .filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationLabel.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by active status only - active items at top
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1; // Active items come first
      }
      return 0; // Maintain original order within each group
    });

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (showAddForm) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={resetForm}
              className="p-2"
            >
              ← Back
            </Button>
            <h1 className="text-lg font-semibold">Add to Watchlist</h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 space-y-6 pb-32">

          {/* Title (optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Watchlist Name (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="e.g., Family SUV Hunt"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Vehicle Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Brand autocomplete */}
              <div ref={brandRef} className="relative">
                <label className="text-sm font-medium text-muted-foreground">Make *</label>
                <div className="relative mt-1">
                  <Input
                    placeholder="Search brand..."
                    value={formMake}
                    onChange={(e) => {
                      setFormMake(e.target.value);
                      setShowBrandDropdown(true);
                      // Clear models when brand changes
                      setSelectedModels([]);
                      setFormModel("");
                    }}
                    onFocus={() => setShowBrandDropdown(true)}
                  />
                  {formMake && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setFormMake("");
                        setSelectedModels([]);
                        setFormModel("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {showBrandDropdown && brandSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {brandSuggestions.map((brand) => (
                      <button
                        key={brand}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 transition-colors ${
                          brand.toLowerCase() === formMake.trim().toLowerCase()
                            ? "bg-primary/5 font-medium text-primary"
                            : ""
                        }`}
                        onClick={() => {
                          setFormMake(brand);
                          setShowBrandDropdown(false);
                          setSelectedModels([]);
                          setFormModel("");
                        }}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model autocomplete */}
              <div ref={modelRef} className="relative">
                <label className="text-sm font-medium text-muted-foreground">Model</label>
                {selectedModels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                    {selectedModels.map((m) => (
                      <Badge
                        key={m}
                        variant="default"
                        className="text-xs rounded-full px-3 py-1 flex items-center gap-1 bg-primary/10 text-primary border border-primary/20"
                      >
                        {m}
                        <button
                          onClick={() =>
                            setSelectedModels((prev) => prev.filter((x) => x !== m))
                          }
                        >
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
                    onChange={(e) => {
                      setFormModel(e.target.value);
                      setShowModelDropdown(true);
                    }}
                    onFocus={() => setShowModelDropdown(true)}
                    disabled={allModels.length === 0}
                  />
                </div>
                {showModelDropdown && modelSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {modelSuggestions.map((model) => (
                      <button
                        key={model}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 transition-colors"
                        onClick={() => {
                          setSelectedModels((prev) => [...prev, model]);
                          setFormModel("");
                          setShowModelDropdown(false);
                        }}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Year From</label>
                  <Input
                    placeholder="2020"
                    type="number"
                    className="mt-1"
                    value={formYearFrom}
                    onChange={(e) => setFormYearFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Year To</label>
                  <Input
                    placeholder="2025"
                    type="number"
                    className="mt-1"
                    value={formYearTo}
                    onChange={(e) => setFormYearTo(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Price Range (AED)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Min Price</label>
                  <Input
                    placeholder="e.g. 50000"
                    type="number"
                    className="mt-1"
                    value={formPriceMin}
                    onChange={(e) => setFormPriceMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Max Price</label>
                  <Input
                    placeholder="e.g. 200000"
                    type="number"
                    className="mt-1"
                    value={formPriceMax}
                    onChange={(e) => setFormPriceMax(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location – UAE emirate buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Select one or more emirates</p>
              <div className="flex flex-wrap gap-2">
                {UAE_LOCATIONS.map((loc) => {
                  const label = loc.replace(", UAE", "");
                  const isSelected = formLocations.includes(loc);
                  return (
                    <Button
                      key={loc}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`text-xs rounded-full transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
                      }`}
                      onClick={() => toggleLocation(loc)}
                    >
                      {isSelected && <Check className="h-3 w-3 mr-1" />}
                      {label}
                    </Button>
                  );
                })}
              </div>
              {formLocations.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No selection = all emirates
                </p>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 border-primary/30 text-primary hover:bg-primary hover:text-white rounded-2xl"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg rounded-2xl"
              onClick={handleSubmitWatchlist}
              disabled={isSubmitting || !formMake.trim()}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {isSubmitting ? "Creating..." : "Add to Watchlist"}
            </Button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <h1 className="text-xl font-bold">Watchlist</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Loading watchlists...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4">
          <h1 className="text-xl font-bold">Watchlist</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <p className="text-red-800 dark:text-red-300 text-center">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Limit modal – rendered above everything */}
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}

      {/* Header with blur effect */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Watchlist</h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              onClick={() => setShowAddForm(true)}
              className="h-10 w-10 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Link href="/profile">
              <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-red-500 transition-all">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Saif" />
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your watchlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-12 h-12 rounded-2xl border-border/50 bg-background/50 backdrop-blur-sm"
          />
          <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-xl">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-5xl mx-auto p-4 space-y-6 pb-safe">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-primary">
                {summary.active}
              </div>
              <div className="text-sm text-muted-foreground">Active</div>
            </Card>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-primary">
                {summary.matches}
              </div>
              <div className="text-sm text-muted-foreground">Matches</div>
            </Card>
            <Card className="text-center p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
              <div className="text-2xl font-bold text-primary">
                {summary.withAlerts}
              </div>
              <div className="text-sm text-muted-foreground">With Alerts</div>
            </Card>
          </div>

          {/* Usage Limit Info */}
          <Card className={`p-4 backdrop-blur-sm rounded-2xl shadow-lg ${
            watchlistItems.filter(item => item.isActive).length === 0
              ? "border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/50"
              : watchlistItems.filter(item => item.isActive).length <= 2
              ? "border border-green-200 bg-gradient-to-r from-green-50 to-green-100/50"
              : "border border-red-200 bg-gradient-to-r from-red-50 to-red-100/50"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  watchlistItems.filter(item => item.isActive).length === 0
                    ? "bg-amber-100"
                    : watchlistItems.filter(item => item.isActive).length <= 2
                    ? "bg-green-100"
                    : "bg-red-100"
                }`}>
                  <Settings className={`h-5 w-5 ${
                    watchlistItems.filter(item => item.isActive).length === 0
                      ? "text-amber-600"
                      : watchlistItems.filter(item => item.isActive).length <= 2
                      ? "text-green-600"
                      : "text-red-600"
                  }`} />
                </div>
                <div>
                  <div className={`font-semibold ${
                    watchlistItems.filter(item => item.isActive).length === 0
                      ? "text-amber-800"
                      : watchlistItems.filter(item => item.isActive).length <= 2
                      ? "text-green-800"
                      : "text-red-800"
                  }`}>
                    {watchlistItems.filter(item => item.isActive).length}/2 Active Watchlists
                  </div>
                  <div className={`text-sm ${
                    watchlistItems.filter(item => item.isActive).length === 0
                      ? "text-amber-700"
                      : watchlistItems.filter(item => item.isActive).length <= 2
                      ? "text-green-700"
                      : "text-red-700"
                  }`}>
                    Free trial limit • Upgrade for unlimited
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-white shadow-md">
                Upgrade
              </Button>
            </div>
          </Card>

          {/* Watchlist Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <Link key={item.id} href={`/watchlist/${item.id}`}>
                <Card className="overflow-hidden border-2 border-border/50 bg-card/60 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                  <div className="p-6 space-y-4">
                    {/* Header Section */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <Car className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-foreground">{item.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="font-medium">{item.subtitle}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {item.newCount > 0 && (
                          <Badge variant="default" className="text-xs rounded-full px-3 bg-red-500 text-white">
                            {item.newCount} new
                          </Badge>
                        )}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className={`h-9 w-9 rounded-xl transition-all duration-200 ${
                            item.isActive 
                              ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" 
                              : "text-green-600 hover:text-green-700 hover:bg-green-50"
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleWatchlistStatus(item.id, item.isActive);
                          }}
                          title={item.isActive ? "Pause watchlist" : "Resume watchlist"}
                        >
                          {item.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-9 w-9 text-muted-foreground rounded-xl hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteWatchlist(item.id);
                          }}
                          title="Delete watchlist"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {item.locationLabel}
                        </span>
                        <span>•</span>
                        <span>{item.updatedLabel}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {item.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs rounded-full px-3 border-border/60">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 rounded-xl"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Handle notification toggle
                            }}
                          >
                            <Bell className={item.isActive ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Status Bar */}
                    <div className="pt-3 border-t border-border/30">
                      <div className="flex items-center justify-between text-sm">
                        {item.totalMatches > 0 ? (
                          <span className="text-primary font-medium">
                            {item.totalMatches} {item.totalMatches === 1 ? "match" : "matches"} found
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            No matches yet
                          </span>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                            item.isActive 
                              ? "bg-green-100 text-green-700" 
                              : "bg-red-100 text-red-700"
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${
                              item.isActive ? "bg-green-500" : "bg-red-500"
                            }`} />
                            {item.isActive ? "Active" : "Paused"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search terms" : "Start by adding your first watchlist item"}
              </p>
              <Button onClick={() => setShowAddForm(true)} className="rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
