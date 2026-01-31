import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Play, ChevronDown, ChevronUp, Sparkles, Check, Loader2, Menu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { apiRequest } from "@/lib/queryClient";
import type { Lesson, Course, TopicExpansion, LessonProgress } from "@shared/schema";

interface LessonDetail extends Lesson {
  course: Course;
  expansions: TopicExpansion[];
  isCompleted: boolean;
  nextLessonId?: number;
}

export default function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandingTopic, setExpandingTopic] = useState<string | null>(null);
  const [localExpansions, setLocalExpansions] = useState<TopicExpansion[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: lesson, isLoading } = useQuery<LessonDetail>({
    queryKey: ["/api/lessons", lessonId],
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

        <Card className="p-4 mb-8 flex items-center gap-4" data-testid="card-audio-player">
          <Button size="icon" className="rounded-full w-12 h-12 flex-shrink-0" data-testid="button-play">
            <Play className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm font-medium flex items-center gap-2">
              <span>Listen to lesson</span>
            </p>
            <p className="text-xs text-muted-foreground">0:00 / {lesson.estimatedMinutes}:00</p>
          </div>
        </Card>

        <article className="prose-lesson mb-8" data-testid="lesson-content">
          <ReactMarkdown>{lesson.content}</ReactMarkdown>
        </article>

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
            disabled={expandMutation.isPending}
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
              disabled={completeMutation.isPending}
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
