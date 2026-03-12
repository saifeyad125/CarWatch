"use client"

import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { API_ENDPOINTS, apiRequest } from "@/lib/api";

// --- TypeScript Interfaces ---

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

// --- Helpers ---

const formatAED = (price: number) => `د.إ ${price.toLocaleString()}`;

// --- SimpleChart Component ---

const SimpleChart = ({
  data,
  xKey,
  yKey,
  title,
  xLabel,
  yLabel,
  color = "bg-primary",
  formatY,
}: {
  data: any[];
  xKey: string;
  yKey: string;
  title: string;
  xLabel: string;
  yLabel: string;
  color?: string;
  formatY?: (v: number) => string;
}) => {
  const maxY = Math.max(...data.map(item => item[yKey]));
  const minY = Math.min(...data.map(item => item[yKey]));

  return (
    <Card className="p-5 bg-card/50 backdrop-blur-sm">
      <h4 className="font-semibold text-foreground mb-4">{title}</h4>

      {/* Chart area */}
      <div className="h-48 relative mb-4">
        <div className="flex items-end h-full gap-2 px-2">
          {data.map((item, index) => {
            const range = maxY - minY;
            const height = range === 0 ? 100 : ((item[yKey] - minY) / range) * 100;
            const yVal = item[yKey];
            const displayY = formatY
              ? formatY(yVal)
              : typeof yVal === 'number' && yVal > 1000
                ? `${(yVal / 1000).toFixed(0)}k`
                : `${yVal}`;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="text-xs text-muted-foreground mb-1">
                  {displayY}
                </div>
                <div
                  className={`w-full ${color} rounded-t-sm transition-all duration-300`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                />
                <div className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-left">
                  {item[xKey]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{xLabel}</span>
        <span>{yLabel}</span>
      </div>
    </Card>
  );
};

// --- Empty State ---

const EmptyState = ({ message }: { message: string }) => (
  <Card className="p-5 bg-card/50 backdrop-blur-sm">
    <p className="text-sm text-muted-foreground text-center py-8">{message}</p>
  </Card>
);

// --- Loading Skeleton ---

function AnalysisSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 skeleton rounded-lg" />
          <div className="h-6 w-32 skeleton rounded" />
          <div className="w-10" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          <div className="h-24 skeleton rounded-xl" />
          <div className="h-64 skeleton rounded-xl" />
          <div className="h-64 skeleton rounded-xl" />
          <div className="h-64 skeleton rounded-xl" />
          <div className="h-48 skeleton rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

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
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Market Analysis</h1>
            <div className="w-10" />
          </div>
        </div>
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

  // --- Prepare depreciation chart data ---
  const depreciationData = [
    { label: "Now", retentionPct: 100 },
    ...data.depreciationCurve.map((d) => ({
      label: `+${d.yearsAhead}yr`,
      retentionPct: d.retentionPct,
    })),
  ];

  // --- Bucket price vs mileage data ---
  const BUCKET_SIZE = 20000;
  const bucketedMileage = data.priceVsMileage.length > 0
    ? Object.values(
        data.priceVsMileage.reduce((acc, p) => {
          const bucket = Math.floor(p.kms / BUCKET_SIZE) * BUCKET_SIZE;
          const key = `${bucket}`;
          if (!acc[key]) acc[key] = { label: `${bucket / 1000}-${(bucket + BUCKET_SIZE) / 1000}k`, prices: [] as number[] };
          acc[key].prices.push(p.price);
          return acc;
        }, {} as Record<string, { label: string; prices: number[] }>)
      )
        .map(b => ({ label: b.label, avgPrice: Math.round(b.prices.reduce((a, c) => a + c, 0) / b.prices.length) }))
        .sort((a, b) => parseInt(a.label) - parseInt(b.label))
    : [];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Market Analysis</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Car Info Header */}
          <Card className="p-4 bg-card/50 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-foreground">
              {data.year} {data.make} {data.model}
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>Current Price: <span className="font-semibold text-primary">{formatAED(data.currentPrice)}</span></span>
              <span>AI Predicted: <span className="font-semibold text-foreground">{formatAED(data.predictedPrice)}</span></span>
            </div>
          </Card>

          {/* 1. Depreciation Curve */}
          {depreciationData.length > 1 ? (
            <SimpleChart
              data={depreciationData}
              xKey="label"
              yKey="retentionPct"
              title="Value Retention Over Time"
              xLabel="Time"
              yLabel="Retention (%)"
              color="bg-red-500"
              formatY={(v) => `${v}%`}
            />
          ) : (
            <EmptyState message="No depreciation data available for this model" />
          )}

          {/* 2. Price vs Mileage (bucketed) */}
          {bucketedMileage.length > 0 ? (
            <SimpleChart
              data={bucketedMileage}
              xKey="label"
              yKey="avgPrice"
              title="Price vs Mileage Analysis"
              xLabel="Mileage (km)"
              yLabel="Avg Price (AED)"
              color="bg-blue-500"
            />
          ) : (
            <EmptyState message="No price vs mileage data available for this model" />
          )}

          {/* 3. Price vs Year */}
          {data.priceVsYear.length > 0 ? (
            <SimpleChart
              data={data.priceVsYear}
              xKey="year"
              yKey="avgPrice"
              title="Price vs Model Year"
              xLabel="Model Year"
              yLabel="Avg Price (AED)"
              color="bg-green-500"
            />
          ) : (
            <EmptyState message="No price vs year data available for this model" />
          )}

          {/* 4. Competitive Market Analysis */}
          <Card className="p-5 bg-card/50 backdrop-blur-sm">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Competitive Market Analysis
            </h4>

            {data.competitors.length > 0 ? (
              <div className="space-y-3">
                {/* Current car at the top */}
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {data.year} {data.make} {data.model}
                        <Badge variant="default" className="text-xs">This Car</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Listed at {formatAED(data.currentPrice)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-foreground">
                        {formatAED(data.predictedPrice)}
                      </div>
                      <div className="text-xs text-muted-foreground">AI Predicted</div>
                    </div>
                  </div>
                </div>

                {/* Competitors */}
                {data.competitors.map((comp, index) => (
                  <div key={index} className="p-3 rounded-lg bg-background/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">
                          {comp.brand} {comp.model}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ~{Math.round(comp.avgKms).toLocaleString()} km &middot; {comp.count} listing{comp.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          {formatAED(Math.round(comp.avgPrice))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          avg ~{Math.round(comp.avgYear)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No competitor data available for this model</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
