/**
 * Free-text (or transcribed voice) → a single short clinical label, via a fast
 * OpenRouter model. Used by the patient check-in: the patient describes how they
 * feel (English or Chinese), and we store a concise label for the clinician's
 * label-review view.
 */
const KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.5-flash-lite';

const EXAMPLES = 'Dizziness, Fall, Confusion, Fatigue, Headache, Anxiety, Seizure, Movement, Normal';

/** Map a patient's free-text check-in to ONE short English clinical label. */
export async function categorizeText(text: string): Promise<string> {
  if (!KEY) throw new Error('OpenRouter key missing (EXPO_PUBLIC_OPENROUTER_API_KEY).');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 12,
      messages: [
        {
          role: 'user',
          content:
            `A patient described how they feel (English or Chinese): "${text}". ` +
            `Reply with ONE short clinical label (1-2 words, English) for the key symptom or state ` +
            `(e.g. ${EXAMPLES}). Output only the label, no punctuation.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Categorize failed (${res.status})`);
  const j = await res.json();
  return (j?.choices?.[0]?.message?.content ?? '')
    .trim()
    .replace(/["'.]/g, '')
    .split('\n')[0]
    .slice(0, 40);
}
