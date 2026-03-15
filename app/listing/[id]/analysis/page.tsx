"use client"

import { ArrowLeft, BarChart3, TrendingDown, Gauge, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, useRef } from "react";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";
import { motion } from "framer-motion";

// TypeScript Interfaces 

interface DepreciationPoint {
  yearsAhead: number;
  projectedAge: number;
  projectedKms: number;
  predictedPrice: number;
  retentionPct: number;
}

interface PriceMileagePoint {
  kms: number;
  price: number;
}

interface PriceYearPoint {
  year: number;
  avgPrice: number;
  count: number;
}

interface Competitor {
  brand: string;
  model: string;
  avgPrice: number;
  avgKms: number;
  avgYear: number;
  count: number;
}

interface AnalysisData {
  listingId: number;
  make: string;
  model: string;
  year: number;
  currentPrice: number;
  predictedPrice: number;
  annualKms: number;
  depreciationCurve: DepreciationPoint[];
  priceVsMileage: PriceMileagePoint[];
  priceVsYear: PriceYearPoint[];
  competitors: Competitor[];
}

// Helpers 

const formatAED = (price: number) => `د.إ ${price.toLocaleString()}`;
const formatK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;

// Retention Chart (line style with dots and filled area)

function RetentionChart({ data, depreciationCurve, currentPrice }: {
  data: { label: string; retentionPct: number }[];
  depreciationCurve: DepreciationPoint[];
  currentPrice: number;
}) {
  const prices = [currentPrice, ...depreciationCurve.map(d => d.predictedPrice)];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-5">
        <TrendingDown className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-foreground">Value Retention Over Time</h4>
      </div>

      {/* Chart */}
      <div className="flex gap-3 sm:gap-6 mb-3">
        {data.map((item, i) => {
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
            <div key={i} className="flex-1 flex flex-col items-center">
              {/* Value */}
              <span className="text-xs font-semibold text-foreground mb-1.5">
                {item.retentionPct.toFixed(0)}%
              </span>
              {/* Bar with fixed-height container */}
              <div className="w-full h-32 sm:h-40 flex items-end justify-center">
                <motion.div
                  className={`w-full max-w-14 rounded-t-md ${color}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              {/* Label */}
              <span className="text-xs text-muted-foreground font-medium mt-2">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Price projection row */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/40">
        {prices.map((price, i) => (
          <div key={i} className="text-center">
            <p className="text-xs text-muted-foreground">{data[i]?.label}</p>
            <p className="text-sm font-semibold text-foreground">{formatK(price)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Bar Chart 

function BarChart({ data, title, icon, xLabel, yLabel, color, formatX, formatYVal }: {
  data: { x: string; y: number }[];
  title: string;
  icon: React.ReactNode;
  xLabel: string;
  yLabel: string;
  color: string;
  formatX?: (v: string) => string;
  formatYVal?: (v: number) => string;
}) {
  const maxY = Math.max(...data.map(d => d.y));
  const scrollRef = useRef<HTMLDivElement>(null);
  const needsScroll = data.length > 8;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-semibold text-foreground">{title}</h4>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{xLabel}</span>
          <span>vs</span>
          <span>{yLabel}</span>
        </div>
      </div>

      {/* Chart area scrollable on mobile if many bars */}
      <div
        ref={scrollRef}
        className={`${needsScroll ? "overflow-x-auto scrollbar-hide" : ""}`}
      >
        <div
          className="flex gap-1.5 sm:gap-2"
          style={needsScroll ? { minWidth: `${data.length * 52}px` } : undefined}
        >
          {data.map((item, i) => {
            const pct = maxY === 0 ? 0 : (item.y / maxY) * 100;
            const barH = Math.max(pct, 2);
            const displayY = formatYVal ? formatYVal(item.y) : formatK(item.y);
            const displayX = formatX ? formatX(item.x) : item.x;

            return (
              <div key={i} className="flex-1 flex flex-col items-center min-w-[36px]">
                {/* Value label */}
                <span className="text-[10px] text-muted-foreground mb-1 whitespace-nowrap">
                  {displayY}
                </span>
                {/* Bar wrapper with fixed height */}
                <div className="w-full h-40 flex items-end justify-center">
                  <motion.div
                    className={`w-full max-w-10 ${color} rounded-t-sm`}
                    initial={{ height: 0 }}
                    animate={{ height: `${barH}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                {/* x label */}
                <span className="text-[10px] text-muted-foreground mt-1.5 whitespace-nowrap">
                  {displayX}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {needsScroll && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">Swipe to see more</p>
      )}
    </Card>
  );
}

// Competitor Card 

function CompetitorSection({ data, competitors }: { data: AnalysisData; competitors: Competitor[] }) {
  const allPrices = [data.currentPrice, ...competitors.map(c => c.avgPrice)];
  const maxPrice = Math.max(...allPrices);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-foreground">Competitive Market Analysis</h4>
      </div>

      {competitors.length > 0 ? (
        <div className="space-y-3">
          {/* This car */}
          <div className="p-3.5 rounded-xl bg-primary/8 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {data.make} {data.model}
                </span>
                <Badge className="text-[10px] bg-primary text-primary-foreground">This Car</Badge>
              </div>
              <span className="text-sm font-bold text-primary">{formatAED(data.currentPrice)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(data.currentPrice / maxPrice) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
              <span>AI Predicted: {formatAED(data.predictedPrice)}</span>
              <span>{data.year}</span>
            </div>
          </div>

          {/* Competitors */}
          {competitors.map((comp, i) => (
            <motion.div
              key={i}
              className="p-3.5 rounded-xl bg-muted/30 border border-border/40"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {comp.brand} {comp.model}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-2">
                    {comp.count} listing{comp.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatAED(Math.round(comp.avgPrice))}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-muted-foreground/30 rounded-full"
                  style={{ width: `${(comp.avgPrice / maxPrice) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                <span>~{Math.round(comp.avgKms).toLocaleString()} km</span>
                <span>avg ~{Math.round(comp.avgYear)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">No competitor data available</p>
      )}
    </Card>
  );
}

// Empty State 

const EmptyState = ({ message }: { message: string }) => (
  <Card className="p-5">
    <p className="text-sm text-muted-foreground text-center py-8">{message}</p>
  </Card>
);

//  Loading Skeleton 

function AnalysisSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background">
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center gap-3 sticky top-0 z-10">
        <div className="h-9 w-9 skeleton rounded-lg" />
        <div className="h-5 w-32 skeleton rounded" />
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 pb-safe">
          <div className="h-20 skeleton rounded-xl" />
          <div className="h-56 skeleton rounded-xl" />
          <div className="h-56 skeleton rounded-xl" />
          <div className="h-56 skeleton rounded-xl" />
          <div className="h-48 skeleton rounded-xl" />
        </div>
      </div>
    </div>
  );
}

//  Main Component 

export default function DetailedAnalysis({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiRequest<AnalysisData>(API_ENDPOINTS.cars.analysis(Number(id)));
        setData(result);
      } catch (e) {
        setError('Failed to load analysis data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <AnalysisSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center gap-3 sticky top-0 z-10">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Market Analysis</h1>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">{error || "Analysis not available"}</h3>
            <p className="text-sm text-muted-foreground mb-4">Could not load analysis for this listing.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  //  Prepare depreciation data 
  const depreciationData = [
    { label: "Now", retentionPct: 100 },
    ...data.depreciationCurve.map((d) => ({
      label: `+${d.yearsAhead}yr`,
      retentionPct: d.retentionPct,
    })),
  ];

  //  Bucket mileage into 8 groups 
  const bucketMileage = () => {
    if (data.priceVsMileage.length === 0) return [];
    const kmsValues = data.priceVsMileage.map(p => p.kms);
    const minKms = Math.min(...kmsValues);
    const maxKms = Math.max(...kmsValues);
    const range = maxKms - minKms;
    if (range === 0) return [{ x: `${formatK(minKms)} km`, y: Math.round(data.priceVsMileage.reduce((a, c) => a + c.price, 0) / data.priceVsMileage.length) }];

    // Target apprx 8 buckets, round to nice numbers
    const TARGET_BUCKETS = 8;
    const rawSize = range / TARGET_BUCKETS;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawSize)));
    const bucketSize = Math.ceil(rawSize / magnitude) * magnitude;

    const buckets: Record<number, number[]> = {};
    data.priceVsMileage.forEach(p => {
      const key = Math.floor(p.kms / bucketSize) * bucketSize;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(p.price);
    });

    return Object.entries(buckets)
      .map(([key, prices]) => {
        const start = Number(key);
        return {
          x: `${formatK(start)}`,
          y: Math.round(prices.reduce((a, c) => a + c, 0) / prices.length),
        };
      })
      .sort((a, b) => parseInt(a.x) - parseInt(b.x));
  };

  const mileageBuckets = bucketMileage();

  //  Price vs Year data
  const priceYearData = [...data.priceVsYear]
    .sort((a, b) => a.year - b.year)
    .map(d => ({ x: `${d.year}`, y: d.avgPrice }));

  //  Deal assessment 
  const priceDiff = data.predictedPrice - data.currentPrice;
  const priceDiffPct = ((priceDiff) / data.predictedPrice * 100).toFixed(1);
  const isGoodDeal = priceDiff > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 md:px-6 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Market Analysis</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5 pb-safe">
          {/* Car Info + Deal Summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight">
                    {data.year} {data.make} {data.model}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    ~{data.annualKms.toLocaleString()} km/year estimated usage
                  </p>
                </div>
                <Badge
                  className={`shrink-0 text-xs ${
                    isGoodDeal
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                  }`}
                >
                  {isGoodDeal ? `${priceDiffPct}% below market` : `${Math.abs(Number(priceDiffPct))}% above market`}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/40">
                <div>
                  <p className="text-xs text-muted-foreground">Listed Price</p>
                  <p className="text-lg font-bold text-primary">{formatAED(data.currentPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AI Predicted Value</p>
                  <p className="text-lg font-bold text-foreground">{formatAED(data.predictedPrice)}</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Depreciation Curve */}
          {depreciationData.length > 1 ? (
            <RetentionChart
              data={depreciationData}
              depreciationCurve={data.depreciationCurve}
              currentPrice={data.currentPrice}
            />
          ) : (
            <EmptyState message="No depreciation data available for this model" />
          )}

          {/* Price vs Mileage */}
          {mileageBuckets.length > 0 ? (
            <BarChart
              data={mileageBuckets}
              title="Price vs Mileage"
              icon={<Gauge className="h-4 w-4 text-blue-500" />}
              xLabel="Mileage (km)"
              yLabel="Avg Price"
              color="bg-blue-500"
              formatX={(v) => v}
              formatYVal={(v) => formatK(v)}
            />
          ) : (
            <EmptyState message="No price vs mileage data available for this model" />
          )}

          {/* Price vs Year */}
          {priceYearData.length > 0 ? (
            <BarChart
              data={priceYearData}
              title="Price vs Model Year"
              icon={<Calendar className="h-4 w-4 text-emerald-500" />}
              xLabel="Model Year"
              yLabel="Avg Price"
              color="bg-emerald-500"
              formatX={(v) => `'${v.slice(-2)}`}
              formatYVal={(v) => formatK(v)}
            />
          ) : (
            <EmptyState message="No price vs year data available for this model" />
          )}

          {/* Competitive Market Analysis */}
          <CompetitorSection data={data} competitors={data.competitors} />
        </div>
      </div>
    </div>
  );
}
