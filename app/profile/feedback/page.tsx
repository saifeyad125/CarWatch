"use client";

import React, { useState } from "react";
import { ArrowLeft, Mail, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export default function FeedbackPage() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = () => {
    if (rating === 0) {
      alert("Please select a rating");
      return;
    }
    if (feedback.trim() === "") {
      alert("Please enter your feedback");
      return;
    }
    
    alert("Thank you for your feedback! We'll review it and get back to you soon.");
    router.back();
  };

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
          <h1 className="text-lg font-semibold text-foreground">Send Feedback</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 py-6 space-y-6 pb-safe">
          {/* Header Card */}
          <Card className="p-5 bg-gradient-to-r from-cyan-50 to-cyan-100/50 backdrop-blur-sm rounded-2xl border border-cyan-200 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center shadow-md">
                <MessageSquare className="h-6 w-6 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">We'd love to hear from you!</h2>
                <p className="text-sm text-cyan-700">Your feedback helps us improve</p>
              </div>
            </div>
          </Card>

          {/* Rating Section */}
          <Card className="p-5 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <h3 className="font-semibold text-foreground mb-3">How would you rate your experience?</h3>
            <div className="flex gap-2 justify-center py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= rating
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {rating === 5 && "Excellent! ⭐"}
                {rating === 4 && "Great! 👍"}
                {rating === 3 && "Good 👌"}
                {rating === 2 && "Could be better 😕"}
                {rating === 1 && "Needs improvement 😞"}
              </p>
            )}
          </Card>

          {/* Feedback Form */}
          <Card className="p-5 border-0 bg-card/50 backdrop-blur-sm rounded-2xl shadow-lg">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Your Feedback
                </label>
                <Textarea
                  placeholder="Tell us what you think about DealWatch... What do you like? What can we improve?"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-32 resize-none rounded-xl"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {feedback.length}/500 characters
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Email (optional)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  We'll only use this to follow up on your feedback
                </p>
              </div>
            </div>
          </Card>

          {/* Submit Button */}
          <Button 
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
            onClick={handleSubmit}
            disabled={rating === 0 || feedback.trim() === ""}
          >
            Submit Feedback
          </Button>

          {/* Alternative Contact */}
          <Card className="p-4 border-0 bg-card/50 backdrop-blur-sm rounded-2xl">
            <p className="text-sm text-muted-foreground text-center">
              Prefer email? Contact us at{" "}
              <a href="mailto:support@dealwatch.com" className="text-cyan-600 font-medium hover:underline">
                support@dealwatch.com
              </a>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
