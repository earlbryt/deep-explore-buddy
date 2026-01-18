import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

interface ResearchStep {
  type: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'complete';
  message: string;
  data?: unknown;
}

// Tavily search function
async function tavilySearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: 5,
      include_answer: false,
      include_raw_content: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Tavily search error:', error);
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.results.map((r: { title: string; url: string; content: string; raw_content?: string }) => ({
    title: r.title,
    url: r.url,
    content: r.raw_content || r.content,
  }));
}

// Groq LLM call
async function callGroq(messages: Array<{ role: string; content: string }>, apiKey: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Groq API error:', error);
    throw new Error(`Groq API failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Generate search queries based on the research topic
async function generateSearchQueries(topic: string, groqKey: string): Promise<string[]> {
  const prompt = `You are a research planning assistant. Given a research topic, generate 3-5 focused search queries that would help gather comprehensive information.

Topic: "${topic}"

Return ONLY a JSON array of search query strings, nothing else. Example:
["query 1", "query 2", "query 3"]`;

  const response = await callGroq([
    { role: 'system', content: 'You are a research planning assistant. Return only valid JSON.' },
    { role: 'user', content: prompt }
  ], groqKey);

  try {
    const queries = JSON.parse(response);
    return Array.isArray(queries) ? queries.slice(0, 5) : [topic];
  } catch {
    console.error('Failed to parse queries, using topic as query');
    return [topic];
  }
}

// Analyze and synthesize research findings
async function synthesizeFindings(topic: string, searchResults: SearchResult[], groqKey: string): Promise<string> {
  const sourcesText = searchResults.map((r, i) => 
    `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content.substring(0, 2000)}...`
  ).join('\n\n---\n\n');

  const prompt = `You are a deep research analyst. Based on the following sources, create a comprehensive research report on the topic.

## Research Topic
${topic}

## Sources
${sourcesText}

## Instructions
Create a well-structured research report with:
1. **Executive Summary** - Brief overview of key findings
2. **Key Insights** - Main discoveries from the research
3. **Detailed Analysis** - In-depth examination of the topic
4. **Conclusions** - Summary and implications
5. **Sources** - List the sources used with their URLs

Use markdown formatting. Be thorough, analytical, and cite sources where relevant.`;

  return await callGroq([
    { role: 'system', content: 'You are an expert research analyst who creates comprehensive, well-cited research reports.' },
    { role: 'user', content: prompt }
  ], groqKey);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');

    if (!GROQ_API_KEY || !TAVILY_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing API keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { topic, stream } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting deep research on: ${topic}`);

    if (stream) {
      // Streaming response for real-time updates
      const encoder = new TextEncoder();
      const streamBody = new ReadableStream({
        async start(controller) {
          const sendStep = (step: ResearchStep) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`));
          };

          try {
            // Step 1: Planning
            sendStep({ type: 'planning', message: 'Analyzing research topic and generating search strategy...' });
            const queries = await generateSearchQueries(topic, GROQ_API_KEY);
            sendStep({ type: 'planning', message: `Generated ${queries.length} search queries`, data: queries });

            // Step 2: Searching
            const allResults: SearchResult[] = [];
            for (let i = 0; i < queries.length; i++) {
              sendStep({ type: 'searching', message: `Searching: "${queries[i]}" (${i + 1}/${queries.length})` });
              try {
                const results = await tavilySearch(queries[i], TAVILY_API_KEY);
                allResults.push(...results);
                sendStep({ type: 'searching', message: `Found ${results.length} results for query ${i + 1}`, data: results.map(r => ({ title: r.title, url: r.url })) });
              } catch (err) {
                console.error(`Search failed for query: ${queries[i]}`, err);
                sendStep({ type: 'searching', message: `Search failed for: "${queries[i]}"` });
              }
            }

            // Deduplicate results by URL
            const uniqueResults = allResults.filter((result, index, self) =>
              index === self.findIndex(r => r.url === result.url)
            );

            sendStep({ type: 'analyzing', message: `Analyzing ${uniqueResults.length} unique sources...` });

            // Step 3: Synthesizing
            sendStep({ type: 'synthesizing', message: 'Synthesizing findings into comprehensive report...' });
            const report = await synthesizeFindings(topic, uniqueResults, GROQ_API_KEY);

            // Step 4: Complete
            sendStep({ 
              type: 'complete', 
              message: 'Research complete!', 
              data: { 
                report,
                sourcesCount: uniqueResults.length,
                queriesUsed: queries.length
              }
            });

            controller.close();
          } catch (error) {
            console.error('Research error:', error);
            sendStep({ type: 'complete', message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
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
    } else {
      // Non-streaming response
      const queries = await generateSearchQueries(topic, GROQ_API_KEY);
      
      const allResults: SearchResult[] = [];
      for (const query of queries) {
        try {
          const results = await tavilySearch(query, TAVILY_API_KEY);
          allResults.push(...results);
        } catch (err) {
          console.error(`Search failed for query: ${query}`, err);
        }
      }

      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.url === result.url)
      );

      const report = await synthesizeFindings(topic, uniqueResults, GROQ_API_KEY);

      return new Response(
        JSON.stringify({ 
          report,
          sources: uniqueResults.map(r => ({ title: r.title, url: r.url })),
          queriesUsed: queries
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in deep-research function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
