import { NextRequest } from 'next/server';

// Allow up to 60 seconds for AI generation on Vercel
export const maxDuration = 60;

const SCRIPT_TYPE_LABELS: Record<string, string> = {
  'user-event': 'UserEventScript',
  client: 'ClientScript',
  scheduled: 'ScheduledScript',
  suitelet: 'Suitelet',
  restlet: 'RESTlet',
  'map-reduce': 'MapReduceScript',
  'workflow-action': 'WorkflowActionScript',
};

// Rough token estimate: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function buildSystemPrompt(
  scriptType: string,
  contextFiles: { name: string; content: string }[]
) {
  const typeLabel = SCRIPT_TYPE_LABELS[scriptType] || scriptType;

  let prompt = `You are an expert NetSuite SuiteScript 2.1 developer and coding assistant. You are in a multi-turn conversation helping a developer build SuiteScript code.

## Rules
- Always use @NApiVersion 2.1
- Always use @NScriptType ${typeLabel}
- Use the define([...], (...) => { ... }) AMD module pattern
- Include a complete JSDoc header block with @NApiVersion, @NScriptType, @description, @version, and @author
- Use proper entry point function names for the script type
- Return an object exporting the entry point functions
- Use proper error handling with try/catch and log.error
- Import only the N/ modules that are actually used
- Use clear variable names and add brief inline comments for complex logic

## Response Format
- When generating or updating code, return the FULL updated script
- Do NOT wrap code in markdown code fences
- You may include brief explanation text BEFORE the code, separated by a line containing only: ---CODE---
- Everything after ---CODE--- is treated as the script code
- If the user asks a question that doesn't require code, just respond with text (no ---CODE--- marker needed)

## UI Preview
- When generating Suitelets, Client Scripts with dialogs, or any script that creates a user interface, ALSO include an HTML preview section
- After the code, add a line containing only: ---HTML_PREVIEW---
- Then include a self-contained HTML document that visually represents what the UI would look like
- Style it with inline CSS to approximate NetSuite's look and feel (clean form layout, gray headers, bordered fields)
- The HTML should be renderable in a browser iframe

## Entry Points by Script Type
- UserEventScript: beforeLoad, beforeSubmit, afterSubmit
- ClientScript: pageInit, fieldChanged, saveRecord, sublistChanged, postSourcing, lineInit, validateLine, validateField, validateInsert, validateDelete
- ScheduledScript: execute
- Suitelet: onRequest
- RESTlet: get, post, put, delete
- MapReduceScript: getInputData, map, reduce, summarize
- WorkflowActionScript: onAction
`;

  if (contextFiles.length > 0) {
    // Budget: keep total context under ~40K chars (~10K tokens)
    const MAX_TOTAL_CONTEXT = 40000;
    const perFileLimit = Math.floor(MAX_TOTAL_CONTEXT / contextFiles.length);
    const limit = Math.min(perFileLimit, 5000); // cap per file at 5K chars

    prompt += '\n## Project Context\nUse the following reference material from this project:\n\n';
    for (const file of contextFiles) {
      const truncated =
        file.content.length > limit
          ? file.content.slice(0, limit) + '\n\n[... truncated for length]'
          : file.content;
      prompt += `### ${file.name}\n${truncated}\n\n`;
    }
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY not configured. Add it in Vercel project settings under Environment Variables.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      messages: chatMessages,
      prompt,
      scriptType,
      contextFiles = [],
      stream: wantStream = false,
    }: {
      messages?: { role: string; content: string }[];
      prompt?: string;
      scriptType: string;
      contextFiles: { name: string; content: string }[];
      stream?: boolean;
    } = body;

    // Support both multi-turn messages and legacy single prompt
    let apiMessages: { role: string; content: string }[];
    if (chatMessages && chatMessages.length > 0) {
      apiMessages = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } else if (prompt) {
      apiMessages = [{ role: 'user', content: prompt }];
    } else {
      return Response.json(
        { error: 'messages or prompt is required' },
        { status: 400 }
      );
    }

    if (!scriptType) {
      return Response.json(
        { error: 'scriptType is required' },
        { status: 400 }
      );
    }

    // Trim conversation history to keep token usage reasonable
    // Keep system prompt + last 10 messages max
    if (apiMessages.length > 10) {
      const kept = apiMessages.slice(-10);
      // Ensure first message is from user (Anthropic requires it)
      if (kept[0].role !== 'user') {
        kept.shift();
      }
      apiMessages = kept;
    }

    const systemPrompt = buildSystemPrompt(scriptType, contextFiles);

    // Log token estimates for debugging
    const systemTokens = estimateTokens(systemPrompt);
    const messageTokens = apiMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    console.log(`[AI Generate] System: ~${systemTokens} tokens, Messages: ~${messageTokens} tokens, Total: ~${systemTokens + messageTokens} tokens`);

    if (wantStream) {
      // ---- Streaming mode ----
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8192,
          stream: true,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      if (!anthropicRes.ok) {
        const errBody = await anthropicRes.text();
        console.error('Anthropic API error:', anthropicRes.status, errBody);

        if (anthropicRes.status === 401) {
          return Response.json(
            { error: 'Invalid Anthropic API key. Check your ANTHROPIC_API_KEY in Vercel environment variables.' },
            { status: 401 }
          );
        }
        if (anthropicRes.status === 429) {
          return Response.json(
            { error: 'Rate limited by Anthropic API. Wait a moment and try again.' },
            { status: 429 }
          );
        }
        return Response.json(
          { error: `Anthropic API error (${anthropicRes.status}). Check server logs for details.` },
          { status: 502 }
        );
      }

      // Forward the SSE stream to the client
      const stream = new ReadableStream({
        async start(controller) {
          const reader = anthropicRes.body!.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              controller.enqueue(new TextEncoder().encode(chunk));
            }
          } catch (err) {
            console.error('[AI Stream] Error:', err);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ---- Non-streaming mode (legacy) ----
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8192,
          system: systemPrompt,
          messages: apiMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errBody = await response.text();
        console.error('Anthropic API error:', response.status, errBody);

        if (response.status === 401) {
          return Response.json(
            { error: 'Invalid Anthropic API key. Check your ANTHROPIC_API_KEY in Vercel environment variables.' },
            { status: 401 }
          );
        }
        if (response.status === 429) {
          return Response.json(
            { error: 'Rate limited by Anthropic API. Wait a moment and try again.' },
            { status: 429 }
          );
        }
        return Response.json(
          { error: `Anthropic API error (${response.status}). Check server logs for details.` },
          { status: 502 }
        );
      }

      const data = await response.json();
      const rawText =
        data.content?.[0]?.type === 'text' ? data.content[0].text : '';

      return Response.json({ code: rawText });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return Response.json(
          { error: 'AI generation timed out. Try a simpler prompt or fewer context files.' },
          { status: 504 }
        );
      }
      throw fetchErr;
    }
  } catch (err) {
    console.error('Generate error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to generate script' },
      { status: 500 }
    );
  }
}
