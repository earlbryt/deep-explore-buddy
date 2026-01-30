import { useState, useCallback } from "react";
import { ResearchInput } from "@/components/ResearchInput";
import { ResearchProgress } from "@/components/ResearchProgress";
import { ResearchReport } from "@/components/ResearchReport";
import { useToast } from "@/hooks/use-toast";
import { Brain, Zap, Globe, Clock, Search } from "lucide-react";

interface StreamEvent {
  type: 'thinking' | 'searching' | 'reading' | 'reflecting' | 'knowledge' | 'gap' | 'progress' | 'answer' | 'error';
  message: string;
  data?: unknown;
  step?: number;
  totalSteps?: number;
}

interface ReportData {
  report: string;
  stats: {
    totalSteps: number;
    knowledgeItems: number;
    urlsVisited: number;
    searchesPerformed: number;
    gapsInvestigated: number;
  };
}

type AppState = 'idle' | 'researching' | 'complete';

export default function Index() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(25);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [researchTopic, setResearchTopic] = useState('');
  const { toast } = useToast();

  const handleResearch = useCallback(async (topic: string) => {
    setAppState('researching');
    setEvents([]);
    setCurrentStep(0);
    setTotalSteps(25);
    setReportData(null);
    setResearchTopic(topic);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deep-research`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ topic }),
        }
      );

      if (!response.ok) {
        throw new Error(`Research failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as StreamEvent;
              setEvents(prev => [...prev, event]);
              
              if (event.step) setCurrentStep(event.step);
              if (event.totalSteps) setTotalSteps(event.totalSteps);

              if (event.type === 'answer' && event.data) {
                const answerData = event.data as { report: string; stats: ReportData['stats'] };
                setReportData({
                  report: answerData.report,
                  stats: answerData.stats,
                });
                setAppState('complete');
              }

              if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.error('Failed to parse SSE data:', e);
              } else {
                throw e;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Research error:', error);
      toast({
        title: "Research Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      setAppState('idle');
    }
  }, [toast]);

  const handleNewResearch = () => {
    setAppState('idle');
    setEvents([]);
    setCurrentStep(0);
    setReportData(null);
    setResearchTopic('');
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern relative">
      {/* Radial gradient overlay */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      {/* Scan line effect */}
      <div className="fixed inset-0 scan-line pointer-events-none opacity-30" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground font-mono">
                    DEEP<span className="text-primary">RESEARCH</span>
                  </h1>
                  <p className="text-xs text-muted-foreground font-mono">
                    Multi-Step Iterative Research Agent
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-primary" />
                  <span>Llama 3.3 70B</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-primary" />
                  <span>Tavily Deep Search</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="container mx-auto px-4 py-12">
          {appState === 'idle' && (
            <div className="space-y-12">
              {/* Hero section */}
              <div className="text-center space-y-4 max-w-3xl mx-auto">
                <h2 className="text-4xl sm:text-5xl font-bold">
                  <span className="text-gradient-primary glow-text">Deep Research</span>
                  <br />
                  <span className="text-foreground">Like ChatGPT & Grok</span>
                </h2>
                <p className="text-muted-foreground text-lg">
                  Our AI agent conducts <strong className="text-primary">iterative, multi-step research</strong> — 
                  searching, reading sources, identifying knowledge gaps, and reasoning through sub-questions 
                  until it builds comprehensive understanding. Takes 2-5 minutes for thorough research.
                </p>
              </div>

              {/* Research input */}
              <ResearchInput onSubmit={handleResearch} isLoading={false} />

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto mt-16">
                {[
                  {
                    icon: Brain,
                    title: "Iterative Reasoning",
                    description: "Loops through search→read→reason until comprehensive"
                  },
                  {
                    icon: Search,
                    title: "Multi-Query Search",
                    description: "Generates and executes dozens of targeted search queries"
                  },
                  {
                    icon: Globe,
                    title: "Deep Source Reading",
                    description: "Extracts and analyzes full content from multiple sources"
                  },
                  {
                    icon: Clock,
                    title: "Gap Analysis",
                    description: "Identifies knowledge gaps and creates sub-questions"
                  }
                ].map((feature, i) => (
                  <div key={i} className="research-card p-5 text-center space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div className="max-w-3xl mx-auto mt-12">
                <h3 className="text-lg font-semibold text-center mb-6 text-muted-foreground">
                  How Deep Research Works
                </h3>
                <div className="flex items-center justify-center gap-2 text-xs font-mono flex-wrap">
                  {['Search Web', '→', 'Read Sources', '→', 'Identify Gaps', '→', 'Research Gaps', '→', 'Loop Until Complete', '→', 'Synthesize Report'].map((step, i) => (
                    <span 
                      key={i} 
                      className={step === '→' ? 'text-muted-foreground' : 'px-3 py-1.5 bg-muted rounded-full text-foreground'}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {appState === 'researching' && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Researching: <span className="text-primary">{researchTopic}</span>
                </h2>
                <p className="text-muted-foreground">
                  AI agent is conducting deep, iterative research. This may take 2-5 minutes...
                </p>
              </div>
              <ResearchProgress 
                events={events} 
                currentStep={currentStep} 
                totalSteps={totalSteps} 
              />
            </div>
          )}

          {appState === 'complete' && reportData && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-primary mb-2 glow-text">
                  ✓ Deep Research Complete
                </h2>
                <p className="text-muted-foreground">
                  Completed in {reportData.stats.totalSteps} steps • {reportData.stats.knowledgeItems} findings • {reportData.stats.urlsVisited} sources analyzed
                </p>
              </div>
              <ResearchReport
                report={reportData.report}
                sourcesCount={reportData.stats.urlsVisited}
                queriesUsed={reportData.stats.searchesPerformed}
                onNewResearch={handleNewResearch}
              />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-16">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
              <span>Powered by</span>
              <span className="text-primary">Groq + Tavily</span>
              <span>•</span>
              <span>Iterative Deep Research Agent v2.0</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
