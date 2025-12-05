import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// Simple OpenAI-based description generator for products
serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      name = '',
      category = '',
      audience = '',
      price = 0,
      brand = '',
      currentDescription = '',
    } = body || {};

    if (!name) {
      return new Response(JSON.stringify({ error: 'Missing product name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an assistant that writes clear, attractive product descriptions for an ecommerce app.\nWrite in short paragraphs and bullet lists. Avoid hype and buzzwords. Max 180-200 words.\n\nUse this exact structure:\n\n[Product Name] – a short 1-sentence hook.\n\nKey Features:\n- bullet 1\n- bullet 2\n- bullet 3\n\nWhy you\u2019ll love it:\n- 2-3 short sentences focusing on real benefits and use cases.\n\nDetails:\n- Material / build quality (if known or can be reasonably inferred)\n- Fit / size or dimensions (if relevant)\n- Ideal occasions or scenarios.\n\nWrite in the same language as the input if it looks localized.`;

    const userPrompt = `Product data:\n- Name: ${name}\n- Brand: ${brand || 'Unknown'}\n- Category: ${category || 'general'}\n- Audience: ${audience || 'all'}\n- Price: ${price || 0}\n- Existing description (optional, you can improve or rewrite it): ${currentDescription || 'none'}\n\nNow write a well-organized description following the structure.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.65,
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error('OpenAI error:', text);
      return new Response(JSON.stringify({ error: 'OpenAI request failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const completion = await openaiRes.json();
    const description = completion?.choices?.[0]?.message?.content?.trim() || '';

    if (!description) {
      return new Response(JSON.stringify({ error: 'Empty description from OpenAI' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ description }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-product-description error', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
