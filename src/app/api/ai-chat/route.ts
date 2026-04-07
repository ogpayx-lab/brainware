import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    // Try providers in order: Anthropic → OpenAI → Gemini
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    if (anthropicKey) {
      return await callAnthropic(anthropicKey, messages, context)
    } else if (openaiKey) {
      return await callOpenAI(openaiKey, messages, context)
    } else if (geminiKey) {
      return await callGemini(geminiKey, messages, context)
    }

    return NextResponse.json({ error: 'Nessuna API key AI configurata. Aggiungi ANTHROPIC_API_KEY, OPENAI_API_KEY o GEMINI_API_KEY nelle variabili d\'ambiente.' }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore interno' }, { status: 500 })
  }
}

async function callAnthropic(apiKey: string, messages: any[], context: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: context,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const reply = data.content?.[0]?.text ?? 'Nessuna risposta.'
  return NextResponse.json({ reply })
}

async function callOpenAI(apiKey: string, messages: any[], context: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: context },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content ?? 'Nessuna risposta.'
  return NextResponse.json({ reply })
}

async function callGemini(apiKey: string, messages: any[], context: string) {
  const contents = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: context }] },
        contents,
        generationConfig: { maxOutputTokens: 2000 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Nessuna risposta.'
  return NextResponse.json({ reply })
}
