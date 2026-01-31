import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bot, Send, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

export default function NewCoursePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      role: "assistant",
      content: "What topic do you want to learn about? Be as specific or broad as you like.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createCourseMutation = useMutation({
    mutationFn: async (topic: string) => {
      setIsGenerating(true);
      const response = await apiRequest("POST", "/api/courses/generate", { topic });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Great! I've created "${data.title}" for you with ${data.totalLessons} lessons. Let's start learning!`,
        },
      ]);
      setTimeout(() => {
        navigate(`/course/${data.id}`);
      }, 1500);
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({ 
        title: "Failed to generate course", 
        description: "Please try again.",
        variant: "destructive" 
      });
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I had trouble creating your course. Could you try describing the topic again?",
        },
      ]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    if (messages.length === 1) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Perfect! Let me create a personalized course for you...",
        },
      ]);
      createCourseMutation.mutate(userMessage.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="font-semibold" data-testid="text-page-title">Create Course</h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4" data-testid="messages-container">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <Card
                className={`px-4 py-3 max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : ""
                }`}
                data-testid={`message-${message.id}`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </Card>
            </div>
          ))}
          {isGenerating && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <Card className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating your personalized course...</span>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="resize-none min-h-[52px] max-h-32 flex-1"
            disabled={isGenerating}
            data-testid="input-message"
          />
          <Button
            type="submit"
            size="icon"
            className="h-[52px] w-[52px] rounded-md flex-shrink-0"
            disabled={!input.trim() || isGenerating}
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
