import { storage } from '../storage';
import { generateSpeech, saveAudioFile, getPublicAudioUrl } from './tts';

const GENERATION_HOUR = 5; // 5 AM

let schedulerInterval: NodeJS.Timeout | null = null;

export async function generateAudioForLesson(lessonId: number): Promise<void> {
  const lesson = await storage.getLesson(lessonId);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  if (lesson.audioUrl) {
    console.log(`Lesson ${lessonId} already has audio`);
    return;
  }

  const course = await storage.getCourse(lesson.courseId);
  if (!course) {
    throw new Error('Course not found');
  }

  const ttsResult = await generateSpeech(lesson.content, course.voiceId);
  const { fileSize } = await saveAudioFile(
    lesson.courseId,
    lesson.sessionNumber,
    ttsResult.audioBuffer
  );
  const audioUrl = getPublicAudioUrl(lesson.courseId, lesson.sessionNumber);

  await storage.updateLessonAudio(
    lesson.id,
    audioUrl,
    ttsResult.durationSeconds,
    fileSize
  );

  console.log(`Generated audio for lesson ${lessonId}`);
}

export async function runDailyLessonGeneration(): Promise<void> {
  console.log('Starting daily lesson generation check...');

  // This is a placeholder for the daily lesson generation logic
  // The actual lesson content generation happens through deep research (separate thread)
  // This scheduler would trigger audio generation for lessons that have content but no audio

  try {
    const lessonsNeedingAudio = await storage.getLessonsNeedingAudio();

    for (const lesson of lessonsNeedingAudio) {
      try {
        await generateAudioForLesson(lesson.id);
      } catch (error) {
        console.error(`Failed to generate audio for lesson ${lesson.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in daily lesson generation:', error);
  }

  console.log('Daily lesson generation check complete');
}

export function startScheduler(): void {
  if (schedulerInterval) {
    console.log('Scheduler already running');
    return;
  }

  // Check every hour if it's time to generate lessons
  schedulerInterval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === GENERATION_HOUR && now.getMinutes() < 5) {
      runDailyLessonGeneration();
    }
  }, 60 * 60 * 1000); // Check every hour

  console.log(`Scheduler started. Audio generation will run daily at ${GENERATION_HOUR}:00`);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Scheduler stopped');
  }
}
