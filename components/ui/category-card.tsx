"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";

interface CategoryCardProps {
  id: number;
  name: string;
  icon?: string | null;
  partCount: number;
  index?: number;
}

export function CategoryCard({ id, name, icon, partCount, index = 0 }: CategoryCardProps) {
  const IconComponent = icon
    ? (LucideIcons as unknown as Record<string, React.ElementType>)[
        icon.split("-").map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1))).join("")
      ] || LucideIcons.Package
    : LucideIcons.Package;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/browse/parts/category/${id}`} className="group block">
        <div className="bg-card rounded-xl border border-border/60 shadow-card p-5 flex flex-col items-center gap-3 transition-all duration-200 ease-out group-hover:shadow-card-hover group-hover:-translate-y-0.5 group-hover:border-border min-h-[120px] justify-center">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary/15">
            <IconComponent className="h-5 w-5 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-medium text-sm text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{partCount} parts</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function CategoryCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-soft p-5 flex flex-col items-center gap-3 min-h-[120px] justify-center">
      <div className="h-10 w-10 rounded-xl skeleton" />
      <div className="h-4 w-16 skeleton" />
      <div className="h-3 w-10 skeleton" />
    </div>
  );
}
