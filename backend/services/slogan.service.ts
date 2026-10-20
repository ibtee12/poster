import { env } from "@/backend/config/env";

export interface SloganSuggestionOptions {
  text: string;
  maxChars?: number;
  category?: string;
}

/**
 * Generate polished Bengali poster slogans / variations using Gemini Flash.
 */
export async function getBanglaSloganSuggestions({
  text,
  maxChars = 60,
  category,
}: SloganSuggestionOptions): Promise<string[]> {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Slogan suggestion skipped.");
    return [];
  }

  const trimmed = text.trim();
  if (trimmed.length < 2) return [];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  const prompt = `You are a master Bengali (বাংলা) copywriter and poet for banners and posters.
The user wrote this draft slogan or title for a poster: "${trimmed}".
${category ? `Poster Theme / Context: "${category}".` : ""}
Task: Suggest 3 to 4 refined, catchy, culturally authentic, and impactful variations in Bengali script.
Constraints:
- Each suggestion MUST be concise and strictly under ${maxChars} characters so it fits on a poster banner.
- Tone variations: provide a mix of rhythmic/rhyming (ছন্দময়), respectful/formal (মার্জিত), and bold/inspirational (উদ্বুদ্ধকরণ).
- Do not repeat the exact input.
- Return ONLY a valid JSON array of strings in Bengali, with no markdown code fences or explanations.
Example output format:
["জনগণের প্রিয় নেতার জন্মদিনে রক্তিম শুভেচ্ছা", "শুভ জন্মদিন! আপনার দীর্ঘায়ু ও সুস্থতা কামনা করি", "নেতৃত্বের অনুপ্রেরণা — জন্মদিনের শুভেচ্ছা"]`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second safety timeout

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error generating slogans:", response.status, errText);
      return [];
    }

    const data = await response.json();
    const candidateText: string | undefined =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) return [];

    // Extract JSON array even if wrapped in markdown codeblock
    const cleaned = candidateText
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    const suggestions = parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((s) => s.length > 0 && s !== trimmed && s.length <= maxChars + 20);

    return suggestions.slice(0, 4);
  } catch (err: any) {
    console.error("Failed to generate Bengali slogan suggestions:", err?.message || err);
    return [];
  }
}
