import { GoogleGenAI, Type } from '@google/genai';
import { ChecklistItem } from '../types';

// FIX: Initialize the GoogleGenAI client. The API key is sourced from environment variables as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Implemented function to generate a review summary from note context using Gemini.
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

  let systemInstruction = `You are a reflective AI assistant, MindCanvas. Your task is to analyse a user's notes from a specific period and generate a structured, insightful review. Adhere strictly to the provided format, tone, and rules.

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
    const response = await ai.models.generateContent({
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

// FIX: Implemented function to generate a checklist from an audio recording.
export const generateChecklistFromAudio = async (audioBase64: string, mimeType: string): Promise<ChecklistItem[]> => {
    const audioPart = {
        inlineData: {
            data: audioBase64,
            mimeType: mimeType,
        },
    };
    const textPart = { text: "Listen to the audio and extract any action items or tasks mentioned. Format them as a JSON array of objects. Each object should have a 'text' property with the task description." };

    try {
        const response = await ai.models.generateContent({
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

// FIX: Implemented function to summarize an audio recording.
export const summarizeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
    const audioPart = {
        inlineData: { data: audioBase64, mimeType },
    };
    const textPart = {
        text: "Your task is to analyze the provided audio.\n1. **Transcribe:** First, provide a full and accurate transcription of the audio.\n2. **Summarize:** After the transcription, add a `---` separator. Then, using the transcription you just generated, provide a concise summary in 25 words or less."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [audioPart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing audio:', error);
        throw error;
    }
};

// FIX: Implemented function to ask a question about an image.
export const askQuestionAboutImage = async (imageBase64: string, mimeType: string, question: string): Promise<string> => {
    const imagePart = {
        inlineData: { data: imageBase64, mimeType },
    };
    const textPart = { text: question };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error asking question about image:', error);
        return 'Sorry, I could not analyze the image.';
    }
};

export const summarizeVideo = async (videoBase64: string, mimeType: string): Promise<string> => {
    const videoPart = {
        inlineData: { data: videoBase64, mimeType },
    };
    const textPart = {
        text: "Your task is to analyze the provided video.\n1. **Transcribe:** First, provide a full and accurate transcription of all spoken words in the video.\n2. **Summarize:** After the transcription, add a `---` separator. Then, using both the visual content of the video and the transcription you just generated, provide a concise summary of the video in 25 words or less. The summary should describe the key actions, subjects, and overall theme.\nIf there is no speech, simply write 'No speech detected.' for the transcription part and then proceed with the summary."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [videoPart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing video:', error);
        throw error;
    }
};

// FIX: Implemented function to generate a description for an image.
export const generateImageDescription = async (imageBase64: string, mimeType: string): Promise<string> => {
    const imagePart = {
        inlineData: { data: imageBase64, mimeType },
    };
    const textPart = {
        text: "Provide a concise summary of this image in 25 words or less. Describe the main subject, setting, and any notable actions or features."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error generating image description:', error);
        throw error;
    }
};

// FIX: Implemented function to generate a title for a note.
export const generateTitle = async (noteContext: string, people: string[]): Promise<string> => {
    let prompt = `Based on the following note content, suggest a short, descriptive title (5 words or less). Only return the title text, without any prefixes like "Title:".`;

    if (people && people.length > 0) {
        prompt += `\n\nThe note involves these people: ${people.join(', ')}. You should incorporate their names into the title if the content is about them.`;
    }

    prompt += `

    Note Content:
    ---
    ${noteContext}
    ---`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        const title = response.text.replace(/["']/g, "").trim();
        if (!title) {
            throw new Error("Generated title was empty");
        }
        return title;
    } catch (error) {
        console.error('Error generating title:', error);
        throw error;
    }
};

// FIX: Implemented function to answer questions based on the context of all notes, with sourcing.
export const answerQuestionFromContext = async (
    question: string,
    context: string,
): Promise<{ answer: string; sources: { type: 'note'; noteTitle: string; }[] }> => {
    const prompt = `
    Context from user's notes:
    ---
    ${context}
    ---

    Question: "${question}"

    Based *only* on the provided context, answer the user's question. Also, identify which notes (by their title, which starts with "## Note:") were used to formulate the answer. If the answer cannot be found in the context, state that clearly.
    `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "You are a helpful AI assistant that answers questions based *only* on the provided context from a user's notes. You must cite the title of the note(s) used as sources. If the answer isn't in the notes, say so.",
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: {
                            type: Type.STRING,
                            description: "The answer to the user's question, based strictly on the provided context."
                        },
                        sources: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                                description: "The title of a note used as a source."
                            }
                        }
                    },
                    required: ['answer', 'sources']
                }
            }
        });
        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        const noteSourceTitles: string[] = result.sources || [];
        const noteSources = noteSourceTitles.map(title => ({ type: 'note' as const, noteTitle: title }));
        return { answer: result.answer, sources: noteSources };
    } catch (error) {
        console.error('Error answering question from context:', error);
        return { answer: "Sorry, I encountered an error while processing your question.", sources: [] };
    }
};

export const generateLinkPreview = async (url: string): Promise<{ title: string; summary: string }> => {
    const prompt = `Analyze the following URL and generate a concise title and a one-sentence summary for a link preview.
URL: "${url}"

If you cannot access the URL directly, make an educated guess based on the domain and path. For example, for a Google Docs link, the title could be "Google Document" and the summary could be "A document hosted on Google Docs." For a GitHub repository, the title could be the repo name and the summary could describe it as a code repository.
Return only the JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.STRING,
                            description: "A concise title for the link."
                        },
                        summary: {
                            type: Type.STRING,
                            description: "A one-sentence summary of the link's content."
                        }
                    },
                    required: ['title', 'summary']
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('Error generating link preview:', error);
        try {
            const urlObject = new URL(url);
            const title = urlObject.hostname.replace('www.', '');
            return { title: title.charAt(0).toUpperCase() + title.slice(1), summary: `A link to ${urlObject.hostname}.` };
        } catch (e) {
             return { title: 'Invalid Link', summary: 'The provided URL could not be processed.' };
        }
    }
};

export const generateVideoSummaryFromUrl = async (url: string): Promise<{ summary: string }> => {
    const prompt = `Generate a concise summary (25 words or less) of what this video is likely about, based on its URL. The video is likely from a platform like YouTube or Vimeo, so create a plausible summary even if you cannot access the content directly.
    URL: "${url}"
    Return only a JSON object with a "summary" key.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: {
                            type: Type.STRING,
                            description: "A concise summary (25 words or less) of the video's likely content."
                        }
                    },
                    required: ['summary']
                }
            }
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('Error generating video summary from URL:', error);
        return { summary: 'Could not generate a summary for this video.' };
    }
}

export const generateTagsForNote = async (noteContext: string): Promise<string[]> => {
    const prompt = `Analyze the following note content and generate 3 to 5 relevant tags. Tags should be concise, lowercase, and use hyphens for multiple words (e.g., "project-management"). Return the tags as a JSON array of strings.

    Note Content:
    ---
    ${noteContext}
    ---`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: 'A relevant tag for the note content.'
                    }
                }
            }
        });
        const jsonStr = response.text.trim();
        const tags = JSON.parse(jsonStr);
        // Sanitize tags: lowercase and replace spaces with hyphens
        return tags.map((tag: string) => tag.toLowerCase().replace(/\s+/g, '-'));
    } catch (error) {
        console.error('Error generating tags:', error);
        return []; // Return empty array on failure
    }
};