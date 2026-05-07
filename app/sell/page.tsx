"use client";

import React, { useState, useEffect, useRef } from "react";
import { Car, Bike, X, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type VehicleType = "car" | "motorcycle";

interface SubmissionResult {
  id: number;
  type: string;
  status: string;
  predictedPrice?: number | null;
  dealLabel?: string | null;
  confidenceLow?: number | null;
  confidenceHigh?: number | null;
}

const LOCATIONS = [
  "Dubai, UAE",
  "Abu Dhabi, UAE",
  "Sharjah, UAE",
  "Ajman, UAE",
  "Ras Al Khaimah, UAE",
  "Fujairah, UAE",
  "Al Ain, UAE",
];

const REGIONAL_SPECS = ["GCC", "American", "European", "Japanese", "Other"];
const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];
const BODY_TYPES = ["Sedan", "SUV", "Coupe", "Hatchback", "Convertible", "Pickup", "Van", "Wagon"];
const CYLINDER_OPTIONS = ["3", "4", "6", "8", "10", "12"];
const DOOR_OPTIONS = ["2", "3", "4", "5"];
const SEATING_OPTIONS = ["2", "4", "5", "7", "8"];
const STEERING_OPTIONS = ["Left", "Right"];
const MOTORCYCLE_TYPES = ["Sport", "Cruiser", "Adventure", "Touring", "Naked", "Scooter"];

function SelectField({ label, value, onChange, options, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      >
        <option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder, required, min, max }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; min?: number; max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="h-10"
      />
    </div>
  );
}

export default function SellPage() {
  const { user, loading: authLoading, avatarSeed } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared fields
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [year, setYear] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [location, setLocation] = useState("");
  const [regionalSpecs, setRegionalSpecs] = useState("");
  const [exteriorColor, setExteriorColor] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [description, setDescription] = useState("");

  // Car-only fields
  const [bodyType, setBodyType] = useState("");
  const [cylinders, setCylinders] = useState("");
  const [horsepower, setHorsepower] = useState("");
  const [engineCapacity, setEngineCapacity] = useState("");
  const [doors, setDoors] = useState("");
  const [seatingCapacity, setSeatingCapacity] = useState("");
  const [steeringSide, setSteeringSide] = useState("");
  const [interiorColor, setInteriorColor] = useState("");

  // Motorcycle-only fields
  const [motorcycleType, setMotorcycleType] = useState("");
  const [engineCC, setEngineCC] = useState("");
  const [motoHorsepower, setMotoHorsepower] = useState("");

  // Image upload
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brand/model autocomplete
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [allModels, setAllModels] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // Pre-fill seller name from profile
  useEffect(() => {
    if (user) {
      apiRequest<{ name: string }>(API_ENDPOINTS.profile)
        .then((p) => { if (p.name) setSellerName(p.name); })
        .catch(() => {});
    }
  }, [user]);

  // Fetch brands based on vehicle type
  useEffect(() => {
    const endpoint = vehicleType === "car" ? API_ENDPOINTS.cars.brands : API_ENDPOINTS.motorcycles.brands;
    apiRequest<{ brands: string[] }>(endpoint)
      .then((d) => setAllBrands(d.brands))
      .catch(() => setAllBrands([]));
  }, [vehicleType]);

  // Fetch models when brand changes
  useEffect(() => {
    if (!brand.trim()) { setAllModels([]); return; }
    const match = allBrands.find((b) => b.toLowerCase() === brand.trim().toLowerCase());
    if (match) {
      const endpoint = vehicleType === "car"
        ? API_ENDPOINTS.cars.models(match)
        : API_ENDPOINTS.motorcycles.models(match);
      apiRequest<{ models: string[] }>(endpoint)
        .then((d) => setAllModels(d.models))
        .catch(() => setAllModels([]));
    }
  }, [brand, allBrands, vehicleType]);

  // Filter brand suggestions
  useEffect(() => {
    if (!brand.trim()) setBrandSuggestions(allBrands.slice(0, 8));
    else {
      const q = brand.trim().toLowerCase();
      setBrandSuggestions(allBrands.filter((b) => b.toLowerCase().includes(q)).slice(0, 8));
    }
  }, [brand, allBrands]);

  // Filter model suggestions
  useEffect(() => {
    if (!model.trim()) setModelSuggestions(allModels.slice(0, 8));
    else {
      const q = model.trim().toLowerCase();
      setModelSuggestions(allModels.filter((m) => m.toLowerCase().includes(q)).slice(0, 8));
    }
  }, [model, allModels]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setShowBrandDropdown(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModelDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset type-specific fields when switching
  const handleTypeChange = (type: VehicleType) => {
    setVehicleType(type);
    setBrand("");
    setModel("");
    setAllBrands([]);
    setAllModels([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 5 * 1024 * 1024);
    const remaining = 10 - imageFiles.length;
    const toAdd = valid.slice(0, remaining);

    setImageFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(f);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    setIsUploading(true);
    try {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (!supabaseUser) throw new Error("Not authenticated");

      const urls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${supabaseUser.id}/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("listing-images")
          .getPublicUrl(path);
        urls.push(publicUrl);
      }
      return urls;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!brand.trim() || !model.trim() || !year || !price) {
      setError("Please fill in all required fields: Brand, Model, Year, and Price.");
      return;
    }
    const yearNum = parseInt(year, 10);
    if (yearNum < 1990 || yearNum > 2026) {
      setError("Year must be between 1990 and 2026.");
      return;
    }
    if (parseInt(price, 10) <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const urls = await uploadImages();
      const endpoint = vehicleType === "car" ? API_ENDPOINTS.sell.car : API_ENDPOINTS.sell.motorcycle;

      const shared = {
        brand: brand.trim(),
        model: model.trim(),
        trim: trim.trim() || null,
        year: parseInt(year, 10),
        price: parseInt(price, 10),
        kms: mileage ? parseInt(mileage, 10) : null,
        fuel_type: fuelType || null,
        exterior_color: exteriorColor.trim() || null,
        regional_specs: regionalSpecs || null,
        location: location || "Dubai, UAE",
        image: urls[0] || null,
        images: urls.length > 0 ? urls : null,
        seller_name: sellerName.trim() || null,
        seller_phone: sellerPhone.trim() || null,
        description: description.trim() || null,
      };

      let body;
      if (vehicleType === "car") {
        body = {
          ...shared,
          body_type: bodyType || null,
          cylinders: cylinders || null,
          horsepower: horsepower || null,
          engine_capacity: engineCapacity || null,
          doors: doors || null,
          seating_capacity: seatingCapacity || null,
          steering_side: steeringSide || null,
          interior_color: interiorColor.trim() || null,
        };
      } else {
        body = {
          ...shared,
          motorcycle_type: motorcycleType || null,
          engine_cc: engineCC ? parseInt(engineCC, 10) : null,
          horsepower: motoHorsepower || null,
        };
      }

      const result = await apiRequest<SubmissionResult>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSubmissionResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (submissionResult) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center">
          <h1 className="text-lg font-semibold tracking-tight">Listing Submitted</h1>
        </header>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 pb-safe">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
              <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-xl font-semibold">Submitted Successfully!</h2>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-0">
                      Pending Review
                    </Badge>
                  </div>

                  {submissionResult.type === "car" && submissionResult.predictedPrice && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2"
                    >
                      <p className="text-sm text-muted-foreground">Our AI estimates your car is worth</p>
                      <p className="text-2xl font-bold text-foreground">
                        AED {submissionResult.predictedPrice.toLocaleString()}
                      </p>
                      {submissionResult.dealLabel && (
                        <Badge variant={submissionResult.dealLabel === "Good Deal" ? "default" : "secondary"}>
                          {submissionResult.dealLabel}
                        </Badge>
                      )}
                      {submissionResult.confidenceLow && submissionResult.confidenceHigh && (
                        <p className="text-xs text-muted-foreground">
                          Range: AED {submissionResult.confidenceLow.toLocaleString()} &ndash; AED {submissionResult.confidenceHigh.toLocaleString()}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {submissionResult.type === "motorcycle" && (
                    <p className="text-sm text-muted-foreground text-center">
                      Your motorcycle listing has been submitted and is awaiting review by our team.
                    </p>
                  )}

                  <div className="flex flex-col gap-3 pt-2">
                    <Link href="/profile/my-listings">
                      <Button className="w-full">View My Listings</Button>
                    </Link>
                    <Button variant="outline" className="w-full" onClick={() => {
                      setSubmissionResult(null);
                      setBrand(""); setModel(""); setTrim(""); setYear(""); setPrice("");
                      setMileage(""); setLocation(""); setRegionalSpecs(""); setExteriorColor("");
                      setFuelType(""); setDescription("");
                      setBodyType(""); setCylinders(""); setHorsepower(""); setEngineCapacity("");
                      setDoors(""); setSeatingCapacity(""); setSteeringSide(""); setInteriorColor("");
                      setMotorcycleType(""); setEngineCC(""); setMotoHorsepower("");
                      setImageFiles([]); setImagePreviews([]);
                    }}>
                      Submit Another Listing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Sell Your Vehicle</h1>
        <Avatar className="h-8 w-8">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
          <AvatarFallback>{user.email?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-safe">
          {/* Vehicle type selector */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="grid grid-cols-2 gap-3">
              {([
                { type: "car" as const, icon: Car, label: "Car" },
                { type: "motorcycle" as const, icon: Bike, label: "Motorcycle" },
              ]).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                    vehicleType === type
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-card/80 hover:border-border"
                  )}
                >
                  <Icon className={cn("h-7 w-7", vehicleType === type ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", vehicleType === type ? "text-primary" : "text-muted-foreground")}>{label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vehicle Details</h3>

                {/* Brand autocomplete */}
                <div className="space-y-1.5" ref={brandRef}>
                  <label className="text-sm font-medium text-foreground">
                    Brand<span className="text-primary ml-0.5">*</span>
                  </label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    onFocus={() => setShowBrandDropdown(true)}
                    placeholder="e.g. Toyota, BMW..."
                    className="h-10"
                  />
                  {showBrandDropdown && brandSuggestions.length > 0 && (
                    <div className="absolute z-20 w-[calc(100%-2rem)] md:w-auto md:min-w-[280px] mt-1 max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-card shadow-lg">
                      {brandSuggestions.map((b) => (
                        <button
                          key={b}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                          onClick={() => { setBrand(b); setModel(""); setShowBrandDropdown(false); }}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Model autocomplete */}
                <div className="space-y-1.5" ref={modelRef}>
                  <label className="text-sm font-medium text-foreground">
                    Model<span className="text-primary ml-0.5">*</span>
                  </label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    onFocus={() => setShowModelDropdown(true)}
                    placeholder={brand ? "Select model..." : "Select brand first"}
                    disabled={!brand.trim()}
                    className="h-10"
                  />
                  {showModelDropdown && modelSuggestions.length > 0 && (
                    <div className="absolute z-20 w-[calc(100%-2rem)] md:w-auto md:min-w-[280px] mt-1 max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-card shadow-lg">
                      {modelSuggestions.map((m) => (
                        <button
                          key={m}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                          onClick={() => { setModel(m); setShowModelDropdown(false); }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <TextField label="Trim" value={trim} onChange={setTrim} placeholder="e.g. SE, Limited, Sport" />

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Year" value={year} onChange={setYear} type="number" placeholder="2024" required min={1990} max={2026} />
                  <TextField label="Price (AED)" value={price} onChange={setPrice} type="number" placeholder="150000" required min={1} />
                </div>

                <TextField label="Mileage (km)" value={mileage} onChange={setMileage} type="number" placeholder="50000" />

                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Location" value={location} onChange={setLocation} options={LOCATIONS} />
                  <SelectField label="Regional Specs" value={regionalSpecs} onChange={setRegionalSpecs} options={REGIONAL_SPECS} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Exterior Color" value={exteriorColor} onChange={setExteriorColor} placeholder="White" />
                  <SelectField label="Fuel Type" value={fuelType} onChange={setFuelType} options={FUEL_TYPES} />
                </div>

                {/* Car-only fields */}
                {vehicleType === "car" && (
                  <>
                    <div className="pt-2 border-t border-border/40">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Car Specifications</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField label="Body Type" value={bodyType} onChange={setBodyType} options={BODY_TYPES} />
                      <SelectField label="Cylinders" value={cylinders} onChange={setCylinders} options={CYLINDER_OPTIONS} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="Horsepower" value={horsepower} onChange={setHorsepower} type="number" placeholder="300" />
                      <TextField label="Engine CC" value={engineCapacity} onChange={setEngineCapacity} type="number" placeholder="3000" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField label="Doors" value={doors} onChange={setDoors} options={DOOR_OPTIONS} />
                      <SelectField label="Seating Capacity" value={seatingCapacity} onChange={setSeatingCapacity} options={SEATING_OPTIONS} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField label="Steering Side" value={steeringSide} onChange={setSteeringSide} options={STEERING_OPTIONS} />
                      <TextField label="Interior Color" value={interiorColor} onChange={setInteriorColor} placeholder="Black" />
                    </div>
                  </>
                )}

                {/* Motorcycle-only fields */}
                {vehicleType === "motorcycle" && (
                  <>
                    <div className="pt-2 border-t border-border/40">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Motorcycle Specifications</h3>
                    </div>
                    <SelectField label="Motorcycle Type" value={motorcycleType} onChange={setMotorcycleType} options={MOTORCYCLE_TYPES} />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="Engine CC" value={engineCC} onChange={setEngineCC} type="number" placeholder="600" />
                      <TextField label="Horsepower" value={motoHorsepower} onChange={setMotoHorsepower} type="number" placeholder="100" />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Image upload */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Photos</h3>
                <p className="text-xs text-muted-foreground">Upload up to 10 photos (max 5MB each)</p>

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border/60">
                        <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {imageFiles.length < 10 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 transition-colors"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {imageFiles.length === 0 ? "Add photos" : `Add more (${imageFiles.length}/10)`}
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Seller info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Seller Information</h3>
                <TextField label="Seller Name" value={sellerName} onChange={setSellerName} placeholder="Your name" />
                <TextField label="Phone Number" value={sellerPhone} onChange={setSellerPhone} placeholder="+971 50 123 4567" />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your vehicle's condition, history, features..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50"
              >
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className="w-full h-12 text-base font-semibold"
            >
              {isSubmitting || isUploading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {isUploading ? "Uploading photos..." : "Submitting..."}
                </span>
              ) : (
                "Submit for Review"
              )}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
