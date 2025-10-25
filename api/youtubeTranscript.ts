// /api/youtubeTranscript.ts
// New implementation based on user's suggestion.

export const config = { runtime: "edge" };

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=900", // Caching for 15 mins
    },
  });
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = (searchParams.get("videoId") || "").trim();

  if (!/^[\w-]{11}$/.test(videoId)) {
    return jsonResponse({ error: "Invalid or missing videoId" }, 400);
  }

  try {
    // Method 1: Scrape watch page for caption tracks
    console.log(`Attempting Method 1 for videoId: ${videoId}`);
    const url = `https://youtube.com/watch?v=${videoId}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });
    const html = await response.text();
    
    const timedtextRegex = /"captionTracks":(\[.*?\])/s;
    const match = html.match(timedtextRegex);
    
    if (!match) {
      throw new Error('No captionTracks array found in page HTML');
    }
    
    const tracks = JSON.parse(match[1]);
    
    const track = tracks.find((t: any) => t.languageCode === 'en') 
             || tracks.find((t: any) => t.languageCode.startsWith('en'))
             || tracks.find((t: any) => t.kind !== 'asr')
             || tracks[0];
    
    if (!track || !track.baseUrl) {
      throw new Error('No suitable caption track found in captionTracks');
    }
    
    const captionResponse = await fetch(track.baseUrl);
    const xmlText = await captionResponse.text();
    
    const textMatches = xmlText.matchAll(/<text[^>]*>(.*?)<\/text>/g);
    const transcript = Array.from(textMatches)
      .map(matchResult => {
        return matchResult[1]
          .replace(/&amp;#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<[^>]+>/g, '');
      })
      .join(' ')
      .trim();

    if (!transcript) {
        throw new Error("Extracted transcript from XML is empty.");
    }
    
    console.log(`Method 1 successful for videoId: ${videoId}`);
    return jsonResponse({ videoId, transcript });
    
  } catch (error) {
    console.error(`Method 1 failed for ${videoId}:`, error);
    
    // Method 2: Fallback to third-party API
    try {
      console.log(`Attempting Method 2 (fallback) for videoId: ${videoId}`);
      const fallbackResponse = await fetch(
        `https://youtube-transcript-api.vercel.app/api/transcript?videoId=${videoId}`
      );

      if (!fallbackResponse.ok) {
          throw new Error(`Fallback API returned status ${fallbackResponse.status}`);
      }

      const data = await fallbackResponse.json();
      
      if (data.error) throw new Error(data.error);
      
      const transcript = data.transcript.map((t: any) => t.text).join(' ').trim();
      
      if (!transcript) {
          throw new Error("Fallback API returned an empty transcript.");
      }

      console.log(`Method 2 successful for videoId: ${videoId}`);
      return jsonResponse({ videoId, transcript });

    } catch (fallbackError) {
      console.error(`Method 2 failed for ${videoId}:`, fallbackError);
      return jsonResponse({ error: 'Unable to fetch transcript from any source' }, 500);
    }
  }
}
