"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export interface PartCardData {
  id: number;
  name: string;
  price: string;
  image?: string | null;
  sellerName: string;
  categoryBreadcrumb: string;
  compatibleCars: string;
}

interface PartCardProps {
  part: PartCardData;
  isFavorite?: boolean;
  onToggleFavorite?: (id: number) => void;
  index?: number;
}

export function PartCard({ part, isFavorite = false, onToggleFavorite, index = 0 }: PartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/listing/parts/${part.id}`} className="group block">
        <div className="bg-card rounded-xl border border-border/60 shadow-card overflow-hidden transition-all duration-200 ease-out group-hover:shadow-card-hover group-hover:-translate-y-0.5 group-hover:border-border">
          <div className="relative aspect-square overflow-hidden bg-muted">
            {part.image ? (
              <img src={part.image} alt={part.name} className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No Image</div>
            )}
            {onToggleFavorite && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(part.id); }}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-soft transition-all duration-150 hover:scale-110 active:scale-95"
              >
                <Heart className={`h-4 w-4 transition-colors duration-150 ${isFavorite ? "text-red-500 fill-red-500" : "text-slate-500 dark:text-slate-400"}`} />
              </button>
            )}
          </div>
          <div className="p-4 space-y-2">
            <p className="text-[10px] text-muted-foreground truncate">{part.categoryBreadcrumb}</p>
            <h4 className="font-semibold text-sm text-foreground leading-tight truncate">{part.name}</h4>
            <span className="text-lg font-bold text-primary block">{part.price}</span>
            {part.compatibleCars && (
              <p className="text-xs text-muted-foreground truncate">Fits: {part.compatibleCars}</p>
            )}
            <p className="text-xs text-muted-foreground">{part.sellerName}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PartCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden">
      <div className="aspect-square skeleton" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-20 skeleton" />
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-5 w-1/3 skeleton" />
        <div className="h-3 w-1/2 skeleton" />
      </div>
    </div>
  );
}
