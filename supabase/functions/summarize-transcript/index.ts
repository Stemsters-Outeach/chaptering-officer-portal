const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a meeting-notes assistant. You will be given a raw meeting transcript. Extract a concise, accurate digest.

Rules:
- Be concise. Each bullet is one clear sentence, no filler.
- Only include a decision if the transcript shows the group actually agreed on it, not just discussed it.
- If a category has nothing to report, return an empty array for it - do not invent content.
- attendees are the names of people who spoke, as best you can tell from the transcript.`;

const DIGEST_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Short 5-8 word title for the meeting' },
    overview: {
      type: 'STRING',
      description: 'One or two sentence plain-language summary of what the meeting was about and where things landed',
    },
    decisions: { type: 'ARRAY', items: { type: 'STRING' } },
    action_items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          owner: { type: 'STRING', description: "Name or 'unassigned'" },
          task: { type: 'STRING' },
          due: { type: 'STRING', description: 'Deadline mentioned, or empty string if none' },
        },
        required: ['owner', 'task', 'due'],
      },
    },
    key_points: { type: 'ARRAY', items: { type: 'STRING' } },
    open_questions: { type: 'ARRAY', items: { type: 'STRING' } },
    attendees: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['title', 'overview', 'decisions', 'action_items', 'key_points', 'open_questions', 'attendees'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server is missing GEMINI_API_KEY. Set it with `supabase secrets set`.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let transcript: string;
  try {
    const body = await req.json();
    transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!transcript) {
    return new Response(JSON.stringify({ error: 'No transcript provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: transcript }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: DIGEST_SCHEMA,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message ?? 'Gemini API error' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
      return new Response(JSON.stringify({ error: 'The model declined to summarize this transcript.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = candidate.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(JSON.stringify({ error: 'No text in model response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const digest = JSON.parse(text);
    return new Response(JSON.stringify(digest), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
