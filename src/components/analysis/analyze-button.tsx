'use client';

import { useState } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { parseJsDocHeader } from '@/lib/jsdoc-parser';
import { AnalysisResult, AnalysisWarning, ScriptType, Script } from '@/types';
import { Loader2, Search, AlertTriangle, CheckCircle } from 'lucide-react';

export function AnalyzeButton() {
  const { scripts, config } = useRepo();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!config) return;
    setAnalyzing(true);
    setProgress(0);
    setResult(null);

    const latestScripts = scripts.filter((s) => s.isLatest);
    const warnings: AnalysisWarning[] = [];
    const scriptsByType: Record<ScriptType, number> = {
      client: 0, 'user-event': 0, scheduled: 0, suitelet: 0,
      restlet: 0, 'map-reduce': 0, 'workflow-action': 0, unknown: 0,
    };

    // Batch fetch script contents
    const batchSize = 10;
    for (let i = 0; i < latestScripts.length; i += batchSize) {
      const batch = latestScripts.slice(i, i + batchSize);
      const promises = batch.map(async (script) => {
        try {
          const res = await fetch(
            `/api/repo/file?owner=${config.owner}&repo=${config.repo}&branch=${config.branch}&path=${encodeURIComponent(script.path)}`
          );
          if (!res.ok) return null;
          const data = await res.json();
          const jsdoc = parseJsDocHeader(data.content);

          if (!jsdoc.description && !jsdoc.scriptType) {
            warnings.push({
              type: 'missing_header',
              scriptName: script.filename,
              message: `${script.filename} is missing JSDoc header`,
            });
          }

          scriptsByType[script.type]++;
          return { script, jsdoc };
        } catch {
          return null;
        }
      });

      await Promise.all(promises);
      setProgress(Math.min(100, Math.round(((i + batch.length) / latestScripts.length) * 100)));
    }

    setResult({
      totalScripts: scripts.length,
      latestVersionsAnalyzed: latestScripts.length,
      scriptsByType,
      dependencies: [],
      fieldsReferenced: [],
      warnings,
    });

    setAnalyzing(false);
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleAnalyze} disabled={analyzing} size="lg" className="w-full">
        {analyzing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Analyze All Scripts & Dependencies
          </>
        )}
      </Button>

      {analyzing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground text-center">{progress}% complete</p>
        </div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Analysis Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Latest Scripts Analyzed</p>
                <p className="text-xl font-bold">{result.latestVersionsAnalyzed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Versions in Repo</p>
                <p className="text-xl font-bold">{result.totalScripts}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">By Type:</p>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {Object.entries(result.scriptsByType)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between px-2 py-1 rounded bg-muted/50">
                      <span className="capitalize">{type.replace('-', ' ')}</span>
                      <Badge variant="secondary" className="text-xs">{count}</Badge>
                    </div>
                  ))}
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Warnings ({result.warnings.length})
                </p>
                <div className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-muted-foreground bg-yellow-500/10 px-2 py-1 rounded">
                      {w.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
