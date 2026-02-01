import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { BookOpen, Plus, Play, CheckCircle2, LogOut, MoreVertical, Archive, Trash2, ArchiveRestore, ChevronDown, ChevronUp, Droplet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Course } from "@shared/schema";

interface CourseWithProgress extends Course {
  completedLessons: number;
}

export default function Home() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseWithProgress | null>(null);

  const { data: courses, isLoading } = useQuery<CourseWithProgress[]>({
    queryKey: ["/api/courses"],
  });

  const archiveMutation = useMutation({
    mutationFn: async (courseId: number) => {
      return apiRequest("POST", `/api/courses/${courseId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course archived" });
    },
    onError: () => {
      toast({ title: "Failed to archive course", variant: "destructive" });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (courseId: number) => {
      return apiRequest("POST", `/api/courses/${courseId}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore course", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (courseId: number) => {
      return apiRequest("DELETE", `/api/courses/${courseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course deleted" });
      setCourseToDelete(null);
    },
    onError: () => {
      toast({ title: "Failed to delete course", variant: "destructive" });
    },
  });

  const activeCourses = courses?.filter(c => !c.isCompleted && !c.isArchived) || [];
  const completedCourses = courses?.filter(c => c.isCompleted && !c.isArchived) || [];
  const archivedCourses = courses?.filter(c => c.isArchived) || [];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
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

      <main className="container mx-auto px-4 py-8 max-w-full">
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
                <CourseCard 
                  key={course.id} 
                  course={course} 
                  onArchive={() => archiveMutation.mutate(course.id)}
                  onDelete={() => setCourseToDelete(course)}
                />
              ))}
            </div>
          )}
        </section>

        {completedCourses.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4" data-testid="text-completed-courses">Completed</h2>
            <div className="grid gap-4">
              {completedCourses.map(course => (
                <CourseCard 
                  key={course.id} 
                  course={course} 
                  isCompleted
                  onArchive={() => archiveMutation.mutate(course.id)}
                  onDelete={() => setCourseToDelete(course)}
                />
              ))}
            </div>
          </section>
        )}

        {archivedCourses.length > 0 && (
          <section>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              data-testid="button-toggle-archived"
            >
              <Archive className="w-4 h-4" />
              <span className="font-medium">Archived ({archivedCourses.length})</span>
              {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showArchived && (
              <div className="grid gap-4">
                {archivedCourses.map(course => (
                  <CourseCard 
                    key={course.id} 
                    course={course}
                    isArchived
                    onUnarchive={() => unarchiveMutation.mutate(course.id)}
                    onDelete={() => setCourseToDelete(course)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <AlertDialog open={!!courseToDelete} onOpenChange={() => setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{courseToDelete?.title}"? This action cannot be undone and will remove all your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => courseToDelete && deleteMutation.mutate(courseToDelete.id)}
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

function CourseIcon({ iconUrl, size = 48 }: { iconUrl?: string | null; size?: number }) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt="Course icon"
        className="rounded-lg object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => {
          // Fallback to default icon on error
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className="rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <Droplet className="text-primary" style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

function CourseCard({
  course,
  isCompleted,
  isArchived,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  course: CourseWithProgress;
  isCompleted?: boolean;
  isArchived?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
}) {
  const progressPercent = course.totalLessons
    ? Math.round((course.completedLessons / course.totalLessons) * 100)
    : 0;

  return (
    <Card
      className={`p-5 transition-colors overflow-hidden ${isArchived ? 'opacity-60' : ''}`}
      data-testid={`card-course-${course.id}`}
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <Link href={`/course/${course.id}`} className="flex items-start gap-4 flex-1 min-w-0 hover-elevate rounded-md -m-2 p-2 overflow-hidden">
          <CourseIcon iconUrl={course.iconUrl} size={48} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1 break-words" data-testid={`text-course-title-${course.id}`}>
              {course.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 break-words">
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
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCompleted ? (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
          ) : (
            <Link href={`/course/${course.id}`}>
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover-elevate">
                <Play className="w-5 h-5" />
              </div>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-course-menu-${course.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isArchived ? (
                <DropdownMenuItem onClick={onUnarchive} data-testid={`button-unarchive-${course.id}`}>
                  <ArchiveRestore className="w-4 h-4 mr-2" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive} data-testid={`button-archive-${course.id}`}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete} 
                className="text-destructive focus:text-destructive"
                data-testid={`button-delete-${course.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
