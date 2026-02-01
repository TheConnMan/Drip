import type { Course, Lesson } from '../../shared/schema';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatRfc2822Date(date: Date): string {
  return date.toUTCString();
}

function truncateDescription(content: string, maxLength: number = 200): string {
  // Strip any HTML/markdown and truncate
  const plainText = content.replace(/<[^>]*>/g, '').replace(/[#*_`]/g, '');
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength).trim() + '...';
}

export function generateRssFeed(course: Course, lessons: Lesson[]): string {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

  // Filter to only include lessons with audio
  const publishedLessons = lessons.filter(
    (lesson) => lesson.audioUrl && lesson.createdAt
  );

  const items = publishedLessons
    .map((lesson) => {
      const episodeTitle = `Day ${lesson.sessionNumber}: ${lesson.title}`;
      const episodeDescription = truncateDescription(lesson.content);
      const pubDate = formatRfc2822Date(new Date(lesson.createdAt));
      const duration = formatDuration(lesson.audioDurationSeconds || 300);

      return `
    <item>
      <title>${escapeXml(episodeTitle)}</title>
      <description>${escapeXml(episodeDescription)}</description>
      <enclosure url="${escapeXml(lesson.audioUrl!)}" length="${lesson.audioFileSize || 0}" type="audio/mpeg"/>
      <guid isPermaLink="false">lesson-${lesson.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:episode>${lesson.sessionNumber}</itunes:episode>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
    })
    .join('\n');

  const channelDescription = course.description || `A ${course.totalLessons}-day course on ${course.title}`;
  const lastBuildDate = publishedLessons.length > 0
    ? formatRfc2822Date(new Date(publishedLessons[publishedLessons.length - 1].createdAt))
    : formatRfc2822Date(new Date(course.createdAt));

  const feedUrl = course.rssFeedUrl || `${baseUrl}/feed/${course.id}.xml`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(course.title)}</title>
    <description>${escapeXml(channelDescription)}</description>
    <link>${baseUrl}</link>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <itunes:author>Drip</itunes:author>
    <itunes:summary>${escapeXml(channelDescription)}</itunes:summary>
    <itunes:category text="Education">
      <itunes:category text="Self-Improvement"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>serial</itunes:type>
    <itunes:complete>${publishedLessons.length >= (course.totalLessons || 0) ? 'yes' : 'no'}</itunes:complete>
${items}
  </channel>
</rss>`;
}

export function getRssFeedUrl(courseId: number): string {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  return `${baseUrl}/feed/${courseId}.xml`;
}
