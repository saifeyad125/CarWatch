"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Sparkles, Plus, MessageSquare, Clock, X, Menu, Trash2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { API_ENDPOINTS } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
  lastMessage: string | null;
  updatedAt: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export default function ChatPage() {
  const { user, avatarSeed } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(API_ENDPOINTS.chat.conversations, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (convId: number) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(API_ENDPOINTS.chat.conversation(convId), { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveConvId(convId);
        setMessages(data.messages);
        setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const createConversation = async (): Promise<number | null> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(API_ENDPOINTS.chat.conversations, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setActiveConvId(data.id);
        setMessages([]);
        setIsSidebarOpen(false);
        await fetchConversations();
        return data.id;
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
    return null;
  };

  const deleteConversation = async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const headers = await getAuthHeaders();
      await fetch(API_ENDPOINTS.chat.conversation(convId), {
        method: "DELETE",
        headers,
      });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleSendMessage = useCallback(async (overrideMessage?: string) => {
    const content = (overrideMessage ?? inputMessage).trim();
    if (!content || isStreaming) return;

    setInputMessage("");

    // make sure we have a convo
    let convId = activeConvId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Add placeholder bot message
    const botMsgId = Date.now() + 1;
    const botMsg: Message = {
      id: botMsgId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, botMsg]);
    setIsStreaming(true);

    try {
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(API_ENDPOINTS.chat.messages(convId), {
        method: "POST",
        headers,
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let botText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep incomplete last line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: {")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.text) {
                botText += data.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = { ...updated[lastIdx], content: botText };
                  return updated;
                });
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      }

      // Refresh convo list to update titles and last messages
      await fetchConversations();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Stream error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === "assistant" && !updated[lastIdx].content) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: "Sorry, something went wrong. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [inputMessage, isStreaming, activeConvId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = async () => {
    await createConversation();
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m`;
    if (hrs < 24) return `${hrs}h`;
    return `${days}d`;
  };

  const quickPrompts = [
    "Find me a reliable sedan under AED 80k",
    "Best deals available right now?",
    "Set up a Tesla watchlist",
    "Compare Civic vs Corolla",
  ];

  const showWelcome = !activeConvId && messages.length === 0;

  if (!user) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-lg font-semibold tracking-tight">AI Chat</h1>
          <Link href="/login">
            <Button variant="outline" size="sm">
              <LogIn className="h-3.5 w-3.5 mr-1.5" />
              Sign In
            </Button>
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-sm space-y-4"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">Sign in to use AI Chat</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get personalized car recommendations, deal analysis, and market insights from our AI assistant.
            </p>
            <Link href="/login">
              <Button className="mt-2">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In to Chat
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background overflow-hidden relative">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed lg:relative inset-y-0 left-0 w-72 border-r border-border z-50 flex flex-col shadow-elevated"
            style={{ backgroundColor: "hsl(223, 47%, 11%)" }}
          >
            <div className="p-4 border-b border-border/40 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">History</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button className="w-full" size="sm" onClick={handleNewChat}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New Chat
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-2">
              {isLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    className={`w-full p-3 rounded-lg text-left transition-colors group cursor-pointer ${
                      activeConvId === conv.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                    onClick={() => loadConversation(conv.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") loadConversation(conv.id); }}
                  >
                    <div className="flex items-start gap-2.5">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                        )}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {isMounted ? formatRelativeTime(conv.updatedAt) : "now"}
                        </span>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                        onClick={(e) => deleteConversation(conv.id, e)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-border/40 shrink-0">
              <p className="text-[11px] text-muted-foreground text-center">{conversations.length} conversations</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar overlay — click anywhere outside to close */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <header className="shrink-0 h-16 border-b border-border/40 bg-card/80 backdrop-blur-nav px-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">AI Chat</h1>
          </div>
          {user ? (
            <Link href="/profile">
              <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-border hover:ring-primary/30 transition-all duration-150">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} />
                <AvatarFallback className="text-xs font-medium">{(userName || "U")[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="outline" size="sm">
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Sign In
              </Button>
            </Link>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5 pb-safe">
            {/* Welcome state */}
            {showWelcome && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">CarWatch AI</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Your UAE used car market expert. Ask about listings, deals, pricing, or get help with watchlists.
                </p>
              </motion.div>
            )}

            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[85%] ${message.role === "user" ? "order-first" : ""}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}>
                    {message.content || (
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse" />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                        </div>
                        <span className="text-xs text-muted-foreground animate-pulse">Thinking...</span>
                      </div>
                    )}
                  </div>
                  <p className={`text-[11px] text-muted-foreground mt-1 ${message.role === "user" ? "text-right" : ""}`} suppressHydrationWarning>
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick prompts */}
        {(showWelcome || messages.length === 0) && (
          <div className="shrink-0 px-4 pb-2">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Suggestions</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {quickPrompts.map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap text-xs rounded-full"
                    onClick={() => handleSendMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-border/40 bg-card/80 backdrop-blur-nav p-4">
          <div className="max-w-2xl mx-auto flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about cars, deals, or pricing..."
                className="resize-none min-h-0 h-11 py-2.5 pr-12 rounded-xl text-sm"
                rows={1}
                maxLength={500}
              />
              <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground">{inputMessage.length}/500</span>
            </div>
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isStreaming}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
