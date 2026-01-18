import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResearchInput } from "@/components/ResearchInput";
import { ResearchProgress } from "@/components/ResearchProgress";
import { ResearchReport } from "@/components/ResearchReport";
import { useToast } from "@/hooks/use-toast";
import { Brain, Zap, Globe } from "lucide-react";

interface ResearchStep {
  type: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'complete';
  message: string;
  data?: unknown;
}

interface ReportData {
  report: string;
  sourcesCount: number;
  queriesUsed: number;
}

type AppState = 'idle' | 'researching' | 'complete';

export default function Index() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [steps, setSteps] = useState<ResearchStep[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('planning');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const { toast } = useToast();

  const handleResearch = useCallback(async (topic: string) => {
    setAppState('researching');
    setSteps([]);
    setCurrentPhase('planning');
    setReportData(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deep-research`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ topic, stream: true }),
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
              const data = JSON.parse(line.slice(6)) as ResearchStep;
              setSteps(prev => [...prev, data]);
              setCurrentPhase(data.type);

              if (data.type === 'complete' && data.data) {
                const completeData = data.data as { report: string; sourcesCount: number; queriesUsed: number };
                setReportData({
                  report: completeData.report,
                  sourcesCount: completeData.sourcesCount,
                  queriesUsed: completeData.queriesUsed,
                });
                setAppState('complete');
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
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
    setSteps([]);
    setCurrentPhase('planning');
    setReportData(null);
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
                    AI-Powered Research Agent
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
                  <span>Tavily Search</span>
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
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <h2 className="text-4xl sm:text-5xl font-bold">
                  <span className="text-gradient-primary glow-text">Deep Research</span>
                  <br />
                  <span className="text-foreground">Agent</span>
                </h2>
                <p className="text-muted-foreground text-lg">
                  Enter any topic and let our AI conduct comprehensive web research,
                  analyze multiple sources, and synthesize a detailed report.
                </p>
              </div>

              {/* Research input */}
              <ResearchInput onSubmit={handleResearch} isLoading={false} />

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
                {[
                  {
                    icon: Brain,
                    title: "Intelligent Planning",
                    description: "AI generates optimal search queries based on your topic"
                  },
                  {
                    icon: Globe,
                    title: "Multi-Source Search",
                    description: "Searches and fetches content from multiple web sources"
                  },
                  {
                    icon: Zap,
                    title: "Deep Synthesis",
                    description: "Llama 3.3 70B analyzes and synthesizes comprehensive reports"
                  }
                ].map((feature, i) => (
                  <div key={i} className="research-card p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appState === 'researching' && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Research in Progress
                </h2>
                <p className="text-muted-foreground">
                  Our AI agent is conducting deep research on your topic...
                </p>
              </div>
              <ResearchProgress steps={steps} currentPhase={currentPhase} />
            </div>
          )}

          {appState === 'complete' && reportData && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-primary mb-2 glow-text">
                  ✓ Research Complete
                </h2>
                <p className="text-muted-foreground">
                  Your comprehensive research report is ready
                </p>
              </div>
              <ResearchReport
                report={reportData.report}
                sourcesCount={reportData.sourcesCount}
                queriesUsed={reportData.queriesUsed}
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
              <span>Deep Research Agent v1.0</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
