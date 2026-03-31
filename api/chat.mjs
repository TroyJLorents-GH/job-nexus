import OpenAI from "openai";
import { initFirebase, verifyToken } from "./_auth.mjs";

initFirebase();

async function handleFoundryChat(message) {
  const { ClientSecretCredential } = await import("@azure/identity");

  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID,
    process.env.AZURE_CLIENT_ID,
    process.env.AZURE_CLIENT_SECRET
  );

  const token = await credential.getToken("https://ai.azure.com/.default");

  const resp = await fetch(process.env.FOUNDRY_AGENT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.token}`,
      "aml-user-token": token.token,
    },
    body: JSON.stringify({ input: [{ role: "user", content: message }] }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Foundry agent returned ${resp.status}: ${errText}`);
  }

  const data = await resp.json();

  if (data.output_text) return data.output_text;
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === "message" && item.role === "assistant") {
        const content = item.content || [];
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "output_text" && c.text) return c.text;
          }
        } else {
          return String(content);
        }
      }
    }
  }
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;

  return "I couldn't generate a response. Please try again.";
}

async function handleOpenAIChat(message, model, mode, history) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Moderation check
  const moderation = await client.moderations.create({ input: message });
  if (moderation.results[0].flagged) {
    return { flagged: true, text: "I cannot respond to that type of content." };
  }

  const isDocQuery = message.includes("Context from uploaded documents:");

  let systemMessage, maxTokens, temperature;

  if (isDocQuery) {
    systemMessage = mode === "code"
      ? "You are a concise, friendly coding assistant with access to uploaded documents. Extract only the information needed. Provide correct, runnable code when relevant."
      : "You are a helpful AI assistant with access to uploaded documents. Answer questions based on the document content. Use markdown formatting.";
    maxTokens = 2000;
    temperature = mode === "code" ? 0.35 : 0.5;
  } else {
    systemMessage = mode === "code"
      ? "You are a concise, friendly coding assistant. Prioritize correct, runnable code. Use fenced blocks with language tags."
      : "You are a helpful, concise, and friendly general assistant. Be direct and actionable. Use markdown formatting.";
    maxTokens = 700;
    temperature = 0.3;
  }

  const supported = ["gpt-4o", "gpt-4o-mini", "gpt-5", "gpt-4.1-mini", "gpt-3.5-turbo", "gpt-4.1"];
  const normalizedModel = supported.includes(model) ? model : "gpt-5";
  const usesMaxCompletionTokens = normalizedModel.startsWith("gpt-4o") || normalizedModel.startsWith("gpt-4.1");

  // Build messages array with conversation history
  const messages = [{ role: "system", content: systemMessage }];
  if (history && Array.isArray(history)) {
    messages.push(...history.slice(-10)); // Keep last 10 messages for context
  }
  messages.push({ role: "user", content: message });

  const createArgs = {
    model: normalizedModel,
    messages,
    temperature,
    stream: true,
  };

  if (usesMaxCompletionTokens) {
    createArgs.max_completion_tokens = maxTokens;
  } else {
    createArgs.max_tokens = maxTokens;
  }

  return { stream: await client.chat.completions.create(createArgs) };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await verifyToken(req);
  if (auth.error) return res.status(401).json({ error: auth.error });

  try {
    const { message, model = "gpt-5", mode = "general", history = [] } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "No message provided." });
    }

    // Foundry Agent — no streaming (returns full response)
    if (model === "PersonalAssistant") {
      const enrichedMessage = `[System: When calling Document Intelligence API tools (getDocuments, searchDocuments, semanticSearch), always pass userId="${auth.userId}" as a query parameter.]\n\n${message}`;
      const response = await handleFoundryChat(enrichedMessage);
      return res.status(200).json({ response });
    }

    // OpenAI — stream via SSE
    const result = await handleOpenAIChat(message, model, mode, history);

    if (result.flagged) {
      return res.status(200).json({ response: result.text });
    }

    // Set SSE headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of result.stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    // If headers already sent (mid-stream error), just end
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      return res.end();
    }
    return res.status(500).json({ error: "Chat failed", detail: err.message });
  }
}
