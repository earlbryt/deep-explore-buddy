import { useState } from "react";
import { Copy, Check, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface ResearchReportProps {
  report: string;
  sourcesCount: number;
  queriesUsed: number;
  onNewResearch: () => void;
}

export function ResearchReport({ report, sourcesCount, queriesUsed, onNewResearch }: ResearchReportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 research-card">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm font-mono">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Sources:</span>
            <span className="text-primary font-semibold">{sourcesCount}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-mono">
            <ExternalLink className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Queries:</span>
            <span className="text-primary font-semibold">{queriesUsed}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="font-mono text-xs border-border hover:border-primary hover:text-primary"
          >
            {copied ? (
              <><Check className="w-3 h-3 mr-1" /> Copied</>
            ) : (
              <><Copy className="w-3 h-3 mr-1" /> Copy</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewResearch}
            className="font-mono text-xs border-border hover:border-primary hover:text-primary"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> New Research
          </Button>
        </div>
      </div>

      {/* Report content */}
      <div className="research-card glow-border">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-mono text-primary uppercase tracking-wider">
            Research Report
          </span>
        </div>
        
        <div className="p-6 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-primary mb-4 pb-2 border-b border-border">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold text-primary/90 mt-8 mb-4">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium text-foreground mt-6 mb-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-foreground/80 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-none space-y-2 my-4">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-2 text-foreground/80">
                  <span className="text-primary mt-1">→</span>
                  <span>{children}</span>
                </li>
              ),
              a: ({ href, children }) => (
                <a 
                  href={href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 underline underline-offset-2"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary pl-4 my-4 text-muted-foreground italic">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono text-sm">
                  {children}
                </code>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-primary">
                  {children}
                </strong>
              ),
            }}
          >
            {report}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
