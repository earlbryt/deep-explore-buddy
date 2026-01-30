import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============== TYPES ==============

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

interface KnowledgeItem {
  question: string;
  answer: string;
  sources: string[];
  type: 'search' | 'url' | 'reflection';
}

interface GapQuestion {
  question: string;
  priority: number;
  reason: string;
}

interface AgentState {
  originalQuestion: string;
  currentQuestion: string;
  gaps: GapQuestion[];
  knowledge: KnowledgeItem[];
  visitedUrls: Set<string>;
  searchQueries: Set<string>;
  step: number;
  totalTokensUsed: number;
  failedAttempts: number;
}

interface AgentAction {
  action: 'search' | 'read' | 'reflect' | 'answer';
  reasoning: string;
  searchQueries?: string[];
  urlsToRead?: string[];
  gapQuestions?: GapQuestion[];
  finalAnswer?: string;
}

interface StreamEvent {
  type: 'thinking' | 'searching' | 'reading' | 'reflecting' | 'knowledge' | 'gap' | 'progress' | 'answer' | 'error';
  message: string;
  data?: unknown;
  step?: number;
  totalSteps?: number;
}

// ============== CONFIGURATION ==============

const MAX_STEPS = 25; // Allow up to 25 iterations
const MAX_FAILED_ATTEMPTS = 3;
const MAX_URLS_PER_STEP = 3;
const MAX_SEARCH_RESULTS = 5;
const TOKEN_BUDGET = 100000; // Approximate token budget

// ============== HELPER FUNCTIONS ==============

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '...';
}

// ============== TAVILY SEARCH ==============

async function tavilySearch(query: string, apiKey: string): Promise<SearchResult[]> {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: MAX_SEARCH_RESULTS,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      console.error('Tavily search error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.results?.map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      content: truncateToTokens(r.content, 500),
    })) || [];
  } catch (error) {
    console.error('Tavily search failed:', error);
    return [];
  }
}

// ============== URL READER (via Tavily Extract) ==============

async function readUrl(url: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        urls: [url],
      }),
    });

    if (!response.ok) {
      console.error('Tavily extract error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return truncateToTokens(data.results[0].raw_content || data.results[0].content || '', 2000);
    }
    return null;
  } catch (error) {
    console.error('URL read failed:', error);
    return null;
  }
}

// ============== LLM CALLS (Lovable AI Gateway) ==============

async function callLLM(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  jsonMode: boolean = false
): Promise<string> {
  const body: Record<string, unknown> = {
    model: 'openai/gpt-oss-120b',
    messages,
    temperature: 0.3,
    max_tokens: 4096,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Lovable AI Gateway error:', error);
    throw new Error(`LLM API failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ============== AGENT DECISION MAKING ==============

function buildAgentPrompt(state: AgentState, availableUrls: string[]): string {
  const knowledgeSummary = state.knowledge.length > 0
    ? state.knowledge.map((k, i) => `[${i + 1}] Q: ${k.question}\nA: ${truncateToTokens(k.answer, 200)}\nSources: ${k.sources.join(', ')}`).join('\n\n')
    : 'No knowledge accumulated yet.';

  const gapsSummary = state.gaps.length > 0
    ? state.gaps.map(g => `- ${g.question} (priority: ${g.priority}, reason: ${g.reason})`).join('\n')
    : 'No identified gaps.';

  const urlList = availableUrls.length > 0
    ? availableUrls.slice(0, 10).map(u => `- ${u}`).join('\n')
    : 'No unvisited URLs available.';

  const previousSearches = Array.from(state.searchQueries).slice(-10).join(', ') || 'None';

  return `You are a deep research agent conducting thorough research on a topic. You must think carefully and decide your next action.

<original-question>
${state.originalQuestion}
</original-question>

<current-focus>
${state.currentQuestion}
</current-focus>

<accumulated-knowledge>
${knowledgeSummary}
</accumulated-knowledge>

<identified-gaps>
${gapsSummary}
</identified-gaps>

<previous-searches>
${previousSearches}
</previous-searches>

<available-urls-to-read>
${urlList}
</available-urls-to-read>

<progress>
Step ${state.step} of ${MAX_STEPS}. Failed attempts: ${state.failedAttempts}/${MAX_FAILED_ATTEMPTS}.
</progress>

DECIDE YOUR NEXT ACTION. Choose ONE:

1. "search" - If you need more information, generate 2-4 NEW search queries (different from previous searches)
2. "read" - If there are promising URLs you haven't read, select up to ${MAX_URLS_PER_STEP} to read deeply
3. "reflect" - If you have gathered some knowledge but need to identify gaps or break down the question into sub-questions
4. "answer" - ONLY if you have gathered enough comprehensive knowledge to provide a thorough, well-cited answer

For deep research, you should:
- Start by searching to understand the landscape
- Read multiple sources to get detailed information
- Reflect to identify what's missing and create sub-questions
- Continue searching and reading to fill gaps
- Only answer when you have comprehensive, multi-source coverage

Respond with a JSON object:
{
  "action": "search" | "read" | "reflect" | "answer",
  "reasoning": "Your detailed thinking about why this action",
  "searchQueries": ["query1", "query2"] // if action is search
  "urlsToRead": ["url1", "url2"] // if action is read
  "gapQuestions": [{"question": "...", "priority": 1-5, "reason": "..."}] // if action is reflect
  "finalAnswer": "..." // if action is answer - must be comprehensive markdown with citations
}`;
}

async function getAgentAction(state: AgentState, availableUrls: string[], groqKey: string): Promise<AgentAction> {
  const prompt = buildAgentPrompt(state, availableUrls);
  
  const response = await callLLM([
    { role: 'system', content: 'You are a meticulous deep research agent. Always respond with valid JSON. Think step by step about what information you still need.' },
    { role: 'user', content: prompt }
  ], groqKey, true);

  try {
    return JSON.parse(response) as AgentAction;
  } catch {
    console.error('Failed to parse agent action:', response);
    return {
      action: 'search',
      reasoning: 'Failed to parse previous response, trying a new search',
      searchQueries: [state.currentQuestion]
    };
  }
}

// ============== REPORT SYNTHESIS ==============

async function synthesizeReport(topic: string, knowledge: KnowledgeItem[], groqKey: string): Promise<string> {
  const knowledgeText = knowledge.map((k, i) => 
    `[Source ${i + 1}]\nTopic: ${k.question}\nFindings: ${k.answer}\nReferences: ${k.sources.join(', ')}`
  ).join('\n\n---\n\n');

  const prompt = `You are an expert research analyst. Based on the accumulated research findings below, create a COMPREHENSIVE and DETAILED research report.

<research-topic>
${topic}
</research-topic>

<accumulated-findings>
${knowledgeText}
</accumulated-findings>

Create a well-structured research report with the following sections:

# Executive Summary
A concise overview of the key findings (2-3 paragraphs)

# Background & Context
Set the stage for understanding the topic

# Key Findings
Detailed analysis of what was discovered, organized by theme. Use bullet points and sub-sections.

# In-Depth Analysis
Deeper exploration of important aspects, patterns, and implications

# Conclusions
Summary of insights and their significance

# Sources
List all sources used with their URLs

Guidelines:
- Be thorough and detailed - this is DEEP research
- Cite sources using [Source N] notation
- Use markdown formatting (headers, bullets, bold, etc.)
- Include specific facts, figures, and quotes when available
- Identify patterns and connections across sources
- Note any contradictions or debates in the literature`;

  return await callLLM([
    { role: 'system', content: 'You are an expert research analyst who creates comprehensive, well-cited research reports. Be thorough and detailed.' },
    { role: 'user', content: prompt }
  ], groqKey);
}

// ============== MAIN AGENT LOOP ==============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');

    if (!LOVABLE_API_KEY || !TAVILY_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing API keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { topic } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting DEEP research on: ${topic}`);

    // Initialize agent state
    const state: AgentState = {
      originalQuestion: topic,
      currentQuestion: topic,
      gaps: [],
      knowledge: [],
      visitedUrls: new Set(),
      searchQueries: new Set(),
      step: 0,
      totalTokensUsed: 0,
      failedAttempts: 0,
    };

    // Collected URLs from searches
    let availableUrls: string[] = [];

    // Streaming response
    const encoder = new TextEncoder();
    const streamBody = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          sendEvent({
            type: 'thinking',
            message: `Starting deep research on: "${topic}"`,
            step: 0,
            totalSteps: MAX_STEPS
          });

          // Main agent loop
          while (state.step < MAX_STEPS && state.failedAttempts < MAX_FAILED_ATTEMPTS) {
            state.step++;

            sendEvent({
              type: 'progress',
              message: `Research step ${state.step}/${MAX_STEPS}`,
              step: state.step,
              totalSteps: MAX_STEPS,
              data: { 
                knowledgeCount: state.knowledge.length,
                gapsCount: state.gaps.length,
                urlsVisited: state.visitedUrls.size
              }
            });

            // Get current question (from gaps queue or original)
            if (state.gaps.length > 0 && state.step > 2) {
              const nextGap = state.gaps.shift()!;
              state.currentQuestion = nextGap.question;
              sendEvent({
                type: 'thinking',
                message: `Investigating sub-question: "${nextGap.question}"`,
                step: state.step
              });
            }

            // Get agent's decision
            const action = await getAgentAction(state, availableUrls.filter(u => !state.visitedUrls.has(u)), LOVABLE_API_KEY);

            sendEvent({
              type: 'thinking',
              message: action.reasoning,
              step: state.step,
              data: { action: action.action }
            });

            // Execute action
            if (action.action === 'search' && action.searchQueries) {
              sendEvent({
                type: 'searching',
                message: `Searching: ${action.searchQueries.join(' | ')}`,
                step: state.step
              });

              for (const query of action.searchQueries) {
                if (state.searchQueries.has(query)) continue;
                state.searchQueries.add(query);

                const results = await tavilySearch(query, TAVILY_API_KEY);
                
                if (results.length > 0) {
                  // Add URLs to available list
                  for (const r of results) {
                    if (!availableUrls.includes(r.url)) {
                      availableUrls.push(r.url);
                    }
                  }

                  // Add search snippets as knowledge
                  const snippetContent = results.map(r => `${r.title}: ${r.content}`).join('\n\n');
                  state.knowledge.push({
                    question: query,
                    answer: snippetContent,
                    sources: results.map(r => r.url),
                    type: 'search'
                  });

                  sendEvent({
                    type: 'knowledge',
                    message: `Found ${results.length} results for "${query}"`,
                    step: state.step,
                    data: { resultCount: results.length, urls: results.map(r => r.url) }
                  });
                }
              }
            } else if (action.action === 'read' && action.urlsToRead) {
              sendEvent({
                type: 'reading',
                message: `Reading ${action.urlsToRead.length} sources deeply...`,
                step: state.step
              });

              for (const url of action.urlsToRead.slice(0, MAX_URLS_PER_STEP)) {
                if (state.visitedUrls.has(url)) continue;
                state.visitedUrls.add(url);

                sendEvent({
                  type: 'reading',
                  message: `Reading: ${url}`,
                  step: state.step
                });

                const content = await readUrl(url, TAVILY_API_KEY);
                
                if (content) {
                  state.knowledge.push({
                    question: `Content from ${url}`,
                    answer: content,
                    sources: [url],
                    type: 'url'
                  });

                  sendEvent({
                    type: 'knowledge',
                    message: `Extracted content from ${url}`,
                    step: state.step,
                    data: { url, contentLength: content.length }
                  });
                }
              }
            } else if (action.action === 'reflect' && action.gapQuestions) {
              sendEvent({
                type: 'reflecting',
                message: `Identified ${action.gapQuestions.length} knowledge gaps to investigate`,
                step: state.step
              });

              // Add gap questions to the queue
              for (const gap of action.gapQuestions) {
                state.gaps.push(gap);
                sendEvent({
                  type: 'gap',
                  message: `Gap identified: ${gap.question}`,
                  step: state.step,
                  data: gap
                });
              }

              // Always add original question back to the end
              if (!state.gaps.some(g => g.question === state.originalQuestion)) {
                state.gaps.push({
                  question: state.originalQuestion,
                  priority: 1,
                  reason: 'Main research question'
                });
              }
            } else if (action.action === 'answer') {
              // Check if we have enough knowledge
              if (state.knowledge.length < 3) {
                state.failedAttempts++;
                sendEvent({
                  type: 'thinking',
                  message: 'Not enough knowledge accumulated yet. Continuing research...',
                  step: state.step
                });
                continue;
              }

              sendEvent({
                type: 'thinking',
                message: 'Synthesizing comprehensive research report...',
                step: state.step
              });

              // Generate final report
              const report = await synthesizeReport(topic, state.knowledge, LOVABLE_API_KEY);

              sendEvent({
                type: 'answer',
                message: 'Research complete!',
                step: state.step,
                data: {
                  report,
                  stats: {
                    totalSteps: state.step,
                    knowledgeItems: state.knowledge.length,
                    urlsVisited: state.visitedUrls.size,
                    searchesPerformed: state.searchQueries.size,
                    gapsInvestigated: state.gaps.length
                  }
                }
              });

              controller.close();
              return;
            }

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // If we hit max steps without answering, synthesize what we have
          sendEvent({
            type: 'thinking',
            message: 'Reached maximum research depth. Synthesizing findings...',
            step: state.step
          });

          const report = await synthesizeReport(topic, state.knowledge, LOVABLE_API_KEY);

          sendEvent({
            type: 'answer',
            message: 'Research complete (max depth reached)',
            step: state.step,
            data: {
              report,
              stats: {
                totalSteps: state.step,
                knowledgeItems: state.knowledge.length,
                urlsVisited: state.visitedUrls.size,
                searchesPerformed: state.searchQueries.size,
                gapsInvestigated: state.gaps.length
              }
            }
          });

          controller.close();
        } catch (error) {
          console.error('Research error:', error);
          sendEvent({
            type: 'error',
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          controller.close();
        }
      }
    });

    return new Response(streamBody, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in deep-research function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
