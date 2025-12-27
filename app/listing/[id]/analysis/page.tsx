"use client"

import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, Wrench, AlertTriangle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { use } from "react";

interface AnalysisData {
  id: number;
  make: string;
  model: string;
  year: number;
  price: string;
  mileage: string;
  priceVsMiles: Array<{
    mileage: number;
    price: number;
  }>;
  priceVsYear: Array<{
    year: number;
    price: number;
  }>;
  reliabilityCosts: Array<{
    year: number;
    maintenanceCost: number;
    repairCost: number;
  }>;
  marketComparison: Array<{
    make: string;
    model: string;
    price: number;
    mileage: number;
    year: number;
  }>;
  depreciationCurve: Array<{
    age: number;
    retentionPercentage: number;
  }>;
}

// Mock data generator
const getAnalysisData = (id: string): AnalysisData => {
  const baseData: Record<string, AnalysisData> = {
    "1": {
      id: 1,
      make: "Toyota",
      model: "Camry",
      year: 2022,
      price: "$24,500",
      mileage: "15,000 mi",
      priceVsMiles: [
        { mileage: 5000, price: 28000 },
        { mileage: 10000, price: 26500 },
        { mileage: 15000, price: 24500 },
        { mileage: 20000, price: 23000 },
        { mileage: 25000, price: 21500 },
        { mileage: 30000, price: 20000 },
        { mileage: 35000, price: 18500 },
        { mileage: 40000, price: 17000 }
      ],
      priceVsYear: [
        { year: 2024, price: 32000 },
        { year: 2023, price: 28500 },
        { year: 2022, price: 24500 },
        { year: 2021, price: 22000 },
        { year: 2020, price: 19500 },
        { year: 2019, price: 17000 },
        { year: 2018, price: 15000 }
      ],
      reliabilityCosts: [
        { year: 1, maintenanceCost: 400, repairCost: 150 },
        { year: 2, maintenanceCost: 450, repairCost: 200 },
        { year: 3, maintenanceCost: 500, repairCost: 300 },
        { year: 4, maintenanceCost: 600, repairCost: 450 },
        { year: 5, maintenanceCost: 700, repairCost: 600 },
        { year: 6, maintenanceCost: 850, repairCost: 800 },
        { year: 7, maintenanceCost: 1000, repairCost: 1100 }
      ],
      marketComparison: [
        { make: "Honda", model: "Accord", price: 26000, mileage: 14000, year: 2022 },
        { make: "Nissan", model: "Altima", price: 22000, mileage: 16000, year: 2022 },
        { make: "Toyota", model: "Camry", price: 25200, mileage: 12000, year: 2022 },
        { make: "Mazda", model: "Mazda6", price: 23500, mileage: 18000, year: 2022 },
        { make: "Hyundai", model: "Sonata", price: 21500, mileage: 20000, year: 2022 }
      ],
      depreciationCurve: [
        { age: 0, retentionPercentage: 100 },
        { age: 1, retentionPercentage: 85 },
        { age: 2, retentionPercentage: 72 },
        { age: 3, retentionPercentage: 62 },
        { age: 4, retentionPercentage: 54 },
        { age: 5, retentionPercentage: 47 },
        { age: 6, retentionPercentage: 41 },
        { age: 7, retentionPercentage: 36 },
        { age: 8, retentionPercentage: 32 }
      ]
    }
    // Add other cars with similar data structure
  };

  return baseData[id] || baseData["1"];
};

const SimpleChart = ({ 
  data, 
  xKey, 
  yKey, 
  title, 
  xLabel, 
  yLabel, 
  color = "bg-primary" 
}: {
  data: any[];
  xKey: string;
  yKey: string;
  title: string;
  xLabel: string;
  yLabel: string;
  color?: string;
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
            const height = ((item[yKey] - minY) / (maxY - minY)) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="text-xs text-muted-foreground mb-1">
                  {typeof item[yKey] === 'number' && item[yKey] > 1000 
                    ? `$${(item[yKey] / 1000).toFixed(0)}k`
                    : item[yKey]
                  }
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

export default function DetailedAnalysis({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const data = getAnalysisData(id);

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
          <div className="w-10" /> {/* Spacer */}
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
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>Current Price: <span className="font-semibold text-primary">{data.price}</span></span>
              <span>Mileage: {data.mileage}</span>
            </div>
          </Card>

          {/* Price vs Mileage */}
          <SimpleChart
            data={data.priceVsMiles}
            xKey="mileage"
            yKey="price"
            title="Price vs Mileage Analysis"
            xLabel="Mileage (miles)"
            yLabel="Price ($)"
            color="bg-blue-500"
          />

          {/* Price vs Year */}
          <SimpleChart
            data={data.priceVsYear}
            xKey="year"
            yKey="price"
            title="Price vs Model Year"
            xLabel="Model Year"
            yLabel="Market Value ($)"
            color="bg-green-500"
          />

          {/* Reliability Costs */}
          <Card className="p-5 bg-card/50 backdrop-blur-sm">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Annual Ownership Costs
            </h4>
            
            <div className="h-48 relative mb-4">
              <div className="flex items-end h-full gap-2 px-2">
                {data.reliabilityCosts.map((item, index) => {
                  const maxCost = Math.max(...data.reliabilityCosts.map(i => i.maintenanceCost + i.repairCost));
                  const totalHeight = ((item.maintenanceCost + item.repairCost) / maxCost) * 100;
                  const maintenanceHeight = (item.maintenanceCost / maxCost) * 100;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="text-xs text-muted-foreground mb-1">
                        ${(item.maintenanceCost + item.repairCost)}
                      </div>
                      <div className="w-full relative">
                        <div 
                          className="w-full bg-orange-500 rounded-t-sm"
                          style={{ height: `${Math.max(totalHeight, 5)}%` }}
                        />
                        <div 
                          className="w-full bg-blue-500 absolute bottom-0 rounded-b-sm"
                          style={{ height: `${Math.max(maintenanceHeight, 2)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Year {item.year}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Maintenance</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>Repairs</span>
              </div>
            </div>
          </Card>

          {/* Depreciation Curve */}
          <SimpleChart
            data={data.depreciationCurve}
            xKey="age"
            yKey="retentionPercentage"
            title="Value Retention Over Time"
            xLabel="Age (years)"
            yLabel="Value Retention (%)"
            color="bg-red-500"
          />

          {/* Market Comparison */}
          <Card className="p-5 bg-card/50 backdrop-blur-sm">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Competitive Market Analysis
            </h4>
            
            <div className="space-y-3">
              {data.marketComparison.map((car, index) => {
                const isCurrentCar = car.make === data.make && car.model === data.model;
                const priceDiff = car.price - parseInt(data.price.replace(/[$,]/g, ''));
                
                return (
                  <div key={index} className={`p-3 rounded-lg ${isCurrentCar ? 'bg-primary/10 border border-primary/20' : 'bg-background/50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {car.year} {car.make} {car.model}
                          {isCurrentCar && <Badge variant="default" className="text-xs">This Car</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {car.mileage.toLocaleString()} miles
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          ${car.price.toLocaleString()}
                        </div>
                        {!isCurrentCar && (
                          <div className={`text-xs ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {priceDiff > 0 ? '+' : ''}${priceDiff.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Key Insights */}
          <Card className="p-5 bg-card/50 backdrop-blur-sm">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Key Insights
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium text-green-800 dark:text-green-300">Good Value Position</div>
                  <div className="text-sm text-green-700 dark:text-green-400">
                    This car is priced below market average for its mileage and year.
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-800 dark:text-blue-300">Optimal Buying Season</div>
                  <div className="text-sm text-blue-700 dark:text-blue-400">
                    Demand is typically lower in winter months (Nov-Feb), offering better negotiation opportunities.
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <div className="font-medium text-orange-800 dark:text-orange-300">Expected Annual Costs</div>
                  <div className="text-sm text-orange-700 dark:text-orange-400">
                    Budget approximately $550-650 annually for maintenance and repairs in year 2-3.
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
