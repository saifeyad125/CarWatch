"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronDown,
  Gauge,
  TrendingDown,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

interface ForecastPoint {
  years_ahead: number;
  projected_age: number;
  projected_kms: number;
  predicted_price: number;
  retention_pct: number;
}

interface GarageCar {
  id: string;
  createdAt: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  annualKms: number;
  fuelType: string;
  bodyType?: string;
  trim?: string;
  cylinders?: number;
  horsepower?: number;
  engineCc?: number;
  regionalSpecs: string;
  steeringSide: string;
  currentPrice: number;
  projections: ForecastPoint[];
}

const STORAGE_KEY = "carwatch_garage";

function loadGarage(): GarageCar[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGarage(cars: GarageCar[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
  } catch {}
}

function formatAED(v: number): string {
  return `AED ${v.toLocaleString()}`;
}

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

type View = "list" | "add" | "detail";

function ForecastDetailView({
  car,
  onBack,
}: {
  car: GarageCar;
  onBack: () => void;
}) {
  const chartData = [
    { label: "Now", retentionPct: 100 },
    ...car.projections.map((p) => ({
      label: `${p.years_ahead}yr`,
      retentionPct: p.retention_pct,
    })),
  ];

  const prices = [car.currentPrice, ...car.projections.map((p) => p.predicted_price)];

  const milestones = [
    { label: "Today", price: car.currentPrice, drop: 0 },
    {
      label: "Year 3",
      price: car.projections[2]?.predicted_price ?? 0,
      drop: car.projections[2]
        ? Math.round(100 - car.projections[2].retention_pct)
        : 0,
    },
    {
      label: "Year 5",
      price: car.projections[4]?.predicted_price ?? 0,
      drop: car.projections[4]
        ? Math.round(100 - car.projections[4].retention_pct)
        : 0,
    },
    {
      label: "Year 10",
      price: car.projections[9]?.predicted_price ?? 0,
      drop: car.projections[9]
        ? Math.round(100 - car.projections[9].retention_pct)
        : 0,
    },
  ];

  const chartMinWidth = `${chartData.length * 52}px`;

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-lg font-semibold text-foreground truncate max-w-[60%] text-center">
          {car.year} {car.brand} {car.model}
        </h1>
        <div className="w-14" />
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-safe">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Car className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Vehicle Summary</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Year</p>
                <p className="text-sm font-medium text-foreground">{car.year}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mileage</p>
                <p className="text-sm font-medium text-foreground">
                  {car.mileage.toLocaleString()} km
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual Driving</p>
                <p className="text-sm font-medium text-foreground">
                  {car.annualKms.toLocaleString()} km/yr
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fuel</p>
                <p className="text-sm font-medium text-foreground">{car.fuelType}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs text-muted-foreground mb-1">AI Predicted Current Value</p>
            <p className="text-2xl font-bold text-foreground">{formatAED(car.currentPrice)}</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <TrendingDown className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Value Over Time</h4>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
              <div style={{ minWidth: chartMinWidth }}>
                <div className="flex gap-3 sm:gap-6 mb-3">
                  {chartData.map((item, i) => {
                    const pct = Math.max(item.retentionPct, 2);
                    const color =
                      item.retentionPct >= 80
                        ? "bg-emerald-500"
                        : item.retentionPct >= 60
                        ? "bg-amber-500"
                        : item.retentionPct >= 50
                        ? "bg-orange-500"
                        : "bg-red-500";

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center min-w-[36px]">
                        <span className="text-xs font-semibold text-foreground mb-1.5">
                          {item.retentionPct.toFixed(0)}%
                        </span>
                        <div className="w-full h-32 sm:h-40 flex items-end justify-center">
                          <motion.div
                            className={`w-full max-w-14 rounded-t-md ${color}`}
                            initial={{ height: 0 }}
                            animate={{ height: `${pct}%` }}
                            transition={{
                              duration: 0.6,
                              delay: i * 0.1,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium mt-2">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="grid gap-2 mt-4 pt-4 border-t border-border/40"
                  style={{ gridTemplateColumns: `repeat(${prices.length}, minmax(0, 1fr))` }}
                >
                  {prices.map((price, i) => (
                    <div key={i} className="text-center min-w-[44px]">
                      <p className="text-xs text-muted-foreground">{chartData[i]?.label}</p>
                      <p className="text-sm font-semibold text-foreground">{formatK(price)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Swipe to see more
            </p>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {milestones.map((m) => (
              <div
                key={m.label}
                className="text-center p-2.5 bg-muted/50 rounded-lg"
              >
                <p className="text-[11px] text-muted-foreground mb-1">{m.label}</p>
                <p className="text-sm font-bold text-foreground">
                  {formatK(m.price)}
                </p>
                {m.drop > 0 && (
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">
                    -{m.drop}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const INTENSITY_PRESETS = [
  { label: "Light", value: 10_000 },
  { label: "Average", value: 20_000 },
  { label: "Heavy", value: 35_000 },
];

function AddCarView({
  onBack,
  onCarAdded,
}: {
  onBack: () => void;
  onCarAdded: (car: GarageCar) => void;
}) {
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allModels, setAllModels] = useState<string[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [fuelType, setFuelType] = useState("Petrol");
  const [bodyType, setBodyType] = useState("");
  const [regionalSpecs, setRegionalSpecs] = useState("GCC");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trim, setTrim] = useState("");
  const [horsepower, setHorsepower] = useState("");
  const [engineCc, setEngineCc] = useState("");
  const [cylinders, setCylinders] = useState("");
  const [steeringSide, setSteeringSide] = useState("Left");

  const [annualKms, setAnnualKms] = useState("20000");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(20_000);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ brands: string[] }>(API_ENDPOINTS.cars.brands)
      .then((d) => setAllBrands(d.brands))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!brand.trim()) {
      setAllModels([]);
      return;
    }
    const matched = allBrands.find(
      (b) => b.toLowerCase() === brand.trim().toLowerCase()
    );
    if (matched) {
      apiRequest<{ models: string[] }>(API_ENDPOINTS.cars.models(matched))
        .then((d) => setAllModels(d.models))
        .catch(() => setAllModels([]));
    } else {
      setAllModels([]);
    }
  }, [brand, allBrands]);

  useEffect(() => {
    const q = brand.trim().toLowerCase();
    if (!q) {
      setBrandSuggestions(allBrands.slice(0, 8));
    } else {
      setBrandSuggestions(
        allBrands.filter((b) => b.toLowerCase().includes(q)).slice(0, 8)
      );
    }
  }, [brand, allBrands]);

  useEffect(() => {
    const q = model.trim().toLowerCase();
    if (!q) {
      setModelSuggestions(allModels.slice(0, 8));
    } else {
      setModelSuggestions(
        allModels.filter((m) => m.toLowerCase().includes(q)).slice(0, 8)
      );
    }
  }, [model, allModels]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node))
        setShowBrandDropdown(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node))
        setShowModelDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const kmsNum = parseInt(annualKms, 10);
  const kmsError =
    annualKms.trim() !== "" && (isNaN(kmsNum) || kmsNum < 1_000 || kmsNum > 100_000)
      ? "Must be between 1,000 and 100,000 km/yr"
      : null;

  const yearNum = parseInt(year, 10);
  const mileageNum = parseInt(mileage.replace(/,/g, ""), 10);

  const canSubmit =
    brand.trim() !== "" &&
    model.trim() !== "" &&
    year.trim() !== "" &&
    !isNaN(yearNum) &&
    yearNum >= 1990 &&
    yearNum <= 2026 &&
    mileage.trim() !== "" &&
    !isNaN(mileageNum) &&
    mileageNum >= 0 &&
    mileageNum <= 500_000 &&
    !kmsError &&
    annualKms.trim() !== "" &&
    !isSubmitting;

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        brand: brand.trim(),
        model: model.trim(),
        year: yearNum,
        mileage: mileageNum,
        annual_kms: kmsNum,
        fuel_type: fuelType || "Petrol",
        regional_specs: regionalSpecs || "GCC",
        steering_side: steeringSide || "Left",
      };
      if (bodyType) body.body_type = bodyType;
      if (trim) body.trim = trim;
      if (horsepower) body.horsepower = parseInt(horsepower, 10);
      if (engineCc) body.engine_cc = parseInt(engineCc, 10);
      if (cylinders) body.cylinders = parseInt(cylinders, 10);

      const result = await apiRequest<{
        current_price: number;
        annual_kms: number;
        projections: ForecastPoint[];
      }>(API_ENDPOINTS.predictions.forecast, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const car: GarageCar = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        brand: brand.trim(),
        model: model.trim(),
        year: yearNum,
        mileage: mileageNum,
        annualKms: kmsNum,
        fuelType: fuelType || "Petrol",
        ...(bodyType && { bodyType }),
        ...(trim && { trim }),
        ...(horsepower && { horsepower: parseInt(horsepower, 10) }),
        ...(engineCc && { engineCc: parseInt(engineCc, 10) }),
        ...(cylinders && { cylinders: parseInt(cylinders, 10) }),
        regionalSpecs: regionalSpecs || "GCC",
        steeringSide: steeringSide || "Left",
        currentPrice: result.current_price,
        projections: result.projections,
      };

      onCarAdded(car);
    } catch {
      setError("Failed to generate forecast. Please check your inputs and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-lg font-semibold text-foreground">Add Car</h1>
        <div className="w-14" />
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-safe">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-primary" /> Car Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div ref={brandRef} className="relative">
                <label className="text-xs font-medium text-muted-foreground">Brand *</label>
                <div className="relative mt-1">
                  <Input
                    placeholder="Search brand..."
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      setShowBrandDropdown(true);
                      setModel("");
                    }}
                    onFocus={() => setShowBrandDropdown(true)}
                  />
                  {brand && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setBrand("");
                        setModel("");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {showBrandDropdown && brandSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] border border-border rounded-lg shadow-elevated max-h-48 overflow-y-auto">
                    {brandSuggestions.map((b) => (
                      <button
                        key={b}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                          b.toLowerCase() === brand.trim().toLowerCase()
                            ? "bg-accent font-medium text-primary"
                            : ""
                        }`}
                        onClick={() => {
                          setBrand(b);
                          setShowBrandDropdown(false);
                          setModel("");
                        }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div ref={modelRef} className="relative">
                <label className="text-xs font-medium text-muted-foreground">Model *</label>
                <div className="relative mt-1">
                  <Input
                    placeholder={allModels.length ? "Search model..." : "Select a brand first"}
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value);
                      setShowModelDropdown(true);
                    }}
                    onFocus={() => setShowModelDropdown(true)}
                    disabled={allModels.length === 0}
                  />
                  {model && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setModel("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {showModelDropdown && modelSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] border border-border rounded-lg shadow-elevated max-h-48 overflow-y-auto">
                    {modelSuggestions.map((m) => (
                      <button
                        key={m}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                          m.toLowerCase() === model.trim().toLowerCase()
                            ? "bg-accent font-medium text-primary"
                            : ""
                        }`}
                        onClick={() => {
                          setModel(m);
                          setShowModelDropdown(false);
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Year *</label>
                  <Input
                    type="number"
                    placeholder="e.g. 2020"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    min={1990}
                    max={2026}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Mileage (km) *</label>
                  <Input
                    type="number"
                    placeholder="e.g. 50000"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    min={0}
                    max={500000}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Fuel Type</label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                  >
                    {["Petrol", "Diesel", "Electric", "Hybrid"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Body Type</label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value)}
                  >
                    <option value="">Any</option>
                    {["Sedan", "SUV", "Coupe", "Hatchback", "Convertible", "Van", "Wagon", "Pickup"].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Regional Specs</label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={regionalSpecs}
                    onChange={(e) => setRegionalSpecs(e.target.value)}
                  >
                    {["GCC", "European", "American", "Japanese", "Korean", "Other"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
                Advanced options
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Trim</label>
                        <Input
                          placeholder="e.g. Sport"
                          value={trim}
                          onChange={(e) => setTrim(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Horsepower</label>
                        <Input
                          type="number"
                          placeholder="e.g. 200"
                          value={horsepower}
                          onChange={(e) => setHorsepower(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Engine CC</label>
                        <Input
                          type="number"
                          placeholder="e.g. 2000"
                          value={engineCc}
                          onChange={(e) => setEngineCc(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cylinders</label>
                        <Input
                          type="number"
                          placeholder="e.g. 4"
                          value={cylinders}
                          onChange={(e) => setCylinders(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Steering Side</label>
                        <select
                          className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={steeringSide}
                          onChange={(e) => setSteeringSide(e.target.value)}
                        >
                          <option value="Left">Left</option>
                          <option value="Right">Right</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-primary" /> Driving Intensity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {INTENSITY_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={selectedPreset === preset.value ? "default" : "outline"}
                    size="sm"
                    className="text-xs rounded-full"
                    onClick={() => {
                      setSelectedPreset(preset.value);
                      setAnnualKms(String(preset.value));
                    }}
                  >
                    {selectedPreset === preset.value && <Check className="h-3 w-3 mr-1" />}
                    {preset.label} ({preset.value.toLocaleString()} km/yr)
                  </Button>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Custom (km/yr)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 15000"
                  value={annualKms}
                  onChange={(e) => {
                    setAnnualKms(e.target.value);
                    const v = parseInt(e.target.value, 10);
                    setSelectedPreset(
                      INTENSITY_PRESETS.find((p) => p.value === v)?.value ?? null
                    );
                  }}
                  min={1000}
                  max={100000}
                  className="mt-1"
                />
                {kmsError && (
                  <p className="text-xs text-red-500 mt-1">{kmsError}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Calculating...
              </span>
            ) : (
              "Calculate Forecast"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OwnershipCostsPage() {
  const [view, setView] = useState<View>("list");
  const [cars, setCars] = useState<GarageCar[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    const init = () => {
      try {
        localStorage.setItem("__test", "1");
        localStorage.removeItem("__test");
      } catch {
        setStorageWarning(true);
      }
      setCars(loadGarage());
    };
    init();
  }, []);

  const selectedCar = cars.find((c) => c.id === selectedCarId) || null;

  const handleDelete = (id: string) => {
    const updated = cars.filter((c) => c.id !== id);
    setCars(updated);
    saveGarage(updated);
    setDeleteConfirmId(null);
  };

  const handleCarAdded = (car: GarageCar) => {
    const updated = [car, ...cars];
    setCars(updated);
    saveGarage(updated);
    setSelectedCarId(car.id);
    setView("detail");
  };

  const openDetail = (id: string) => {
    setSelectedCarId(id);
    setView("detail");
  };

  if (view === "list") {
    return (
      <div className="flex flex-col h-full">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-foreground">Ownership Costs</h1>
          <Button size="sm" onClick={() => setView("add")}>
            <Plus className="h-4 w-4 mr-1" /> Add Car
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-3 pb-safe">
            {storageWarning && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Your cars won&apos;t be saved in private browsing mode.
              </div>
            )}

            {cars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Car className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-1">Add your first car</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  See how your car&apos;s value changes over the next 10 years
                </p>
                <Button onClick={() => setView("add")}>
                  <Plus className="h-4 w-4 mr-1" /> Add Car
                </Button>
              </div>
            ) : (
              cars.map((car) => (
                <Card
                  key={car.id}
                  className="p-4 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => openDetail(car.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {car.year} {car.brand} {car.model}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {car.mileage.toLocaleString()} km &middot; {car.annualKms.toLocaleString()} km/yr
                      </p>
                      <p className="text-sm font-medium text-primary mt-1">
                        {formatAED(car.currentPrice)}
                      </p>
                    </div>
                    <div className="shrink-0 ml-3">
                      {deleteConfirmId === car.id ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleDelete(car.id)}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(car.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "add") {
    return (
      <AddCarView
        onBack={() => setView("list")}
        onCarAdded={handleCarAdded}
      />
    );
  }

  if (view === "detail" && selectedCar) {
    return (
      <ForecastDetailView
        car={selectedCar}
        onBack={() => {
          setSelectedCarId(null);
          setView("list");
        }}
      />
    );
  }

  return null;
}
