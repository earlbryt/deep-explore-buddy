import { CheckCircle2, Circle, Loader2, Search, Brain, FileText, Sparkles } from "lucide-react";

interface ResearchStep {
  type: 'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'complete';
  message: string;
  data?: unknown;
}

interface ResearchProgressProps {
  steps: ResearchStep[];
  currentPhase: string;
}

const phaseIcons = {
  planning: Brain,
  searching: Search,
  analyzing: FileText,
  synthesizing: Sparkles,
  complete: CheckCircle2,
};

const phaseLabels = {
  planning: 'Planning Research Strategy',
  searching: 'Searching Web Sources',
  analyzing: 'Analyzing Content',
  synthesizing: 'Synthesizing Report',
  complete: 'Research Complete',
};

export function ResearchProgress({ steps, currentPhase }: ResearchProgressProps) {
  const phases: Array<'planning' | 'searching' | 'analyzing' | 'synthesizing' | 'complete'> = [
    'planning', 'searching', 'analyzing', 'synthesizing', 'complete'
  ];
  
  const currentIndex = phases.indexOf(currentPhase as typeof phases[number]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Phase indicators */}
      <div className="flex items-center justify-between px-4">
        {phases.slice(0, -1).map((phase, i) => {
          const Icon = phaseIcons[phase];
          const isActive = phase === currentPhase;
          const isComplete = currentIndex > i || currentPhase === 'complete';
          
          return (
            <div key={phase} className="flex items-center">
              <div className={`
                flex flex-col items-center gap-2 transition-all duration-500
                ${isActive ? 'scale-110' : ''}
              `}>
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isComplete ? 'bg-primary text-primary-foreground' : ''}
                  ${isActive ? 'bg-primary/20 text-primary animate-pulse-glow' : ''}
                  ${!isActive && !isComplete ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  {isActive && !isComplete ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`
                  text-xs font-mono uppercase tracking-wider whitespace-nowrap
                  ${isActive || isComplete ? 'text-primary' : 'text-muted-foreground'}
                `}>
                  {phase}
                </span>
              </div>
              {i < phases.length - 2 && (
                <div className={`
                  w-16 h-0.5 mx-2 transition-all duration-500
                  ${currentIndex > i || currentPhase === 'complete' ? 'bg-primary' : 'bg-muted'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Live log */}
      <div className="research-card glow-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-primary/70" />
          </div>
          <span className="text-xs font-mono text-muted-foreground ml-2">research_log.out</span>
        </div>
        
        <div className="p-4 max-h-64 overflow-y-auto font-mono text-sm space-y-2 bg-background/50">
          {steps.map((step, i) => (
            <div 
              key={i} 
              className="flex items-start gap-2 animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-primary shrink-0">
                {step.type === 'complete' ? '✓' : '›'}
              </span>
              <span className={`
                ${step.type === 'complete' ? 'text-primary' : 'text-foreground/80'}
              `}>
                {step.message}
              </span>
            </div>
          ))}
          {currentPhase !== 'complete' && (
            <div className="flex items-center gap-2">
              <span className="text-primary">›</span>
              <span className="typing-cursor" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
