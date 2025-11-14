// services/youtubeTranscriptService.ts
export type TranscriptPayload = { videoId: string; transcript: string | null; error?: string };

export function extractYouTubeId(input: string): string | null {
  // If the input is just the 11-character ID, it's valid.
  if (/^[\w-]{11}$/.test(input.trim())) {
    return input.trim();
  }

  try {
    // We need a base URL if the input is a path like /watch?v=...
    const url = new URL(input, 'https://www.youtube.com');
    
    // Handle youtu.be short URLs (e.g., youtu.be/dQw4w9WgXcQ)
    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.slice(1).split('/')[0];
      if (/^[\w-]{11}$/.test(videoId)) {
        return videoId;
      }
    }

    // Handle youtube.com, m.youtube.com, music.youtube.com etc.
    if (url.hostname.endsWith('youtube.com')) {
      // Standard watch URL (e.g., youtube.com/watch?v=dQw4w9WgXcQ)
      const videoIdFromQuery = url.searchParams.get('v');
      if (videoIdFromQuery && /^[\w-]{11}$/.test(videoIdFromQuery)) {
        return videoIdFromQuery;
      }

      // Path-based URLs (e.g., youtube.com/embed/..., /shorts/..., /live/...)
      const pathMatches = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (pathMatches && pathMatches[1]) {
        return pathMatches[1];
      }
    }
  } catch (error) {
    // If URL parsing fails, it might be a malformed URL or just text.
    // We can still try a regex for good measure on the raw string.
  }
  
  // Fallback regex for cases where URL parsing fails or for non-standard formats
  const regexMatch = input.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([\w-]{11})/);
  if (regexMatch && regexMatch[1]) {
    return regexMatch[1];
  }

  return null;
}


export async function fetchTranscript(videoRef: string): Promise<TranscriptPayload> {
  const id = extractYouTubeId(videoRef);
  if (!id) {
    return { videoId: '', transcript: null, error: 'Invalid YouTube URL or video ID' };
  }

  const cacheKey = `yt-transcript-${id}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      sessionStorage.removeItem(cacheKey);
    }
  }

  try {
    const res = await fetch(`/api/youtubeTranscript?videoId=${id}`);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to fetch transcript' }));
      return { 
        videoId: id, 
        transcript: null, 
        error: errorData.error || 'Failed to fetch transcript from server' 
      };
    }

    const data = await res.json();
    
    if (!data.transcript || data.transcript.trim().length === 0) {
      return { 
        videoId: id, 
        transcript: null, 
        error: data.error || 'No transcript available for this video' 
      };
    }

    const result: TranscriptPayload = { 
      videoId: id, 
      transcript: data.transcript,
      error: undefined
    };
    
    sessionStorage.setItem(cacheKey, JSON.stringify(result));
    return result;

  } catch (error) {
    console.error('Fetch transcript error:', error);
    return { 
      videoId: id, 
      transcript: null, 
      error: 'Network error while fetching transcript' 
    };
  }
}