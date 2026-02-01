import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bot, Send, Loader2, Hammer } from "lucide-react";
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
  const [conversationHistory, setConversationHistory] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const previewMutation = useMutation({
    mutationFn: async ({ topic, feedback, previousOutline, conversationHistory }: { 
      topic: string; 
      feedback?: string; 
      previousOutline?: CourseOutline;
      conversationHistory?: string;
    }) => {
      setIsGenerating(true);
      const response = await apiRequest("POST", "/api/courses/preview", { 
        topic, 
        feedback, 
        previousOutline,
        conversationHistory
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      
      if (data.type === "question") {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.question,
          },
        ]);
        setConversationHistory(prev => 
          prev + `\nAssistant: ${data.question}`
        );
      } else {
        setCurrentOutline(data);
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            outline: data,
          },
        ]);
      }
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
          content: "Sorry, I had trouble processing that. Could you try describing the topic again?",
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
          content: `Your course "${data.title}" is ready! Redirecting you now...`,
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
      if (!originalTopic) {
        setOriginalTopic(userInput);
      }
      
      const updatedHistory = conversationHistory + `\nUser: ${userInput}`;
      setConversationHistory(updatedHistory);

      previewMutation.mutate({ 
        topic: originalTopic || userInput, 
        conversationHistory: updatedHistory 
      });
    } else {
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
              {message.outline ? (
                <Card className="px-4 py-4 max-w-[90%]" data-testid={`message-${message.id}`}>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg text-primary">{message.outline.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{message.outline.description}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Course Topics</h4>
                      <div className="space-y-2">
                        {message.outline.sessions.map((session) => (
                          <div 
                            key={session.sessionNumber}
                            className="flex gap-3 p-2 rounded-md bg-muted/50"
                          >
                            <span className="text-primary font-medium text-sm w-6 flex-shrink-0">
                              {session.sessionNumber}.
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{session.title}</p>
                              {session.subtitle && (
                                <p className="text-xs text-muted-foreground">{session.subtitle}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Look good? You can ask me to adjust the topics, add or remove sessions, or change the focus. When you're happy, click "Build Course" to create it.
                    </p>
                  </div>
                </Card>
              ) : (
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
              )}
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
                  <span>Thinking...</span>
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
                  <span>Creating your course...</span>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {currentOutline && !isBuilding && (
          <div className="mb-4">
            <Button
              onClick={handleBuild}
              disabled={isGenerating || isBuilding}
              className="w-full"
              size="lg"
              data-testid="button-build-course"
            >
              <Hammer className="w-4 h-4 mr-2" />
              Build Course
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentOutline ? "Request changes to the outline..." : "Type your message..."}
              className="resize-none min-h-[52px] max-h-32"
              disabled={isGenerating || isBuilding}
              data-testid="input-message"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-[52px] w-[52px] flex-shrink-0"
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
