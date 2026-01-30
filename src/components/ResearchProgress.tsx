import { CheckCircle2, Loader2, Search, Brain, FileText, Sparkles, BookOpen, AlertCircle, Lightbulb } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StreamEvent {
  type: 'thinking' | 'searching' | 'reading' | 'reflecting' | 'knowledge' | 'gap' | 'progress' | 'answer' | 'error';
  message: string;
  data?: unknown;
  step?: number;
  totalSteps?: number;
}

interface ResearchProgressProps {
  events: StreamEvent[];
  currentStep: number;
  totalSteps: number;
}

const eventIcons = {
  thinking: Brain,
  searching: Search,
  reading: BookOpen,
  reflecting: Lightbulb,
  knowledge: FileText,
  gap: AlertCircle,
  progress: Sparkles,
  answer: CheckCircle2,
  error: AlertCircle,
};

const eventColors = {
  thinking: 'text-primary',
  searching: 'text-blue-400',
  reading: 'text-cyan-400',
  reflecting: 'text-yellow-400',
  knowledge: 'text-green-400',
  gap: 'text-orange-400',
  progress: 'text-purple-400',
  answer: 'text-primary',
  error: 'text-destructive',
};

export function ResearchProgress({ events, currentStep, totalSteps }: ResearchProgressProps) {
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  
  // Get stats from latest progress event
  const latestProgress = [...events].reverse().find(e => e.type === 'progress');
  const stats = latestProgress?.data as { knowledgeCount?: number; gapsCount?: number; urlsVisited?: number } | undefined;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Progress header */}
      <div className="research-card glow-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center animate-pulse-glow">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Deep Research in Progress</h3>
              <p className="text-xs text-muted-foreground font-mono">
                Step {currentStep} of {totalSteps} • Iterative reasoning loop
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            {stats && (
              <>
                <div className="flex items-center gap-1.5 text-green-400">
                  <FileText className="w-3 h-3" />
                  <span>{stats.knowledgeCount || 0} findings</span>
                </div>
                <div className="flex items-center gap-1.5 text-orange-400">
                  <Lightbulb className="w-3 h-3" />
                  <span>{stats.gapsCount || 0} gaps</span>
                </div>
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <BookOpen className="w-3 h-3" />
                  <span>{stats.urlsVisited || 0} sources</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Thinking stream */}
      <div className="research-card glow-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-primary/70" />
          </div>
          <span className="text-xs font-mono text-muted-foreground ml-2">research_thinking.log</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-mono text-primary">LIVE</span>
          </div>
        </div>
        
        <ScrollArea className="h-[400px]">
          <div className="p-4 font-mono text-sm space-y-3">
            {events.map((event, i) => {
              const Icon = eventIcons[event.type];
              const colorClass = eventColors[event.type];
              
              return (
                <div 
                  key={i} 
                  className="flex items-start gap-3 animate-fade-in-up p-2 rounded-lg hover:bg-muted/30 transition-colors"
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                >
                  <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                    {event.type === 'progress' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
                        {event.type}
                      </span>
                      {event.step && (
                        <span className="text-xs text-muted-foreground">
                          Step {event.step}
                        </span>
                      )}
                    </div>
                    <p className="text-foreground/90 text-sm leading-relaxed break-words">
                      {event.message}
                    </p>
                    
                    {/* Show additional data for certain event types */}
                    {event.type === 'knowledge' && event.data && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        {(event.data as { urls?: string[] }).urls?.slice(0, 3).map((url, j) => (
                          <div key={j} className="truncate">→ {url}</div>
                        ))}
                      </div>
                    )}
                    
                    {event.type === 'gap' && event.data && (
                      <div className="mt-2 text-xs bg-orange-500/10 text-orange-400 rounded p-2">
                        Priority: {(event.data as { priority?: number }).priority} • 
                        Reason: {(event.data as { reason?: string }).reason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Typing cursor when active */}
            {currentStep > 0 && currentStep < totalSteps && (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-primary animate-pulse">Reasoning...</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Research phases indicator */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { name: 'Search', icon: Search, active: events.some(e => e.type === 'searching') },
          { name: 'Read', icon: BookOpen, active: events.some(e => e.type === 'reading') },
          { name: 'Reflect', icon: Lightbulb, active: events.some(e => e.type === 'reflecting') },
          { name: 'Synthesize', icon: Sparkles, active: events.some(e => e.type === 'answer') },
        ].map((phase, i) => (
          <div 
            key={i}
            className={`
              research-card p-3 text-center transition-all duration-300
              ${phase.active ? 'border-primary/50 bg-primary/5' : 'opacity-50'}
            `}
          >
            <phase.icon className={`w-5 h-5 mx-auto mb-1 ${phase.active ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-xs font-mono uppercase tracking-wider">
              {phase.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
