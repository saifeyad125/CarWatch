"use client";

import React from "react";
import { ArrowLeft, Car, Code, Heart, Shield, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

export default function AboutPage() {
  const router = useRouter();

  const features = [
    {
      icon: Zap,
      title: "AI-Powered Predictions",
      description: "Two-stage CatBoost ML model analyzes market data to predict accurate car values across the UAE"
    },
    {
      icon: Shield,
      title: "Multi-Source Data",
      description: "Listings scraped hourly from Dubizzle and DubiCars for comprehensive market coverage"
    },
    {
      icon: Users,
      title: "Smart Watchlists",
      description: "Set your criteria and get automatically matched when new deals appear below market value"
    }
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">About CarWatch</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-safe">
          {/* Hero Card */}
          <Card className="p-6 overflow-hidden relative">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/[0.05] blur-2xl pointer-events-none" />
            <div className="relative text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                <Car className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-1">CarWatch</h2>
              <p className="text-sm text-muted-foreground mb-3">UAE Car Price Intelligence</p>
              <Badge variant="secondary" className="text-xs">
                Version 1.0.0
              </Badge>
            </div>
          </Card>

          {/* Mission Statement */}
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Our Mission
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              CarWatch was built to empower UAE car buyers with AI-driven insights and real-time market intelligence.
              We help you find your dream car at the right price, with transparent data on whether a deal is
              genuinely good or overpriced.
            </p>
          </Card>

          {/* Features */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">What Makes Us Different</h3>
            {features.map((feature, index) => (
              <Card key={index} className="p-4">
                <CardContent className="p-0 flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-0.5">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tech Stack */}
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Code className="h-4 w-4 text-primary" />
              Built With
            </h3>
            <div className="flex flex-wrap gap-2">
              {["Next.js", "React", "TypeScript", "Tailwind CSS", "FastAPI", "CatBoost ML", "PostgreSQL"].map((tech) => (
                <Badge key={tech} variant="secondary" className="text-xs">
                  {tech}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Credits */}
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              Made with <Heart className="inline h-3.5 w-3.5 text-red-500 fill-red-500" /> for car enthusiasts
            </p>
            <p className="text-xs text-muted-foreground">&copy; 2025 CarWatch. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
