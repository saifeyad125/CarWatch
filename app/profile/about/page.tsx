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
      description: "Advanced machine learning algorithms analyze market data to predict accurate car values"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is encrypted and protected with industry-leading security standards"
    },
    {
      icon: Users,
      title: "Community Driven",
      description: "Built with feedback from thousands of car buyers and enthusiasts"
    }
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">About CarWatch</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Hero Card */}
          <Card className="p-6 bg-gradient-to-r from-red-50 to-red-100/50 backdrop-blur-sm rounded-2xl border border-red-200 shadow-lg">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Car className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">CarWatch</h2>
              <Badge variant="secondary" className="mb-3 bg-red-100 text-red-700 border-red-200">
                Version 1.0.0
              </Badge>
              <p className="text-muted-foreground leading-relaxed">
                Your intelligent companion for finding the perfect car deal
              </p>
            </div>
          </Card>

          {/* Mission Statement */}
          <Card className="p-5 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Our Mission
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              CarWatch was created to empower car buyers with AI-driven insights and real-time market intelligence. 
              We believe everyone deserves to find their dream car at the right price, without the stress and uncertainty 
              of traditional car shopping.
            </p>
          </Card>

          {/* Features */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground px-1">What Makes Us Different</h3>
            {features.map((feature, index) => (
              <Card key={index} className="p-5 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-0 flex gap-4">
                  <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center shrink-0">
                    <feature.icon className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tech Stack */}
          <Card className="p-5 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Code className="h-5 w-5 text-cyan-600" />
              Built With
            </h3>
            <div className="flex flex-wrap gap-2">
              {["Next.js", "React", "TypeScript", "Tailwind CSS", "AI/ML", "Real-time APIs"].map((tech) => (
                <Badge key={tech} variant="outline" className="px-3 py-1 border-cyan-500/40 text-cyan-600">
                  {tech}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Credits */}
          <Card className="p-5 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Made with <Heart className="inline h-4 w-4 text-red-500 fill-red-500" /> for car enthusiasts
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>© 2024 CarWatch. All rights reserved.</p>
              <div className="flex justify-center gap-4">
                <a href="#" className="text-cyan-600 hover:underline">Privacy Policy</a>
                <a href="#" className="text-cyan-600 hover:underline">Terms of Service</a>
                <a href="#" className="text-cyan-600 hover:underline">Licenses</a>
              </div>
            </div>
          </Card>

          {/* Version Info */}
          <Card className="p-4 border-0 bg-muted/30 rounded-2xl">
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Build: 2024.11.29</p>
              <p>Last Updated: November 29, 2024</p>
              <p>Environment: Production</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
