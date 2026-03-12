import { GoogleGenAI, Type } from "@google/genai";

export interface MaterialAnalysis {
  name: string;
  standardPeaks: number[];
  matchConfidence: string;
  analysis: string;
}

export interface GeminiAnalysisResult {
  materials: MaterialAnalysis[];
  overallAnalysis: string;
}

export async function analyzeXRD(materials: string[], observedPeaks: number[]): Promise<GeminiAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
  
  const prompt = `You are an expert crystallographer and materials scientist.
I have an X-ray diffraction (XRD) spectrum with the following main observed peaks (2Theta in degrees, assuming Cu K-alpha radiation):
[${observedPeaks.map(p => p.toFixed(2)).join(', ')}]

The user suspects the presence of the following materials/phases:
[${materials.join(', ')}]

Please use Google Search to find the standard Bragg peak positions (2Theta) for these specific materials.
Then, verify if these user-defined materials are consistent with the observed peaks provided.

Return a detailed JSON response.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          materials: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                standardPeaks: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  description: "Standard 2Theta Bragg peak positions (in degrees) for this material."
                },
                matchConfidence: { type: Type.STRING, description: "High, Medium, or Low" },
                analysis: { type: Type.STRING, description: "Brief explanation of the match." }
              },
              required: ["name", "standardPeaks", "matchConfidence", "analysis"]
            }
          },
          overallAnalysis: { type: Type.STRING, description: "Overall conclusion about the phase composition." }
        },
        required: ["materials", "overallAnalysis"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  return JSON.parse(text) as GeminiAnalysisResult;
}
