// services/youtubeTranscriptService.ts
export type TranscriptPayload = { videoId: string; transcript: string | null; error?: string };

export function extractYouTubeId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id && /^[\w-]{11}$/.test(id)) return id;
      const m = u.pathname.match(/\/shorts\/([\w-]{11})/);
      if (m) return m[1];
    }
    if (u.hostname === "youtu.be") {
      const seg = u.pathname.slice(1);
      if (/^[\w-]{11}$/.test(seg)) return seg;
    }
  } catch {}
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