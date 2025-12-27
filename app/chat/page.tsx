"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Trash2, Menu, Plus, MessageSquare, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: number;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
}

interface ChatHistory {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "Hi! I'm your DealWatch AI assistant. I can help you find the perfect car deals, set up watchlists, and answer questions about vehicle pricing and features. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mock chat history
  const [chatHistory] = useState<ChatHistory[]>([
    {
      id: "1",
      title: "Tesla Model 3 Search",
      lastMessage: "Help me set up a Tesla Model 3 watchlist",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    },
    {
      id: "2",
      title: "Family Sedan Recommendations",
      lastMessage: "Find me a reliable family sedan under $30k",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
      id: "3",
      title: "Honda Civic vs Toyota Corolla",
      lastMessage: "Compare Honda Civic vs Toyota Corolla",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
    {
      id: "4",
      title: "Used Car Buying Tips",
      lastMessage: "What's the best time to buy a used car?",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    },
    {
      id: "5",
      title: "Truck Resale Value",
      lastMessage: "Show me trucks with good resale value",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    },
  ]);

  const formatRelativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const botResponses = [
        "I'd be happy to help you with that! Based on your requirements, I can suggest some great options. What's your budget range?",
        "That's a great choice! The Toyota Camry is known for its reliability. I can set up a watchlist for 2020-2023 models in your area if you'd like.",
        "Let me check the current market prices for that model. Based on recent listings, you can expect to pay between $25,000-$30,000 for a good condition vehicle.",
        "I can help you create a custom search alert for that. What specific features are most important to you - fuel efficiency, safety ratings, or something else?",
        "Great question! I'd recommend looking at certified pre-owned vehicles for the best balance of value and reliability. Would you like me to add that to your watchlist criteria?",
      ];
      
      const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
      
      const botMessage: Message = {
        id: messages.length + 2,
        type: "bot",
        content: randomResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        type: "bot",
        content: "Hi! I'm your DealWatch AI assistant. I can help you find the perfect car deals, set up watchlists, and answer questions about vehicle pricing and features. What would you like to know?",
        timestamp: new Date(),
      },
    ]);
  };

  const quickPrompts = [
    "Find me a reliable family sedan under $30k",
    "What's the best time to buy a used car?",
    "Help me set up a Tesla Model 3 watchlist",
    "Compare Honda Civic vs Toyota Corolla",
    "Show me trucks with good resale value",
  ];

  return (
    <div className="flex h-full bg-background overflow-hidden relative">
      {/* Sidebar */}
      <div className={`fixed lg:relative inset-y-0 left-0 w-72 bg-[hsl(var(--background))] border-r border-border z-50 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } flex flex-col shadow-2xl`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border shrink-0 bg-[hsl(var(--background))]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Chat History</h2>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button 
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl"
            onClick={() => {
              clearChat();
              setIsSidebarOpen(false);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-2 bg-[hsl(var(--background))]">
          <div className="space-y-1">
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                className="w-full p-3 rounded-xl text-left hover:bg-muted/50 transition-colors group"
                onClick={() => setIsSidebarOpen(false)}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {chat.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {chat.lastMessage}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(chat.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border shrink-0 bg-[hsl(var(--background))]">
          <p className="text-xs text-muted-foreground text-center">
            {chatHistory.length} previous conversations
          </p>
        </div>
      </div>

      {/* Sidebar Overlay - Only covers the chat area */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 left-72 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Transparent Header with Blur */}
        <div className="shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/20 px-4 py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-red-50 hover:text-red-600 rounded-xl"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="relative">
                <Avatar className="h-10 w-10 bg-gradient-to-r from-red-500 to-red-600">
                  <AvatarFallback>
                    <Bot className="h-6 w-6 text-white" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">AI Assistant</h1>
                <p className="text-xs text-muted-foreground">Online • Ready to help</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={clearChat} className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages - Scrollable content with top padding */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="px-4 pt-6 space-y-4 pb-safe">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 animate-fade-in ${message.type === "user" ? "justify-end" : ""}`}>
                {message.type === "bot" && (
                  <Avatar className="h-8 w-8 bg-gradient-to-r from-red-500 to-red-600 shrink-0 mt-1">
                    <AvatarFallback>
                      <Bot className="h-5 w-5 text-white" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`max-w-[85%] ${message.type === "user" ? "order-first" : ""}`}>
                  <Card className={`p-4 ${message.type === "user" 
                    ? "bg-gradient-to-r from-red-500 to-red-600 text-white ml-auto rounded-2xl rounded-br-md shadow-lg" 
                    : "bg-muted/50 backdrop-blur-sm rounded-2xl rounded-bl-md"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </Card>
                  <p className={`text-xs text-muted-foreground mt-1 ${message.type === "user" ? "text-right" : ""}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                {message.type === "user" && (
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 animate-fade-in">
                <Avatar className="h-8 w-8 bg-gradient-to-r from-red-500 to-red-600 shrink-0 mt-1">
                  <AvatarFallback>
                    <Bot className="h-5 w-5 text-white" />
                  </AvatarFallback>
                </Avatar>
                <Card className="p-4 bg-muted/50 backdrop-blur-sm rounded-2xl rounded-bl-md">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick Prompts */}
        {messages.length === 1 && (
          <div className="shrink-0 px-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Quick prompts</span>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {quickPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap text-xs rounded-full bg-muted/50 backdrop-blur-sm border-cyan-500/40 text-cyan-600 hover:bg-cyan-500 hover:text-white transition-all duration-200 active:scale-95"
                  onClick={() => setInputMessage(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Section - Fixed at bottom */}
        <div className="shrink-0 border-t border-border/20 bg-card/80 backdrop-blur-xl p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about cars, deals, or pricing..."
                className="resize-none min-h-0 h-12 py-3 pr-12 rounded-2xl border-border/50 bg-background/50 backdrop-blur-sm focus:bg-background transition-all duration-200"
                rows={1}
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                {inputMessage.length}/500
              </div>
            </div>
            <Button 
              onClick={handleSendMessage} 
              disabled={!inputMessage.trim() || isTyping}
              size="icon"
              className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
