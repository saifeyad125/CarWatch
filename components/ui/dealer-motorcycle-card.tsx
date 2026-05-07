"use client";

import { Heart, Gauge, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { motion } from "framer-motion";

export interface DealerMotorcycleCardData {
  id: number;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: string;
  mileage: string;
  location: string;
  image: string;
  engineCc?: number | null;
  motorcycleType?: string | null;
  dealerName: string;
  dealerLogo?: string | null;
  dealerId: number;
}

interface DealerMotorcycleCardProps {
  motorcycle: DealerMotorcycleCardData;
  isFavorite?: boolean;
  onToggleFavorite?: (id: number) => void;
  index?: number;
}

export function DealerMotorcycleCard({ motorcycle, isFavorite = false, onToggleFavorite, index = 0 }: DealerMotorcycleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/listing/motorcycle/dealer/${motorcycle.id}`} className="group block">
        <div className="bg-card rounded-xl border border-violet-500/20 shadow-card overflow-hidden transition-all duration-200 ease-out group-hover:shadow-card-hover group-hover:-translate-y-0.5 group-hover:border-violet-500/40">
          <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/5 border-b border-violet-500/10">
            {motorcycle.dealerLogo && (
              <img src={motorcycle.dealerLogo} alt={motorcycle.dealerName} className="h-5 w-5 rounded object-cover" />
            )}
            <span className="text-xs font-medium text-violet-600 dark:text-violet-400 truncate">{motorcycle.dealerName}</span>
            <Badge className="ml-auto text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/10">
              Dealer
            </Badge>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src={motorcycle.image}
              alt={`${motorcycle.year} ${motorcycle.make} ${motorcycle.model}${motorcycle.trim ? ` ${motorcycle.trim}` : ""}`}
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(motorcycle.id); }}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-soft transition-all duration-150 hover:scale-110 active:scale-95"
              >
                <Heart className={`h-4 w-4 transition-colors duration-150 ${isFavorite ? "text-red-500 fill-red-500" : "text-slate-500 dark:text-slate-400"}`} />
              </button>
            )}
            {motorcycle.motorcycleType && (
              <div className="absolute top-3 left-3">
                <Badge className="text-xs font-medium shadow-sm bg-violet-500 text-white border-violet-500 hover:bg-violet-500">
                  {motorcycle.motorcycleType}
                </Badge>
              </div>
            )}
          </div>

          <div className="p-4 space-y-2.5">
            <h4 className="font-semibold text-base text-foreground leading-tight truncate">
              {motorcycle.year} {motorcycle.make} {motorcycle.model}{motorcycle.trim ? ` ${motorcycle.trim}` : ""}
            </h4>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary">{motorcycle.price}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
              {motorcycle.engineCc && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                  {motorcycle.engineCc}cc
                </span>
              )}
              <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{motorcycle.mileage}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{motorcycle.location}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function DealerMotorcycleCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-violet-500/20 shadow-soft overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/5"><div className="h-4 w-24 skeleton" /></div>
      <div className="aspect-[16/10] skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-6 w-1/3 skeleton" />
        <div className="flex gap-3"><div className="h-3 w-12 skeleton" /><div className="h-3 w-16 skeleton" /><div className="h-3 w-20 skeleton" /></div>
      </div>
    </div>
  );
}
