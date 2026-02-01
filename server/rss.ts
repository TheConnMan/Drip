import type { Course, Lesson } from "@shared/schema";

/**
 * Escapes special XML characters in a string
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Converts a Date to RFC 2822 format for RSS compatibility
 * Example: "Mon, 01 Jan 2024 12:00:00 GMT"
 */
function toRfc2822(date: Date): string {
  return date.toUTCString();
}

/**
 * Formats duration in seconds to HH:MM:SS for iTunes duration
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * Generates an RSS 2.0 podcast feed with iTunes extensions
 */
export function generateRssFeed(course: Course, lessons: Lesson[], baseUrl: string): string {
  // Sort lessons by sessionNumber (lessonOrder)
  const sortedLessons = [...lessons]
    .filter(lesson => lesson.audioStorageKey) // Only include lessons with audio
    .sort((a, b) => a.sessionNumber - b.sessionNumber);

  const feedUrl = `${baseUrl}/api/courses/${course.id}/rss`;
  const courseDescription = course.description || `Learn about ${course.title}`;

  const items = sortedLessons.map((lesson, index) => {
    const audioUrl = `${baseUrl}/audio/${lesson.id}`;
    const pubDate = lesson.audioGeneratedAt
      ? toRfc2822(new Date(lesson.audioGeneratedAt))
      : toRfc2822(new Date(lesson.createdAt));
    const duration = lesson.audioDurationSeconds
      ? formatDuration(lesson.audioDurationSeconds)
      : "5:00";
    const fileSize = lesson.audioFileSize || 0;
    const lessonDescription = lesson.subtitle || lesson.title;

    return `    <item>
      <title>${escapeXml(lesson.title)}</title>
      <description>${escapeXml(lessonDescription)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">drip-lesson-${lesson.id}</guid>
      <enclosure url="${escapeXml(audioUrl)}" length="${fileSize}" type="audio/mpeg" />
      <itunes:title>${escapeXml(lesson.title)}</itunes:title>
      <itunes:summary>${escapeXml(lessonDescription)}</itunes:summary>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:episode>${index + 1}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
  }).join("\n");

  const lastBuildDate = sortedLessons.length > 0
    ? toRfc2822(new Date(Math.max(...sortedLessons.map(l =>
        new Date(l.audioGeneratedAt || l.createdAt).getTime()
      ))))
    : toRfc2822(new Date(course.createdAt));

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(course.title)}</title>
    <description>${escapeXml(courseDescription)}</description>
    <link>${escapeXml(baseUrl)}</link>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <itunes:author>Drip</itunes:author>
    <itunes:summary>${escapeXml(courseDescription)}</itunes:summary>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>serial</itunes:type>
    <itunes:owner>
      <itunes:name>Drip</itunes:name>
    </itunes:owner>
    <itunes:category text="Education" />
${items}
  </channel>
</rss>`;
}
