// This file is intended to be run in a serverless environment (e.g., Vercel, Netlify).
// It requires the 'youtube-transcript' package to be installed in that environment.
import { YoutubeTranscript } from 'youtube-transcript';

// Assuming a Vercel-like request/response API.
// In a real project, you would import types from '@vercel/node' or a similar package.
type VercelRequest = { query: { [key: string]: string | string[] } };
type VercelResponse = {
  status: (code: number) => { json: (body: any) => void };
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const { videoId } = request.query;

  if (!videoId || typeof videoId !== 'string') {
    return response.status(400).json({ error: 'A "videoId" query parameter is required.' });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript || transcript.length === 0) {
      return response.status(404).json({ error: 'No transcript available for this video.' });
    }
    // Concatenate all transcript parts into a single string.
    const fullTranscript = transcript.map(item => item.text).join(' ');
    return response.status(200).json({ transcript: fullTranscript });
  } catch (error: any) {
    console.error(`Error fetching transcript for videoId ${videoId}:`, error);
    
    const errorMessage = error.message || String(error);

    if (errorMessage.includes('subtitles are disabled')) {
      return response.status(404).json({ error: 'Transcripts are disabled for this video.' });
    }
    if (errorMessage.includes('No transcripts found')) {
      return response.status(404).json({ error: 'No transcripts were found for this video. It might be a music video or have no captions.' });
    }
    
    return response.status(500).json({ error: 'An unexpected error occurred while fetching the transcript.' });
  }
}
