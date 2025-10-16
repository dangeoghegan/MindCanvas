import { GoogleGenAI, Type } from '@google/genai';
import { ChecklistItem } from '../types';

// FIX: Initialize the GoogleGenAI client. The API key is sourced from environment variables as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// FIX: Implemented function to generate a review summary from note context using Gemini.
export const generateReviewSummary = async (notesContext: string): Promise<string> => {
  if (!notesContext.trim()) {
    return "You didn't have any notes in this period. Capture some thoughts and come back later to reflect!";
  }

  const prompt = `Based on the following notes, provide a reflective summary of key themes, accomplishments, and potential areas for growth. Format the output with markdown, using headings for different sections.

  Notes:
  ---
  ${notesContext}
  ---
  
  Your summary should be insightful and encouraging.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful assistant that creates insightful summaries from user's notes to help them reflect on their progress and thoughts."
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
        text: "Please transcribe and then provide a concise summary of the following audio."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing audio:', error);
        return 'Failed to summarize audio.';
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
        text: "Please provide a concise summary of this video."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [videoPart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing video:', error);
        return 'Failed to summarize video.';
    }
};

// FIX: Implemented function to generate a description for an image.
export const generateImageDescription = async (imageBase64: string, mimeType: string): Promise<string> => {
    const imagePart = {
        inlineData: { data: imageBase64, mimeType },
    };
    const textPart = {
        text: "Provide a concise summary of this image. Describe the main subject, setting, and any notable actions or features."
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });
        return response.text;
    } catch (error) {
        console.error('Error generating image description:', error);
        return '';
    }
};

// FIX: Implemented function to generate a title for a note.
export const generateTitle = async (noteContext: string): Promise<string> => {
    const prompt = `Based on the following note content, suggest a short, descriptive title (5 words or less). Only return the title text, without any prefixes like "Title:".

    Note Content:
    ---
    ${noteContext}
    ---`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.replace(/["']/g, "").trim();
    } catch (error) {
        console.error('Error generating title:', error);
        return 'Untitled Note';
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
    const prompt = `Based on the URL of this video, which is likely from a platform like YouTube or Vimeo, generate a concise one or two-sentence summary of what the video is likely about. Focus on creating a plausible summary even if you cannot access the content directly.
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
                            description: "A one or two-sentence summary of the video's likely content."
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