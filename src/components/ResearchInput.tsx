import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ResearchInputProps {
  onSubmit: (topic: string) => void;
  isLoading: boolean;
}

export function ResearchInput({ onSubmit, isLoading }: ResearchInputProps) {
  const [topic, setTopic] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !isLoading) {
      onSubmit(topic.trim());
    }
  };

  const exampleTopics = [
    "Latest advancements in quantum computing 2024",
    "Impact of AI on healthcare diagnostics",
    "Sustainable energy storage solutions",
    "The future of remote work technologies",
  ];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter your research topic..."
            className="min-h-[120px] bg-secondary border-border text-foreground placeholder:text-muted-foreground resize-none font-mono text-sm pr-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            disabled={isLoading}
          />
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground font-mono">
            {topic.length} chars
          </div>
        </div>
        
        <Button
          type="submit"
          disabled={!topic.trim() || isLoading}
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm tracking-wide transition-all duration-300 disabled:opacity-50 group"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              RESEARCHING...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
              INITIATE DEEP RESEARCH
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            </span>
          )}
        </Button>
      </form>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          // Example queries
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {exampleTopics.map((example, i) => (
            <button
              key={i}
              onClick={() => setTopic(example)}
              disabled={isLoading}
              className="text-left p-3 rounded-md bg-muted/50 border border-border hover:border-primary/50 hover:bg-muted transition-all text-xs text-muted-foreground hover:text-foreground font-mono truncate disabled:opacity-50"
            >
              → {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
