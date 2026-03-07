"use client";

import { Heart, Gauge, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { motion } from "framer-motion";

export interface CarCardData {
  id: number;
  make: string;
  model: string;
  year: number;
  price: string;
  predictedPrice?: string;
  dealLabel?: "Good Deal" | "Fair" | "Overpriced";
  mileage: string;
  location: string;
  image: string;
}

interface CarCardProps {
  car: CarCardData;
  isFavorite?: boolean;
  onToggleFavorite?: (id: number) => void;
  index?: number;
}

export function CarCard({ car, isFavorite = false, onToggleFavorite, index = 0 }: CarCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Link href={`/listing/${car.id}`} className="group block">
        <div className="bg-card rounded-xl border border-border/60 shadow-card overflow-hidden transition-all duration-200 ease-out group-hover:shadow-card-hover group-hover:-translate-y-0.5 group-hover:border-border">
          {/* Image */}
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src={car.image}
              alt={`${car.year} ${car.make} ${car.model}`}
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />

            {/* Favorite button */}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(car.id);
                }}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-soft transition-all duration-150 hover:scale-110 active:scale-95"
              >
                <Heart
                  className={`h-4 w-4 transition-colors duration-150 ${
                    isFavorite
                      ? "text-red-500 fill-red-500"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                />
              </button>
            )}

            {/* Deal badge */}
            {car.dealLabel && (
              <div className="absolute top-3 left-3">
                <Badge
                  className={`text-xs font-medium shadow-sm ${
                    car.dealLabel === "Good Deal"
                      ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500"
                      : car.dealLabel === "Overpriced"
                        ? "bg-red-500 text-white border-red-500 hover:bg-red-500"
                        : "bg-slate-500 text-white border-slate-500 hover:bg-slate-500"
                  }`}
                >
                  {car.dealLabel}
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 space-y-2.5">
            {/* Title */}
            <h4 className="font-semibold text-base text-foreground leading-tight truncate">
              {car.year} {car.make} {car.model}
            </h4>

            {/* Price row */}
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary">{car.price}</span>
              {car.predictedPrice && (
                <span className="text-xs text-muted-foreground line-through">
                  {car.predictedPrice}
                </span>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" />
                {car.mileage}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {car.location}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* Skeleton variant for loading states */
export function CarCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden">
      <div className="aspect-[16/10] skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-6 w-1/3 skeleton" />
        <div className="flex gap-3">
          <div className="h-3 w-16 skeleton" />
          <div className="h-3 w-20 skeleton" />
        </div>
      </div>
    </div>
  );
}
