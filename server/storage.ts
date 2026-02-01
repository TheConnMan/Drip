import { db } from "./db";
import {
  courses, lessons, lessonProgress, topicExpansions, lessonFeedback, courseResearch,
  type Course, type InsertCourse, type Lesson, type InsertLesson,
  type LessonProgress, type InsertLessonProgress, type TopicExpansion, type InsertTopicExpansion,
  type LessonFeedback, type InsertLessonFeedback, type CourseResearch, type InsertCourseResearch
} from "@shared/schema";
import { eq, and, desc, asc, sql, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Courses
  getCourse(id: number): Promise<Course | undefined>;
  getCourseByRssFeedUuid(uuid: string): Promise<Course | undefined>;
  getCoursesByUser(userId: string): Promise<(Course & { completedLessons: number })[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, data: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: number): Promise<void>;
  archiveCourse(id: number): Promise<Course | undefined>;
  unarchiveCourse(id: number): Promise<Course | undefined>;
  
  // Lessons
  getLesson(id: number): Promise<Lesson | undefined>;
  getLessonsByCourse(courseId: number): Promise<Lesson[]>;
  getLessonsWithAudio(courseId: number): Promise<Lesson[]>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  updateLesson(id: number, data: Partial<InsertLesson>): Promise<Lesson | undefined>;
  getNextLesson(courseId: number, currentSessionNumber: number): Promise<Lesson | undefined>;
  
  // Progress
  getLessonProgress(userId: string, lessonId: number): Promise<LessonProgress | undefined>;
  getProgressByCourse(userId: string, courseId: number): Promise<LessonProgress[]>;
  markLessonComplete(userId: string, lessonId: number, courseId: number): Promise<LessonProgress>;
  getCompletedLessonsCount(userId: string, courseId: number): Promise<number>;
  
  // Expansions
  getExpansionsByLesson(lessonId: number): Promise<TopicExpansion[]>;
  createExpansion(expansion: InsertTopicExpansion): Promise<TopicExpansion>;
  
  // Feedback
  getFeedbackByCourse(courseId: number): Promise<LessonFeedback[]>;
  createFeedback(feedback: InsertLessonFeedback): Promise<LessonFeedback>;

  // Research
  createCourseResearch(data: InsertCourseResearch): Promise<CourseResearch>;
  getCourseResearch(courseId: number): Promise<CourseResearch | undefined>;
  updateCourseResearch(id: number, data: Partial<CourseResearch>): Promise<CourseResearch | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Courses
  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async getCourseByRssFeedUuid(uuid: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.rssFeedUuid, uuid));
    return course;
  }

  async getCoursesByUser(userId: string): Promise<(Course & { completedLessons: number })[]> {
    const userCourses = await db
      .select()
      .from(courses)
      .where(eq(courses.userId, userId))
      .orderBy(desc(courses.updatedAt));

    const coursesWithProgress = await Promise.all(
      userCourses.map(async (course) => {
        const completedCount = await this.getCompletedLessonsCount(userId, course.id);
        return {
          ...course,
          completedLessons: completedCount,
        };
      })
    );

    return coursesWithProgress;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: number, data: Partial<InsertCourse>): Promise<Course | undefined> {
    const [updated] = await db
      .update(courses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return updated;
  }

  async deleteCourse(id: number): Promise<void> {
    await db.delete(courses).where(eq(courses.id, id));
  }

  async archiveCourse(id: number): Promise<Course | undefined> {
    const [updated] = await db
      .update(courses)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return updated;
  }

  async unarchiveCourse(id: number): Promise<Course | undefined> {
    const [updated] = await db
      .update(courses)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return updated;
  }

  // Lessons
  async getLesson(id: number): Promise<Lesson | undefined> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  async getLessonsByCourse(courseId: number): Promise<Lesson[]> {
    return db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(asc(lessons.sessionNumber));
  }

  async getLessonsWithAudio(courseId: number): Promise<Lesson[]> {
    return db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.courseId, courseId),
          isNotNull(lessons.audioStorageKey)
        )
      )
      .orderBy(asc(lessons.sessionNumber));
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [newLesson] = await db.insert(lessons).values(lesson).returning();
    return newLesson;
  }

  async updateLesson(id: number, data: Partial<InsertLesson>): Promise<Lesson | undefined> {
    const [updated] = await db
      .update(lessons)
      .set(data)
      .where(eq(lessons.id, id))
      .returning();
    return updated;
  }

  async getNextLesson(courseId: number, currentSessionNumber: number): Promise<Lesson | undefined> {
    const [nextLesson] = await db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.courseId, courseId),
          sql`${lessons.sessionNumber} > ${currentSessionNumber}`
        )
      )
      .orderBy(asc(lessons.sessionNumber))
      .limit(1);
    return nextLesson;
  }

  // Progress
  async getLessonProgress(userId: string, lessonId: number): Promise<LessonProgress | undefined> {
    const [progress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      );
    return progress;
  }

  async getProgressByCourse(userId: string, courseId: number): Promise<LessonProgress[]> {
    return db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.courseId, courseId)
        )
      );
  }

  async markLessonComplete(userId: string, lessonId: number, courseId: number): Promise<LessonProgress> {
    const existing = await this.getLessonProgress(userId, lessonId);
    
    if (existing) {
      const [updated] = await db
        .update(lessonProgress)
        .set({ isCompleted: true, completedAt: new Date() })
        .where(eq(lessonProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [newProgress] = await db
      .insert(lessonProgress)
      .values({
        userId,
        lessonId,
        courseId,
        isCompleted: true,
        completedAt: new Date(),
      })
      .returning();
    return newProgress;
  }

  async getCompletedLessonsCount(userId: string, courseId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.courseId, courseId),
          eq(lessonProgress.isCompleted, true)
        )
      );
    return Number(result[0]?.count || 0);
  }

  // Expansions
  async getExpansionsByLesson(lessonId: number): Promise<TopicExpansion[]> {
    return db
      .select()
      .from(topicExpansions)
      .where(eq(topicExpansions.lessonId, lessonId))
      .orderBy(asc(topicExpansions.createdAt));
  }

  async createExpansion(expansion: InsertTopicExpansion): Promise<TopicExpansion> {
    const [newExpansion] = await db.insert(topicExpansions).values(expansion).returning();
    return newExpansion;
  }

  // Feedback
  async getFeedbackByCourse(courseId: number): Promise<LessonFeedback[]> {
    return db
      .select()
      .from(lessonFeedback)
      .where(eq(lessonFeedback.courseId, courseId))
      .orderBy(asc(lessonFeedback.createdAt));
  }

  async createFeedback(feedback: InsertLessonFeedback): Promise<LessonFeedback> {
    const [newFeedback] = await db.insert(lessonFeedback).values(feedback).returning();
    return newFeedback;
  }

  // Research
  async createCourseResearch(data: InsertCourseResearch): Promise<CourseResearch> {
    const [newResearch] = await db.insert(courseResearch).values(data).returning();
    return newResearch;
  }

  async getCourseResearch(courseId: number): Promise<CourseResearch | undefined> {
    const [research] = await db.select().from(courseResearch).where(eq(courseResearch.courseId, courseId));
    return research;
  }

  async updateCourseResearch(id: number, data: Partial<CourseResearch>): Promise<CourseResearch | undefined> {
    const [updated] = await db
      .update(courseResearch)
      .set(data)
      .where(eq(courseResearch.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
