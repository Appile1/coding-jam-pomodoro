// app/api/chatai/route.js

import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();

    // Add system prompt for friendliness and interactivity
    const systemPrompt = `
You are FocusFlow's friendly productivity assistant.
- If the user greets you (e.g., says "hi", "hello"), greet them back in a friendly way.
- If the user asks for help or what you can do, briefly explain your features and offer to assist.
- Otherwise, answer their question or help with productivity, tasks, or study advice as usual.
Always be concise, positive, and helpful.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(body.messages || [])
    ];

    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.1-8b-instruct:free",
      messages,
      stream: false, // Important to avoid hanging
    });

    return new Response(
      JSON.stringify({ message: completion.choices[0].message.content }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("AI API Error:", error);
    return new Response(
      JSON.stringify({
        error: "Error fetching AI response",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
 