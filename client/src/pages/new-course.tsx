import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bot, Send, Loader2, Hammer, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  outline?: CourseOutline;
}

interface CourseOutline {
  title: string;
  description: string;
  sessions: Array<{
    title: string;
    subtitle: string;
    sessionNumber: number;
  }>;
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
  const [isBuilding, setIsBuilding] = useState(false);
  const [currentOutline, setCurrentOutline] = useState<CourseOutline | null>(null);
  const [originalTopic, setOriginalTopic] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const previewMutation = useMutation({
    mutationFn: async ({ topic, feedback, previousOutline }: { topic: string; feedback?: string; previousOutline?: CourseOutline }) => {
      setIsGenerating(true);
      const response = await apiRequest("POST", "/api/courses/preview", { topic, feedback, previousOutline });
      return response.json();
    },
    onSuccess: (data: CourseOutline) => {
      setCurrentOutline(data);
      setIsGenerating(false);
      
      const outlinePreview = `Here's what I'm thinking for your course:\n\n**${data.title}**\n${data.description}\n\n**Topics:**\n${data.sessions.map((s, i) => `${i + 1}. ${s.title} - ${s.subtitle}`).join('\n')}\n\nLook good? You can ask me to adjust the topics, add or remove sessions, or change the focus. When you're happy, click "Build Course" to create it.`;
      
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: outlinePreview,
          outline: data,
        },
      ]);
    },
    onError: () => {
      setIsGenerating(false);
      toast({ 
        title: "Failed to generate preview", 
        description: "Please try again.",
        variant: "destructive" 
      });
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I had trouble creating a preview. Could you try describing the topic again?",
        },
      ]);
    },
  });

  const buildMutation = useMutation({
    mutationFn: async (outline: CourseOutline) => {
      setIsBuilding(true);
      const response = await apiRequest("POST", "/api/courses/build", { outline });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Building "${data.title}" with ${data.totalLessons} lessons. Redirecting you now...`,
        },
      ]);
      setTimeout(() => {
        navigate(`/course/${data.id}`);
      }, 1500);
    },
    onError: () => {
      setIsBuilding(false);
      toast({ 
        title: "Failed to build course", 
        description: "Please try again.",
        variant: "destructive" 
      });
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I had trouble building the course. Want to try again?",
        },
      ]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || isBuilding) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input.trim();
    setInput("");

    if (!currentOutline) {
      // First message - generate initial preview
      setOriginalTopic(userInput);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Let me put together a course outline for you...",
        },
      ]);
      previewMutation.mutate({ topic: userInput });
    } else {
      // Feedback on existing outline - regenerate with feedback
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Got it! Let me revise the outline...",
        },
      ]);
      previewMutation.mutate({ 
        topic: originalTopic, 
        feedback: userInput, 
        previousOutline: currentOutline 
      });
    }
  };

  const handleBuild = () => {
    if (!currentOutline || isBuilding) return;
    
    setMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: "Build this course!",
      },
    ]);
    
    buildMutation.mutate(currentOutline);
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
                className={`px-4 py-3 max-w-[85%] ${
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
                  <span>Creating your course outline...</span>
                </div>
              </Card>
            </div>
          )}
          {isBuilding && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <Card className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Building your course and generating lesson content...</span>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {currentOutline && !isBuilding && (
          <div className="flex gap-2 mb-4">
            <Button
              onClick={handleBuild}
              disabled={isGenerating || isBuilding}
              className="flex-1"
              data-testid="button-build-course"
            >
              <Hammer className="w-4 h-4 mr-2" />
              Build Course
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentOutline ? "Request changes to the outline..." : "Type your message..."}
            className="resize-none min-h-[52px] max-h-32 flex-1"
            disabled={isGenerating || isBuilding}
            data-testid="input-message"
          />
          <Button
            type="submit"
            size="icon"
            className="h-[52px] w-[52px] rounded-md flex-shrink-0"
            disabled={!input.trim() || isGenerating || isBuilding}
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
