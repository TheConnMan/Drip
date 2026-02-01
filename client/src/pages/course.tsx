import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Lock, MoreVertical, Archive, Trash2, Loader2, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Course, Lesson, LessonProgress } from "@shared/schema";

interface CourseResearchSummary {
  status: string;
  confidenceScore: number | null;
}

interface CourseDetail extends Course {
  lessons: Lesson[];
  progress: LessonProgress[];
  completedLessons: number;
  research: CourseResearchSummary | null;
}

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: course, isLoading } = useQuery<CourseDetail>({
    queryKey: ["/api/courses", id],
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/courses/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course archived" });
      navigate("/");
    },
    onError: () => {
      toast({ title: "Failed to archive course", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course deleted" });
      navigate("/");
    },
    onError: () => {
      toast({ title: "Failed to delete course", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 h-14 flex items-center gap-4">
            <Skeleton className="w-8 h-8" />
            <Skeleton className="w-48 h-6" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Skeleton className="h-24 mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Course not found</h2>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const progressPercent = course.totalLessons 
    ? Math.round((course.completedLessons / course.totalLessons) * 100) 
    : 0;

  const completedLessonIds = new Set(
    course.progress.filter(p => p.isCompleted).map(p => p.lessonId)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="font-semibold truncate" data-testid="text-course-title">{course.title}</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-course-menu">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => archiveMutation.mutate()}
                data-testid="button-archive"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Course
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
                data-testid="button-delete"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card className="p-5 mb-6" data-testid="card-progress">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium" data-testid="text-your-progress">Your Progress</h3>
              <p className="text-sm text-muted-foreground">
                Day {course.completedLessons + 1} of {course.totalLessons}
              </p>
            </div>
          </div>
          <Progress value={progressPercent} className="mt-4 h-2" data-testid="progress-bar" />
          {course.research && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              {course.research.status === "generating" || course.research.status === "pending" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Researching...</span>
                </>
              ) : course.research.status === "completed" && course.research.confidenceScore !== null ? (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>Research Quality: {course.research.confidenceScore}%</span>
                </>
              ) : null}
            </div>
          )}
        </Card>

        <div className="space-y-3">
          {course.lessons.map((lesson, index) => {
            const isCompleted = completedLessonIds.has(lesson.id);
            const previousCompleted = index === 0 || completedLessonIds.has(course.lessons[index - 1].id);
            const isAccessible = index === 0 || previousCompleted;
            const isCurrent = !isCompleted && previousCompleted;

            return (
              <LessonItem
                key={lesson.id}
                lesson={lesson}
                courseId={course.id}
                isCompleted={isCompleted}
                isAccessible={isAccessible}
                isCurrent={isCurrent}
              />
            );
          })}
        </div>
      </main>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{course.title}"? This action cannot be undone and will remove all your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LessonItem({
  lesson,
  courseId,
  isCompleted,
  isAccessible,
  isCurrent,
}: {
  lesson: Lesson;
  courseId: number;
  isCompleted: boolean;
  isAccessible: boolean;
  isCurrent: boolean;
}) {
  const content = (
    <Card
      className={`p-4 transition-colors ${
        isAccessible ? "hover-elevate cursor-pointer" : "opacity-60"
      } ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
      data-testid={`card-lesson-${lesson.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : isAccessible ? (
            <Circle className={`w-5 h-5 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
          ) : (
            <Lock className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary mb-1" data-testid={`text-session-${lesson.sessionNumber}`}>
            SESSION {lesson.sessionNumber}
          </p>
          <h3 className="font-medium mb-1" data-testid={`text-lesson-title-${lesson.id}`}>
            {lesson.title}
          </h3>
          {lesson.subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {lesson.subtitle}
            </p>
          )}
        </div>
      </div>
    </Card>
  );

  if (!isAccessible) {
    return content;
  }

  return (
    <Link href={`/lesson/${courseId}/${lesson.id}`}>
      {content}
    </Link>
  );
}
