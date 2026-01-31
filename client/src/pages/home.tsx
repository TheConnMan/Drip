import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Plus, Play, CheckCircle2, LogOut } from "lucide-react";
import type { Course } from "@shared/schema";

interface CourseWithProgress extends Course {
  completedLessons: number;
}

export default function Home() {
  const { user, logout } = useAuth();

  const { data: courses, isLoading } = useQuery<CourseWithProgress[]>({
    queryKey: ["/api/courses"],
  });

  const activeCourses = courses?.filter(c => !c.isCompleted) || [];
  const completedCourses = courses?.filter(c => c.isCompleted) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Drip" className="w-8 h-8 rounded-md" />
            <span className="font-semibold text-lg" data-testid="text-logo">Drip</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild data-testid="button-new-course">
              <Link href="/new-course">
                <Plus className="w-4 h-4 mr-2" />
                New Course
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback>{user?.firstName?.[0] || user?.email?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => logout()}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4" data-testid="text-active-courses">Active Courses</h2>
          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : activeCourses.length === 0 ? (
            <Card className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No active courses</h3>
              <p className="text-muted-foreground mb-4">Start your learning journey by creating a new course.</p>
              <Button asChild data-testid="button-create-first-course">
                <Link href="/new-course">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Course
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeCourses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>

        {completedCourses.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4" data-testid="text-completed-courses">Completed</h2>
            <div className="grid gap-4">
              {completedCourses.map(course => (
                <CourseCard key={course.id} course={course} isCompleted />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function CourseCard({ course, isCompleted }: { course: CourseWithProgress; isCompleted?: boolean }) {
  const progressPercent = course.totalLessons 
    ? Math.round((course.completedLessons / course.totalLessons) * 100) 
    : 0;

  return (
    <Link href={`/course/${course.id}`}>
      <Card 
        className="p-5 hover-elevate cursor-pointer transition-colors"
        data-testid={`card-course-${course.id}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1 truncate" data-testid={`text-course-title-${course.id}`}>
              {course.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {course.description}
            </p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span>Day {course.completedLessons + 1} of {course.totalLessons}</span>
              </div>
              <span>{progressPercent}%</span>
            </div>
            <Progress 
              value={progressPercent} 
              className="mt-3 h-1.5" 
              data-testid={`progress-course-${course.id}`}
            />
          </div>
          <div className="flex-shrink-0">
            {isCompleted ? (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Play className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
