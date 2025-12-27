"use client";

import React, { useState } from "react";
import { ArrowLeft, HelpCircle, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    id: 1,
    question: "How do I create a watchlist?",
    answer: "To create a watchlist, go to the Watchlist tab and tap the '+' button. Fill in your preferences including make, model, year range, price range, and location. Once saved, you'll receive alerts when matching cars are found.",
    category: "Watchlists"
  },
  {
    id: 2,
    question: "How accurate are the AI price predictions?",
    answer: "Our AI analyzes millions of data points including historical prices, market trends, location, mileage, and condition to provide price predictions with 85-90% accuracy. Predictions are updated daily based on current market conditions.",
    category: "Pricing"
  },
  {
    id: 3,
    question: "What does the 'Good Deal' badge mean?",
    answer: "A 'Good Deal' badge appears when a car is priced below our AI's predicted market value. This indicates the listing may offer better value compared to similar vehicles in the area.",
    category: "Features"
  },
  {
    id: 4,
    question: "How many watchlists can I have?",
    answer: "Free trial accounts can have up to 2 active watchlists. Premium members get unlimited watchlists with additional features like advanced filtering and priority notifications.",
    category: "Account"
  },
  {
    id: 5,
    question: "How often are listings updated?",
    answer: "Our database is updated every hour with new listings from thousands of sources. Watchlist alerts are sent in real-time when new matches are found.",
    category: "Updates"
  },
  {
    id: 6,
    question: "Can I save favorite cars?",
    answer: "Yes! Tap the heart icon on any car listing to save it to your favorites. You can access all your saved cars from the Favorites section on the home page.",
    category: "Features"
  }
];

export default function HelpPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredFAQs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 hover:bg-cyan-50 hover:text-cyan-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Help Center</h1>
          <div className="w-10" />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-2xl border-border/50 bg-background/50 backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Header Card */}
          <Card className="p-5 bg-gradient-to-r from-cyan-50 to-cyan-100/50 backdrop-blur-sm rounded-2xl border border-cyan-200 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center shadow-md">
                <HelpCircle className="h-6 w-6 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">How can we help?</h2>
                <p className="text-sm text-cyan-700">Find answers to common questions</p>
              </div>
            </div>
          </Card>

          {/* FAQs */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground px-1">
              Frequently Asked Questions
            </h3>
            
            {filteredFAQs.map((faq) => (
              <Card
                key={faq.id}
                className="overflow-hidden border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <CardContent className="p-0">
                  <Button
                    variant="ghost"
                    className="w-full p-5 h-auto text-left rounded-none hover:bg-muted/50"
                    onClick={() => toggleExpand(faq.id)}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground pr-4">{faq.question}</h4>
                        {expandedId === faq.id ? (
                          <ChevronUp className="h-5 w-5 text-primary shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-cyan-600 font-medium px-2 py-1 bg-cyan-100 rounded-full inline-block">
                        {faq.category}
                      </span>
                    </div>
                  </Button>
                  
                  {expandedId === faq.id && (
                    <div className="px-5 pb-5 pt-0">
                      <p className="text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No Results */}
          {filteredFAQs.length === 0 && (
            <div className="text-center py-12">
              <HelpCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
              <p className="text-muted-foreground mb-4">
                Try different keywords or contact support
              </p>
            </div>
          )}

          {/* Contact Support Card */}
          <Card className="p-5 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <h3 className="font-semibold text-foreground mb-3">Still need help?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <Button 
              className="w-full rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
              onClick={() => router.push('/profile/feedback')}
            >
              Contact Support
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
