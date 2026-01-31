import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Lock } from "lucide-react";
import type { Course, Lesson, LessonProgress } from "@shared/schema";

interface CourseDetail extends Course {
  lessons: Lesson[];
  progress: LessonProgress[];
  completedLessons: number;
}

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();

  const { data: course, isLoading } = useQuery<CourseDetail>({
    queryKey: ["/api/courses", id],
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
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="font-semibold truncate" data-testid="text-course-title">{course.title}</h1>
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
