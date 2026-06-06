/**
 * Voice → text for clinical labels, via OpenRouter.
 *
 * OpenRouter has no dedicated Whisper endpoint, but its audio-input chat models
 * transcribe well. We use google/gemini-2.5-flash-lite — the cheapest
 * audio-capable model, fast, and strong on both English and Chinese (verified).
 */
const KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.5-flash-lite';

/** Transcribe a base64 audio clip. `format` is the container, e.g. 'm4a' | 'wav' | 'mp3'. */
export async function transcribeAudio(base64: string, format: string): Promise<string> {
  if (!KEY) throw new Error('OpenRouter key missing (EXPO_PUBLIC_OPENROUTER_API_KEY).');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe this short clinical EEG label spoken in English or Chinese. Output only the transcribed words — no punctuation, no quotes, no explanation.',
            },
            { type: 'input_audio', input_audio: { data: base64, format } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
  const j = await res.json();
  return (j?.choices?.[0]?.message?.content ?? '').trim();
}
