import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, ChevronDown, ChevronUp, Sparkles, Check, Loader2, Menu, MessageSquare, X, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { apiRequest } from "@/lib/queryClient";
import type { Lesson, Course, TopicExpansion } from "@shared/schema";

type CitationMap = Record<string, string>;

function CitationBadge({ num, url }: { num: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground rounded-full align-super ml-0.5 no-underline transition-colors"
      title={`Source ${num}`}
    >
      {num}
    </a>
  );
}

function renderTextWithCitations(text: string, citations: CitationMap): React.ReactNode {
  if (Object.keys(citations).length === 0) {
    return text;
  }

  // Split text by citation patterns [N]
  const parts = text.split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const num = match[1];
      const url = citations[num];
      if (url) {
        return <CitationBadge key={index} num={num} url={url} />;
      }
    }
    return part;
  });
}

function LessonContent({ content, citationMap }: { content: string; citationMap?: string | null }) {
  // Parse citation map if present
  const citations: CitationMap = citationMap ? (() => {
    try {
      return JSON.parse(citationMap) as CitationMap;
    } catch {
      return {};
    }
  })() : {};

  const hasCitations = Object.keys(citations).length > 0;

  if (!hasCitations) {
    return <ReactMarkdown>{content}</ReactMarkdown>;
  }

  // Use ReactMarkdown with custom text rendering to handle citations
  return (
    <ReactMarkdown
      components={{
        // Override text rendering to inject citation badges
        p: ({ children }) => {
          const processChildren = (child: React.ReactNode): React.ReactNode => {
            if (typeof child === 'string') {
              return renderTextWithCitations(child, citations);
            }
            return child;
          };
          return <p>{Array.isArray(children) ? children.map(processChildren) : processChildren(children)}</p>;
        },
        li: ({ children }) => {
          const processChildren = (child: React.ReactNode): React.ReactNode => {
            if (typeof child === 'string') {
              return renderTextWithCitations(child, citations);
            }
            return child;
          };
          return <li>{Array.isArray(children) ? children.map(processChildren) : processChildren(children)}</li>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

interface LessonDetail extends Lesson {
  course: Course;
  expansions: TopicExpansion[];
  isCompleted: boolean;
  nextLessonId?: number;
  isGenerating?: boolean;
}

export default function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandingTopic, setExpandingTopic] = useState<string | null>(null);
  const [localExpansions, setLocalExpansions] = useState<TopicExpansion[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const { data: lesson, isLoading } = useQuery<LessonDetail>({
    queryKey: ["/api/lessons", lessonId],
    refetchInterval: (query) => {
      // Poll every 2 seconds while content is generating
      const data = query.state.data;
      if (data?.content === "PENDING_GENERATION" || data?.isGenerating) {
        return 2000;
      }
      return false;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/lessons/${lessonId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons", lessonId] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Lesson completed!" });
      if (lesson?.nextLessonId) {
        navigate(`/lesson/${courseId}/${lesson.nextLessonId}`);
      } else {
        navigate(`/course/${courseId}`);
      }
    },
    onError: () => {
      toast({ title: "Failed to mark lesson complete", variant: "destructive" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (feedback: string) => {
      const response = await apiRequest("POST", `/api/lessons/${lessonId}/feedback`, { feedback });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback saved! Your next lessons will incorporate this." });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons", lessonId] });
      setIsEditingFeedback(false);
    },
    onError: () => {
      toast({ title: "Failed to save feedback", variant: "destructive" });
    },
  });

  const expandMutation = useMutation({
    mutationFn: async (topic: string) => {
      setExpandingTopic(topic);
      const response = await apiRequest("POST", `/api/lessons/${lessonId}/expand`, { topic });
      return response.json();
    },
    onSuccess: (data: TopicExpansion) => {
      setLocalExpansions(prev => [...prev, data]);
      setExpandedIds(prev => new Set([...Array.from(prev), data.id]));
      setExpandingTopic(null);
    },
    onError: () => {
      toast({ title: "Failed to expand topic", variant: "destructive" });
      setExpandingTopic(null);
    },
  });

  const allExpansions = [...(lesson?.expansions || []), ...localExpansions];

  const toggleExpansion = (id: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(Array.from(prev));
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleFeedbackSubmit = () => {
    if (!feedbackText.trim()) return;
    feedbackMutation.mutate(feedbackText.trim());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <Skeleton className="w-8 h-8" />
            <Skeleton className="w-32 h-6" />
            <Skeleton className="w-8 h-8" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-10 w-full mb-6" />
          <Skeleton className="h-16 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </main>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Lesson not found</h2>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isGeneratingContent = lesson.content === "PENDING_GENERATION";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href={`/course/${courseId}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="font-semibold truncate text-center max-w-[60%]" data-testid="text-course-title">
            {lesson.course.title}
          </h1>
          <Button variant="ghost" size="icon" asChild data-testid="button-menu">
            <Link href={`/course/${courseId}`}>
              <Menu className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <div className="flex items-center gap-3 text-sm mb-2">
            <span className="text-primary font-medium" data-testid="text-session-info">
              SESSION {lesson.sessionNumber} OF {lesson.course.totalLessons}
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {lesson.estimatedMinutes} min read
            </span>
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-lesson-title">{lesson.title}</h1>
        </div>

        {isGeneratingContent ? (
          <Card className="p-8 mb-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="font-medium mb-2">Generating your lesson...</h3>
            <p className="text-sm text-muted-foreground">
              This may take a moment. The content is being personalized for you.
            </p>
          </Card>
        ) : (
          <article className="prose-lesson mb-8" data-testid="lesson-content">
            <LessonContent content={lesson.content} citationMap={lesson.citationMap} />
          </article>
        )}

        {allExpansions.length > 0 && (
          <div className="space-y-3 mb-8" data-testid="expansions-list">
            {allExpansions.map(expansion => (
              <Card key={expansion.id} className="overflow-hidden">
                <button
                  onClick={() => toggleExpansion(expansion.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover-elevate"
                  data-testid={`button-expansion-toggle-${expansion.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-medium">{expansion.topic}</span>
                  </div>
                  {expandedIds.has(expansion.id) ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                {expandedIds.has(expansion.id) && (
                  <div className="px-4 pb-4 pt-0 border-t border-border/50">
                    <div className="prose-lesson text-sm pt-4" data-testid={`expansion-content-${expansion.id}`}>
                      <ReactMarkdown>{expansion.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <div className="space-y-3 mb-8">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => {
              const selection = window.getSelection()?.toString().trim();
              const topicToExpand = selection && selection.length > 2 && selection.length < 200 
                ? selection 
                : lesson.title;
              expandMutation.mutate(topicToExpand);
            }}
            disabled={expandMutation.isPending || isGeneratingContent}
            data-testid="button-expand-topic"
          >
            {expandMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{expandingTopic ? `Expanding: ${expandingTopic.substring(0, 30)}...` : "Expand This Topic"}</span>
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Select text to expand a specific topic, or click to dive deeper into the lesson
          </p>
        </div>

        <Card className="p-4 mb-8" data-testid="card-feedback">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Your Feedback
            </h3>
            {lesson.userFeedback && !isEditingFeedback && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setFeedbackText(lesson.userFeedback || "");
                  setIsEditingFeedback(true);
                }}
                data-testid="button-edit-feedback"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {isEditingFeedback ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Tell me how I can improve future lessons. Want more examples? Less jargon? Different focus?
              </p>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g., More practical examples please, or Focus more on beginner concepts"
                className="mb-3 min-h-[80px]"
                data-testid="input-feedback"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingFeedback(false);
                    setFeedbackText("");
                  }}
                  data-testid="button-cancel-feedback"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFeedbackSubmit}
                  disabled={!feedbackText.trim() || feedbackMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-feedback"
                >
                  {feedbackMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Feedback
                </Button>
              </div>
            </>
          ) : lesson.userFeedback ? (
            <p className="text-sm text-muted-foreground" data-testid="text-saved-feedback">
              {lesson.userFeedback}
            </p>
          ) : (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setIsEditingFeedback(true)}
              data-testid="button-add-feedback"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Add feedback to improve future lessons
            </Button>
          )}
        </Card>

        <div className="sticky bottom-4">
          {lesson.isCompleted ? (
            <div className="flex items-center justify-center gap-2 text-primary p-4">
              <Check className="w-5 h-5" />
              <span className="font-medium">Lesson Completed</span>
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending || isGeneratingContent}
              data-testid="button-complete-lesson"
            >
              {completeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {lesson.nextLessonId ? "Complete & Continue" : "Complete Lesson"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
