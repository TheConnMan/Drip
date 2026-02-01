import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Citation type for research documents
export interface Citation {
  index: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export * from "./models/auth";

// Courses table
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  totalLessons: integer("total_lessons").default(0),
  isCompleted: boolean("is_completed").default(false),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Lessons table
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  content: text("content").notNull(),
  userFeedback: text("user_feedback"),
  estimatedMinutes: integer("estimated_minutes").default(5),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Lesson feedback for influencing future lessons
export const lessonFeedback = pgTable("lesson_feedback", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  feedback: text("feedback").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User progress per lesson
export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
});

// Topic expansions for lessons
export const topicExpansions = pgTable("topic_expansions", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Course research from Perplexity deep research
// Stores comprehensive research document with citations for grounding lesson content
export const courseResearch = pgTable("course_research", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  query: text("query").notNull(), // The query sent to Perplexity
  content: text("content").notNull(), // Full research response text
  citations: jsonb("citations").$type<Citation[]>().default([]), // Array of citation objects
  searchCount: integer("search_count"), // Number of searches Perplexity performed
  tokenCount: integer("token_count"), // Response token count
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, in_progress, completed, failed
  error: text("error"), // Error message if failed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas
export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
  createdAt: true,
});

export const insertLessonProgressSchema = createInsertSchema(lessonProgress).omit({
  id: true,
});

export const insertTopicExpansionSchema = createInsertSchema(topicExpansions).omit({
  id: true,
  createdAt: true,
});

export const insertLessonFeedbackSchema = createInsertSchema(lessonFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertCourseResearchSchema = createInsertSchema(courseResearch).omit({
  id: true,
  createdAt: true,
});

// Types
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertLessonProgress = z.infer<typeof insertLessonProgressSchema>;
export type TopicExpansion = typeof topicExpansions.$inferSelect;
export type InsertTopicExpansion = z.infer<typeof insertTopicExpansionSchema>;
export type LessonFeedback = typeof lessonFeedback.$inferSelect;
export type InsertLessonFeedback = z.infer<typeof insertLessonFeedbackSchema>;
export type CourseResearch = typeof courseResearch.$inferSelect;
export type InsertCourseResearch = z.infer<typeof insertCourseResearchSchema>;
