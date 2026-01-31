import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all courses for current user
  app.get("/api/courses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const courses = await storage.getCoursesByUser(userId);
      res.json(courses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  // Get single course with lessons and progress
  app.get("/api/courses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const courseId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Verify ownership
      if (course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const lessons = await storage.getLessonsByCourse(courseId);
      const progress = await storage.getProgressByCourse(userId, courseId);
      const completedLessons = await storage.getCompletedLessonsCount(userId, courseId);

      res.json({
        ...course,
        lessons,
        progress,
        completedLessons,
      });
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  // Helper function to extract and parse JSON from Claude response
  function extractJSON(text: string): any {
    let jsonStr = text;
    
    // Try to extract JSON from markdown code blocks using regex
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      // Try to find JSON object by locating first { and last }
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = text.substring(firstBrace, lastBrace + 1);
      }
    }
    
    return JSON.parse(jsonStr);
  }

  // Preview course outline (without creating) - with clarifying questions for vague topics
  app.post("/api/courses/preview", isAuthenticated, async (req: any, res) => {
    try {
      const { topic, feedback, previousOutline, conversationHistory } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      // If we already have an outline and user is providing feedback, revise it
      if (previousOutline && feedback) {
        const revisePrompt = `I previously suggested this course outline for "${topic}":

${JSON.stringify(previousOutline, null, 2)}

The user provided this feedback: "${feedback}"

Please revise the course outline based on their feedback.

Respond with a JSON object in this exact format:
{
  "type": "outline",
  "title": "Course Title",
  "description": "A brief description of what the learner will gain",
  "sessions": [
    {
      "title": "Session Title",
      "subtitle": "Brief hook or description",
      "sessionNumber": 1
    }
  ]
}

Only respond with valid JSON, no other text.`;

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          messages: [{ role: "user", content: revisePrompt }],
        });

        if (!response.content.length || response.content[0].type !== "text") {
          return res.status(500).json({ error: "Failed to generate preview" });
        }

        const result = extractJSON(response.content[0].text);
        res.json({ ...result, type: "outline" });
        return;
      }

      // For new topics, decide whether to ask clarifying questions or generate outline
      const decisionPrompt = `A user wants to learn about: "${topic}"

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}Analyze this topic request and decide:

1. If the topic is specific enough to create a good learning path (e.g., "Python basics for data science", "How to start a podcast", "Understanding cryptocurrency"), generate a course outline.

2. If the topic is vague or could go in many directions (e.g., "marketing", "AI", "fitness"), ask 1-2 clarifying questions to better understand what they want to learn.

Respond with a JSON object in ONE of these formats:

For clarifying questions:
{
  "type": "question",
  "question": "Your clarifying question here"
}

For generating outline (when topic is specific enough):
{
  "type": "outline",
  "title": "Course Title",
  "description": "A brief description of what the learner will gain",
  "sessions": [
    {
      "title": "Session Title",
      "subtitle": "Brief hook or description",
      "sessionNumber": 1
    }
  ]
}

If generating an outline, create 10-14 sessions that progressively teach this topic. Each session should be a focused 5-minute read. Make titles engaging and subtitles informative.

Only respond with valid JSON, no other text.`;

      console.log("Processing course topic:", topic);
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: decisionPrompt }],
      });

      if (!response.content.length || response.content[0].type !== "text") {
        return res.status(500).json({ error: "Failed to process request" });
      }

      const result = extractJSON(response.content[0].text);
      
      if (result.type === "question") {
        res.json({ type: "question", question: result.question });
      } else if (result.type === "outline") {
        if (!result.title || !result.description || !Array.isArray(result.sessions)) {
          return res.status(500).json({ error: "Invalid outline structure" });
        }
        res.json(result);
      } else {
        return res.status(500).json({ error: "Invalid response type" });
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // Build course from approved outline - lessons generated on-demand
  app.post("/api/courses/build", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { outline } = req.body;

      // Validate outline structure
      if (!outline || typeof outline.title !== 'string' || !outline.title.trim()) {
        return res.status(400).json({ error: "Valid outline with title is required" });
      }
      if (!outline.description || typeof outline.description !== 'string') {
        return res.status(400).json({ error: "Valid outline description is required" });
      }
      if (!Array.isArray(outline.sessions) || outline.sessions.length < 1 || outline.sessions.length > 20) {
        return res.status(400).json({ error: "Outline must have 1-20 sessions" });
      }
      for (const session of outline.sessions) {
        if (!session.title || !session.sessionNumber) {
          return res.status(400).json({ error: "Each session must have a title and sessionNumber" });
        }
      }

      console.log("Building course from outline:", outline.title);

      // Create the course
      const course = await storage.createCourse({
        userId,
        title: outline.title,
        description: outline.description,
        totalLessons: outline.sessions.length,
        isCompleted: false,
      });

      // Create all lessons with placeholder content - will be generated on-demand
      for (const session of outline.sessions) {
        await storage.createLesson({
          courseId: course.id,
          sessionNumber: session.sessionNumber,
          title: session.title,
          subtitle: session.subtitle,
          content: "PENDING_GENERATION",
          estimatedMinutes: 5,
        });
      }

      res.json(course);
    } catch (error) {
      console.error("Error building course:", error);
      res.status(500).json({ error: "Failed to build course" });
    }
  });

  // Delete a course
  app.delete("/api/courses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const courseId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteCourse(courseId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting course:", error);
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  // Archive a course
  app.post("/api/courses/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const courseId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updated = await storage.archiveCourse(courseId);
      res.json(updated);
    } catch (error) {
      console.error("Error archiving course:", error);
      res.status(500).json({ error: "Failed to archive course" });
    }
  });

  // Unarchive a course
  app.post("/api/courses/:id/unarchive", isAuthenticated, async (req: any, res) => {
    try {
      const courseId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updated = await storage.unarchiveCourse(courseId);
      res.json(updated);
    } catch (error) {
      console.error("Error unarchiving course:", error);
      res.status(500).json({ error: "Failed to unarchive course" });
    }
  });

  // Generate a new course with AI (legacy - direct generation)
  app.post("/api/courses/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topic } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      // Generate course outline with Claude
      console.log("Generating course outline for topic:", topic);
      let outlineResponse;
      try {
        outlineResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `Create a micro-learning course outline for the topic: "${topic}"

Generate exactly 10-14 sessions (lessons) that progressively teach this topic.
Each session should be a focused 5-minute read.

Respond with a JSON object in this exact format:
{
  "title": "Course Title",
  "description": "A brief description of what the learner will gain",
  "sessions": [
    {
      "title": "Session Title",
      "subtitle": "Brief hook or description",
      "sessionNumber": 1
    }
  ]
}

Make titles engaging and subtitles informative. Order sessions logically for progressive learning.
Only respond with valid JSON, no other text.`,
            },
          ],
        });
      } catch (aiError: any) {
        console.error("Claude API error:", aiError.message, aiError.status, aiError.error);
        return res.status(500).json({ error: "Failed to generate course outline" });
      }

      // Check for valid response
      if (!outlineResponse.content.length || outlineResponse.content[0].type !== "text") {
        console.error("Invalid Claude response - no text content");
        return res.status(500).json({ error: "Failed to generate course outline" });
      }
      
      let outline;
      try {
        outline = extractJSON(outlineResponse.content[0].text);
      } catch {
        console.error("Failed to parse outline");
        return res.status(500).json({ error: "Failed to generate course outline" });
      }
      
      // Validate required fields
      if (!outline.title || !outline.description || !Array.isArray(outline.sessions) || outline.sessions.length === 0) {
        console.error("Invalid outline structure:", outline);
        return res.status(500).json({ error: "Failed to generate course outline" });
      }
      
      console.log("Outline parsed successfully:", outline.title);

      // Create the course
      const course = await storage.createCourse({
        userId,
        title: outline.title,
        description: outline.description,
        totalLessons: outline.sessions.length,
        isCompleted: false,
      });

      // Generate content for the first 3 lessons in parallel
      const sessionsToGenerate = outline.sessions.slice(0, 3);
      const lessonContents = await Promise.all(
        sessionsToGenerate.map(async (session: any) => {
          const contentResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: `Write a 5-minute lesson for the session: "${session.title}"
This is part of a course on: "${outline.title}"
Session ${session.sessionNumber} of ${outline.sessions.length}.

Write engaging, educational content that:
- Is formatted in clean markdown
- Uses clear paragraphs (no headers in the body)
- Includes real-world examples and analogies
- Is conversational but informative
- Is approximately 500-700 words

Just write the lesson content, no meta text or introductions.`,
              },
            ],
          });

          return {
            ...session,
            content: contentResponse.content[0].type === "text" 
              ? contentResponse.content[0].text 
              : "",
          };
        })
      );

      // Create lessons in database
      for (const session of outline.sessions) {
        const generatedContent = lessonContents.find(
          (l: any) => l.sessionNumber === session.sessionNumber
        );

        await storage.createLesson({
          courseId: course.id,
          sessionNumber: session.sessionNumber,
          title: session.title,
          subtitle: session.subtitle,
          content: generatedContent?.content || "Content will be generated when you reach this lesson.",
          estimatedMinutes: 5,
        });
      }

      res.json(course);
    } catch (error) {
      console.error("Error generating course:", error);
      res.status(500).json({ error: "Failed to generate course" });
    }
  });

  // Get a single lesson with expansions
  app.get("/api/lessons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const lesson = await storage.getLesson(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const course = await storage.getCourse(lesson.courseId);
      
      // Verify ownership
      if (!course || course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const expansions = await storage.getExpansionsByLesson(lessonId);
      const progress = await storage.getLessonProgress(userId, lessonId);
      const nextLesson = await storage.getNextLesson(lesson.courseId, lesson.sessionNumber);

      // If this lesson doesn't have content yet, generate it on-demand
      if (lesson.content === "PENDING_GENERATION" || lesson.content === "Content will be generated when you reach this lesson.") {
        // Get any previous feedback to influence this lesson
        const allFeedback = await storage.getFeedbackByCourse(lesson.courseId);
        const recentFeedback = allFeedback.slice(-3).map(f => f.feedback).join("\n- ");
        
        let feedbackContext = "";
        if (recentFeedback) {
          feedbackContext = `\n\nThe learner has provided this feedback on previous lessons that you should incorporate:\n- ${recentFeedback}`;
        }

        const contentResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: `Write a 5-minute lesson for: "${lesson.title}"
This is part of a course on: "${course?.title}"
Session ${lesson.sessionNumber} of ${course?.totalLessons}.${feedbackContext}

Write engaging, educational content that:
- Is formatted in clean markdown
- Uses clear paragraphs (no headers in the body)
- Includes real-world examples and analogies
- Is conversational but informative
- Is approximately 500-700 words

Just write the lesson content, no meta text or introductions.`,
            },
          ],
        });

        const content = contentResponse.content[0].type === "text" 
          ? contentResponse.content[0].text 
          : "";

        // Update the lesson with generated content
        await storage.updateLesson(lessonId, { content });

        res.json({
          ...lesson,
          content,
          course,
          expansions,
          isCompleted: progress?.isCompleted || false,
          nextLessonId: nextLesson?.id,
        });
        return;
      }

      res.json({
        ...lesson,
        course,
        expansions,
        isCompleted: progress?.isCompleted || false,
        nextLessonId: nextLesson?.id,
      });
    } catch (error) {
      console.error("Error fetching lesson:", error);
      res.status(500).json({ error: "Failed to fetch lesson" });
    }
  });

  // Mark lesson as complete
  app.post("/api/lessons/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const lesson = await storage.getLesson(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      // Verify ownership
      const course = await storage.getCourse(lesson.courseId);
      if (!course || course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const progress = await storage.markLessonComplete(userId, lessonId, lesson.courseId);

      // Check if course is completed
      const completedCount = await storage.getCompletedLessonsCount(userId, lesson.courseId);

      if (course && completedCount >= (course.totalLessons || 0)) {
        await storage.updateCourse(course.id, { isCompleted: true });
      }

      res.json(progress);
    } catch (error) {
      console.error("Error marking lesson complete:", error);
      res.status(500).json({ error: "Failed to mark lesson complete" });
    }
  });

  // Submit feedback for a lesson (influences future lessons)
  app.post("/api/lessons/:id/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { feedback } = req.body;

      if (!feedback || typeof feedback !== "string") {
        return res.status(400).json({ error: "Feedback is required" });
      }

      const lesson = await storage.getLesson(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      // Verify ownership
      const course = await storage.getCourse(lesson.courseId);
      if (!course || course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const newFeedback = await storage.createFeedback({
        userId,
        lessonId,
        courseId: lesson.courseId,
        feedback,
      });

      res.json(newFeedback);
    } catch (error) {
      console.error("Error saving feedback:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // Expand a topic in a lesson
  app.post("/api/lessons/:id/expand", isAuthenticated, async (req: any, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { topic } = req.body;

      if (!topic || typeof topic !== "string") {
        return res.status(400).json({ error: "Topic is required" });
      }

      const lesson = await storage.getLesson(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      // Verify ownership
      const course = await storage.getCourse(lesson.courseId);
      if (!course || course.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Generate expansion with Claude
      const expansionResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `The user is reading a lesson titled "${lesson.title}" and wants to learn more about: "${topic}"

Write a focused deep-dive explanation (200-400 words) that:
- Expands on this specific topic
- Provides additional context, examples, or details
- Uses clean markdown formatting
- Is informative and engaging

Just provide the expanded content, no meta text.`,
          },
        ],
      });

      const content = expansionResponse.content[0].type === "text" 
        ? expansionResponse.content[0].text 
        : "";

      const expansion = await storage.createExpansion({
        lessonId,
        topic,
        content,
      });

      res.json(expansion);
    } catch (error) {
      console.error("Error expanding topic:", error);
      res.status(500).json({ error: "Failed to expand topic" });
    }
  });

  return httpServer;
}
