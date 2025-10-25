import { GoogleGenAI, Type, Modality } from '@google/genai';
import { ChecklistItem, VoiceName, ContentBlock } from '../types';
import { fetchTranscript, extractYouTubeId as extractYouTubeVideoId } from './youtubeTranscriptService';

export { extractYouTubeVideoId };

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Start of AI Helper with Retry Logic ---
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2500; // Start with a 2.5-second backoff

/**
 * A wrapper for ai.models.generateContent that includes exponential backoff retry logic
 * for rate-limiting errors (429 RESOURCE_EXHAUSTED).
 */
const generateContentWithRetry = async (params: any) => {
  let retries = 0;
  while (true) {
    try {
      const response = await ai.models.generateContent(params);
      return response;
    } catch (error) {
      // Convert error to string to safely check for rate limit messages
      const errorString = JSON.stringify(error);
      const isRateLimitError = errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429');
      
      if (isRateLimitError && retries < MAX_RETRIES) {
        retries++;
        // Exponential backoff with jitter
        const backoffTime = INITIAL_BACKOFF_MS * (2 ** (retries - 1)) + Math.random() * 1000;
        console.warn(
          `Rate limit exceeded. Retrying in ${Math.round(backoffTime / 1000)}s... (Attempt ${retries}/${MAX_RETRIES})`
        );
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        // Re-throw if it's not a rate limit error or if max retries are exceeded
        console.error(`Final error after ${retries} retries:`, error);
        throw error;
      }
    }
  }
};
// --- End of AI Helper ---


// Answer questions about a YouTube video using its transcript
export const answerQuestionAboutYouTubeVideo = async (
  videoUrl: string,
  question: string
): Promise<string> => {
  try {
    console.log('Fetching transcript for video:', videoUrl);
    const transcriptPayload = await fetchTranscript(videoUrl);
    
    const transcript = transcriptPayload?.transcript || null;

    if (!transcript || transcript.trim().length === 0) {
      const errorMessage = transcriptPayload?.error || 'The video may not have captions available, or the transcript could not be retrieved.';
      return `Unable to fetch the transcript for this video. Reason: ${errorMessage}`;
    }

    console.log('Transcript fetched successfully. Length:', transcript.length);

    const prompt = `You are analyzing a YouTube video transcript to answer a specific question.

Video Transcript:
---
${transcript.substring(0, 15000)}
---

User Question: "${question}"

Based ONLY on the information in the transcript above, provide a comprehensive and accurate answer. If the answer cannot be found in the transcript, clearly state that.`;

    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful assistant that answers questions based strictly on the content of a YouTube video transcript. Provide accurate, detailed answers based on what's actually said in the video."
      }
    });

    return response.text;
  } catch (error) {
    console.error('Error answering question about YouTube video:', error);
    return 'Sorry, I encountered an error while processing your question about the video.';
  }
};


export const getConversationalSystemInstruction = (notesContext: string): string => {
    return `You are Granula, a friendly and helpful conversational AI. Your task is to answer questions based *only* on the provided context from a user's notes. The user will be speaking to you in English.
    
    RULES:
    - Transcribe the user's speech accurately in English only. Ignore non-speech sounds.
    - Keep your spoken responses concise and conversational.
    - If the answer to a question isn't in the provided notes, clearly state that. Do not guess.
        
    Context from user's notes:
    ---
    ${notesContext}
    ---`;
};

export const generateReviewSummary = async (notesContext: string, period: string, people: string[]): Promise<string> => {
  if (!notesContext.trim()) {
    return "You didn't have any notes in this period. Capture some thoughts and come back later to reflect!";
  }
  
  const wordCountMap = {
      'weekly': '160–220 words',
      'monthly': '220–280 words',
      'quarterly': '280–340 words',
      'semi-annually': '280–340 words',
      'yearly': '280–340 words',
  };
  const wordCount = wordCountMap[period as keyof typeof wordCountMap] || '220–280 words';

  let systemInstruction = `You are a reflective AI assistant, Granula. Your task is to analyse a user's notes from a specific period and generate a structured, insightful review. Adhere strictly to the provided format, tone, and rules.

Your output MUST be a single block of Markdown.

**Structure & Formatting:**

1.  **Reflection:** Start with a single blockquote containing one insightful sentence.
    Example: \`> I'm learning that clarity turns input into insight.\`

2.  **Top 3 Moments:** A Level-2 Markdown header: \`## ⚡ Top 3 Moments\`. Followed by exactly three moments. Each moment starts with a Level-3 header: \`### Title of Moment\`.
    - Under the title, include the following on separate lines:
      - \`_Source/Type_\` (in italics)
      - \`**Why it matters:** [explanation]\`
      - \`**Learning:** [takeaway]\`
      - \`**Signal:**\` followed by one or more inline code blocks for tags (e.g., \`\`#media-literacy\`\`).
      - \`**Valence:** [emoji, e.g., 👍, 😬, ✅]\`

3.  **Key Learnings:** A Level-2 Markdown header: \`## 🧠 Key Learnings\`. Followed by a bulleted list of 3-5 compact insights. Each bullet should be a rule or pattern.
    - Format: \`- **Pattern Name:** Insight.\`

4.  **Trends:** A Level-2 Markdown header: \`## 📈 Trends\`. Followed by a bulleted list of up to 3 one-line qualitative shifts. Use italics for emphasis and emojis (📈, 📉, steady).
    - Format: \`- Focus tilting toward _leadership clarity_.\`

**Writing Rules:**
- Use Australian English spelling only (e.g., 'summarise', 'colour').
- The total review length must be **${wordCount}**. Do not exceed this.
- As notes increase, increase information density, not word count. Prioritise high-salience ideas.
- Use short noun phrases, active verbs, and no filler.

**Tone & Voice:**
- Calm, clear, and confident—like a "future-you" coaching "present-you".
- Conversational, not corporate. Avoid clichés ("journey", "growth mindset").
- Every sentence must feel earned and insightful.
- Write as if for a private reflection dashboard.
`;

    if (people && people.length > 0) {
        systemInstruction += `\n**Contextualization:** The notes from this period involve the following people: ${people.join(', ')}. You should incorporate these names when summarizing moments or learnings they were part of to provide better context.`;
    }

  const prompt = `Here are my notes for the last ${period}. Please generate my review based on them.

Notes:
---
${notesContext}
---

Follow the instructions precisely and generate the review in the specified markdown format.`;

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction
      }
    });
    return response.text;
  } catch (error) {
    console.error('Error generating review summary:', error);
    if (error && String(JSON.stringify(error)).includes('RESOURCE_EXHAUSTED')) {
         return 'Rate limit exceeded. Please wait a moment before trying again.';
    }
    return 'Sorry, I was unable to generate a summary at this time.';
  }
};

export const generateChecklistFromAudio = async (audioBase64: string, mimeType: string): Promise<ChecklistItem[]> => {
    const audioPart = {
        inlineData: {
            data: audioBase64,
            mimeType: mimeType,
        },
    };
    const textPart = { text: "Listen to the audio and extract any action items or tasks mentioned. Format them as a JSON array of objects. Each object should have a 'text' property with the task description." };

    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING, description: 'The text of the checklist item.' },
                        },
                        required: ['text'],
                    },
                },
            },
        });
        const jsonStr = response.text.trim();
        const items = JSON.parse(jsonStr);
        return items.map((item: {text: string}) => ({
            id: self.crypto.randomUUID(),
            text: item.text,
            checked: false,
        }));
    } catch (error) {
        console.error('Error generating checklist from audio:', error);
        return [];
    }
};

export const summarizeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
    const audioPart = {
        inlineData: {
            data: audioBase64,
            mimeType: mimeType,
        },
    };
    const textPart = { text: "Listen to the audio and provide a concise one or two-sentence summary of its content." };

    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing audio:', error);
        throw new Error('AI could not summarize the audio.');
    }
};

export const summarizeVideo = async (videoBase64: string, mimeType: string): Promise<string> => {
    // This is a simplified approach. For better results, one would typically extract frames
    // and audio, but we'll let the model handle the video file directly.
    const videoPart = { inlineData: { data: videoBase64, mimeType } };
    const textPart = { text: "Provide a brief, one-sentence summary of this video." };
    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: { parts: [videoPart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing video:', error);
        throw new Error('AI could not summarize the video.');
    }
};

export const generateImageDescription = async (imageBase64: string, mimeType: string, people: string[]): Promise<string> => {
    const imagePart = { inlineData: { data: imageBase64, mimeType } };
    let prompt = "Describe this image in a single, concise sentence. Focus on the main subject and action. Do not describe the physical appearance of any people identified.";
    if (people.length > 0) {
        prompt += ` The following people have been identified in the image: ${people.join(', ')}. Use their names directly in the description instead of generic terms like 'a man' or 'a woman'.`;
    }

    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
        });
        return response.text;
    } catch (error) {
        console.error('Error generating image description:', error);
        throw new Error('Could not generate image description.');
    }
};

export const generateTitle = async (noteContext: string, people: string[]): Promise<string> => {
    let prompt = `Analyze the following note content and generate a concise, descriptive title (under 8 words). The title should capture the main theme or subject. Do not use quotes.`;
    if (people.length > 0) {
      prompt += `\nThe note involves: ${people.join(', ')}. Try to incorporate them if it makes sense.`;
    }
    prompt += `\n\nNote Content:\n---\n${noteContext}`;
    
    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.replace(/["']/g, "").trim();
    } catch (error) {
        console.error('Error generating title:', error);
        throw new Error('Could not generate title.');
    }
};

export const answerQuestionFromContext = async (question: string, context: string): Promise<{ answer: string, sources: { noteTitle: string }[] }> => {
    const systemInstruction = `You are Granula, an AI assistant. Answer the user's question based *only* on the provided notes context. If the answer is not in the context, say so. After the answer, list the titles of the notes you used as sources, formatted like this: "SOURCES: Note Title 1, Note Title 2".`;
    
    const prompt = `Context:\n---\n${context}\n---\n\nQuestion: ${question}`;

    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction
            }
        });

        const responseText = response.text;
        const parts = responseText.split('SOURCES:');
        const answer = parts[0].trim();
        const sourcesString = parts[1] || '';
        const sources = sourcesString.split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(noteTitle => ({ noteTitle }));

        return { answer, sources };
    } catch (error) {
        console.error('Error answering question from context:', error);
        throw new Error('Could not answer question.');
    }
};

export const generateTagsForNote = async (noteContext: string): Promise<string[]> => {
    const prompt = `Analyze the note content and generate 3-5 relevant, specific, lower-case, single-word or two-word-hyphenated tags. Output as a JSON array of strings. For example: ["productivity", "meeting-notes", "project-phoenix"].\n\nNote Content:\n---\n${noteContext}`;
    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                },
            },
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('Error generating tags:', error);
        throw new Error('Could not generate tags.');
    }
};

export const summarizePdf = async (pdfBase64: string, mimeType: string): Promise<string> => {
    const pdfPart = { inlineData: { data: pdfBase64, mimeType } };
    const prompt = "Summarize the key points of this PDF document in a few sentences.";
    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash',
            contents: { parts: [pdfPart, { text: prompt }] },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing PDF:', error);
        throw new Error('Could not summarize PDF.');
    }
};

export const getYouTubeThumbnail = (videoId: string): string => `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

export const getWebsiteThumbnail = (url: string): string => `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=400`;

export const getYouTubeVideoInfo = async (videoId: string): Promise<{ title: string; author: string; }> => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!response.ok) throw new Error('Failed to fetch video info');
    const data = await response.json();
    return { title: data.title || 'YouTube Video', author: data.author_name || 'Unknown Creator' };
  } catch (error) {
    console.error('Error fetching YouTube info:', error);
    return { title: 'YouTube Video', author: 'Unknown Creator' };
  }
};

export const generateYouTubeSummaryFromTitle = async (title: string): Promise<string> => {
  const prompt = `Based on this YouTube video title: "${title}"\n\nWrite a brief 25-word summary of what this video is likely about. Just provide the summary text, nothing else.`;
  try {
    const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text;
  } catch (error) {
    console.error('Error generating summary from title:', error);
    return 'Summary not available.';
  }
};

const parseStructuredResponse = (responseText: string, url: string): { title: string; summary: string } => {
  try {
    const titleMatch = responseText.match(/Title:\s*(.+?)(?:\n|$)/i);
    const summaryMatch = responseText.match(/Summary:\s*(.+?)(?:\n|$)/i);
    let title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    let summary = summaryMatch ? summaryMatch[1].trim() : 'Summary not available.';
    return { title, summary };
  } catch (error) {
    return { title: new URL(url).hostname, summary: 'Summary not available.' };
  }
};

export const generateWebsiteSummary = async (url: string): Promise<{ title: string; summary: string }> => {
  const prompt = `Analyze this website: ${url}\n\nPlease provide the following information in this EXACT format:\nTitle: [The website's title or main heading]\nSummary: [A 25-word summary of the website]\n\nDo not include any other text.`;
  try {
    const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: prompt, config: { tools: [{ googleSearch: {} }] } });
    return parseStructuredResponse(response.text, url);
  } catch (error) {
    console.error('Error generating website summary:', error);
    throw new Error('Could not generate website summary.');
  }
};

export const summarizeGoogleWorkspaceDoc = async (url: string): Promise<{ title: string; summary: string }> => {
  const prompt = `Analyze this Google Workspace document: ${url}\n\nPlease provide the following information in this EXACT format:\nTitle: [The document's title or main heading]\nSummary: [A 25-word summary of the document]`;
  try {
    const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: prompt, config: { tools: [{ googleSearch: {} }] } });
    return parseStructuredResponse(response.text, url);
  } catch (error) {
    throw new Error('Could not summarize the document. It may not be public.');
  }
};

export const generateEnhancedSummary = async (title: string, type: 'youtube' | 'website' | 'doc'): Promise<string> => {
  const prompt = `Based on this ${type === 'youtube' ? 'YouTube video' : 'website'} title: "${title}"

Analyze the title carefully and provide a specific, detailed 75-word summary about what this content likely contains. Be specific about the topic.

Format using markdown with ## headings, ### subheadings, **bold**, and - bullet points.`;
  try {
    const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text;
  } catch (error) {
    throw new Error('Could not generate enhanced summary.');
  }
};

export const askQuestionAboutEmbeddedContent = async (content: ContentBlock['content'], question: string, chatHistory: { role: 'user' | 'model'; text: string }[]): Promise<string> => {
    const history = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
    const systemInstruction = `You are a helpful AI assistant. Your task is to answer questions about specific content. Prioritize finding a transcript or detailed text using your search tool, guided by the title, summary, and URL. If you can't find a specific answer, say so.`;
    const prompt = `CONTENT CONTEXT:\n- Type: ${content.url?.includes('youtube') ? 'YouTube Video' : 'Website'}\n- Title: "${content.title}"\n- Summary: "${content.summary}"\n- URL: ${content.url}\n\nPREVIOUS CONVERSATION:\n${history}\n\nUSER'S NEW QUESTION:\n${question}\n\nPlease provide an accurate answer based on the content.`;
    try {
        const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, tools: [{ googleSearch: {} }] } });
        return response.text;
    } catch (error) {
        throw new Error('Could not get an answer.');
    }
};

export const answerQuestionAboutImage = async (imageBase64: string, mimeType: string, question: string): Promise<string> => {
    const imagePart = { inlineData: { data: imageBase64, mimeType } };
    const textPart = { text: question };
    try {
        const response = await generateContentWithRetry({ model: 'gemini-2.5-flash', contents: { parts: [imagePart, textPart] } });
        return response.text;
    } catch (error) {
        throw new Error('Could not get an answer about the image.');
    }
};

export const generateVoicePreview = async (voice: VoiceName): Promise<string> => {
    try {
        const response = await generateContentWithRetry({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: 'Hello! This is a preview of my voice.' }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data received from API.");
        return base64Audio;
    } catch (error) {
        throw new Error(`Could not generate voice preview for ${voice}.`);
    }
};