'use client';

import { useState } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { parseJsDocHeader } from '@/lib/jsdoc-parser';
import { analyzeScript, type ScriptAnalysis } from '@/lib/script-analyzer';
import { AnalysisWarning, ScriptType } from '@/types';
import {
  Loader2, Search, AlertTriangle, CheckCircle, Hash, ArrowRight,
  Boxes, FileCode2, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnhancedAnalysisResult {
  totalScripts: number;
  latestVersionsAnalyzed: number;
  scriptsByType: Record<ScriptType, number>;
  warnings: AnalysisWarning[];
  allFieldIds: string[];
  allModules: string[];
  allEntryPoints: { name: string; type: string; script: string }[];
  allRecordTypes: string[];
  perScriptAnalysis: { filename: string; analysis: ScriptAnalysis }[];
}

export function AnalyzeButton() {
  const { scripts, config } = useRepo();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<EnhancedAnalysisResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!config) return;
    setAnalyzing(true);
    setProgress(0);
    setResult(null);
    setStatusText('Finding scripts...');

    // Use ALL scripts, not just isLatest, but report on latest
    const latestScripts = scripts.filter((s) => s.isLatest);
    const warnings: AnalysisWarning[] = [];
    const scriptsByType: Record<ScriptType, number> = {
      client: 0, 'user-event': 0, scheduled: 0, suitelet: 0,
      restlet: 0, 'map-reduce': 0, 'workflow-action': 0, unknown: 0,
    };

    const allFieldIdsSet = new Set<string>();
    const allModulesSet = new Set<string>();
    const allRecordTypesSet = new Set<string>();
    const allEntryPoints: { name: string; type: string; script: string }[] = [];
    const perScriptAnalysis: { filename: string; analysis: ScriptAnalysis }[] = [];

    if (latestScripts.length === 0) {
      setResult({
        totalScripts: scripts.length,
        latestVersionsAnalyzed: 0,
        scriptsByType,
        warnings: [{
          type: 'missing_header',
          scriptName: '(none)',
          message: 'No latest-version scripts found. Try loading the repository first.',
        }],
        allFieldIds: [],
        allModules: [],
        allEntryPoints: [],
        allRecordTypes: [],
        perScriptAnalysis: [],
      });
      setAnalyzing(false);
      return;
    }

    // Batch fetch script contents and analyze
    const batchSize = 5;
    for (let i = 0; i < latestScripts.length; i += batchSize) {
      const batch = latestScripts.slice(i, i + batchSize);
      setStatusText(`Analyzing ${i + 1}-${Math.min(i + batchSize, latestScripts.length)} of ${latestScripts.length}...`);

      const promises = batch.map(async (script) => {
        try {
          const res = await fetch(
            `/api/repo/file?owner=${config.owner}&repo=${config.repo}&branch=${config.branch}&path=${encodeURIComponent(script.path)}`
          );
          if (!res.ok) return null;
          const data = await res.json();
          const content = data.content as string;
          const jsdoc = parseJsDocHeader(content);

          // Run script analyzer
          const analysis = analyzeScript(content);

          if (!jsdoc.description && !jsdoc.scriptType) {
            warnings.push({
              type: 'missing_header',
              scriptName: script.filename,
              message: `${script.filename} is missing JSDoc header`,
            });
          }

          scriptsByType[script.type]++;

          // Collect analysis results
          for (const fid of analysis.uniqueFieldIds) allFieldIdsSet.add(fid);
          for (const m of analysis.modules) allModulesSet.add(m.module);
          for (const rt of analysis.recordTypes) allRecordTypesSet.add(rt);
          for (const ep of analysis.entryPoints) {
            allEntryPoints.push({ name: ep.name, type: ep.type, script: script.filename });
          }
          perScriptAnalysis.push({ filename: script.filename, analysis });

          return { script, jsdoc, analysis };
        } catch {
          return null;
        }
      });

      await Promise.all(promises);
      setProgress(Math.min(100, Math.round(((i + batch.length) / latestScripts.length) * 100)));
    }

    setStatusText('Done!');
    setResult({
      totalScripts: scripts.length,
      latestVersionsAnalyzed: latestScripts.length,
      scriptsByType,
      warnings,
      allFieldIds: [...allFieldIdsSet].sort(),
      allModules: [...allModulesSet].sort(),
      allEntryPoints,
      allRecordTypes: [...allRecordTypesSet].sort(),
      perScriptAnalysis,
    });

    setAnalyzing(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleAnalyze} disabled={analyzing} size="lg" className="w-full">
        {analyzing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : result ? (
          <>
            <Search className="mr-2 h-4 w-4" />
            Re-Analyze All Scripts
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
          <p className="text-xs text-muted-foreground text-center">
            {statusText} ({progress}%)
          </p>
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
            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2.5 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Scripts Analyzed</p>
                <p className="text-xl font-bold">{result.latestVersionsAnalyzed}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Versions</p>
                <p className="text-xl font-bold">{result.totalScripts}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unique Fields</p>
                <p className="text-xl font-bold">{result.allFieldIds.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Modules Used</p>
                <p className="text-xl font-bold">{result.allModules.length}</p>
              </div>
            </div>

            {/* Scripts by Type */}
            {Object.values(result.scriptsByType).some((c) => c > 0) && (
              <div>
                <button
                  onClick={() => toggleSection('types')}
                  className="text-sm font-medium mb-2 flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <FileCode2 className="h-3.5 w-3.5" />
                  By Type
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {Object.values(result.scriptsByType).reduce((a, b) => a + b, 0)}
                  </Badge>
                </button>
                {expandedSection === 'types' && (
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
                )}
              </div>
            )}

            {/* Entry Points */}
            {result.allEntryPoints.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('entrypoints')}
                  className="text-sm font-medium mb-2 flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Entry Points
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {result.allEntryPoints.length}
                  </Badge>
                </button>
                {expandedSection === 'entrypoints' && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.allEntryPoints.map((ep, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400"
                        title={ep.script}
                      >
                        {ep.type}
                        <span className="text-[9px] ml-1 text-muted-foreground">{ep.script}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modules */}
            {result.allModules.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('modules')}
                  className="text-sm font-medium mb-2 flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Imported Modules
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {result.allModules.length}
                  </Badge>
                </button>
                {expandedSection === 'modules' && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.allModules.map((mod) => (
                      <span
                        key={mod}
                        className="text-xs px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-mono"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Field IDs */}
            {result.allFieldIds.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('fields')}
                  className="text-sm font-medium mb-2 flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <Hash className="h-3.5 w-3.5" />
                  Field IDs Referenced
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {result.allFieldIds.length}
                  </Badge>
                </button>
                {expandedSection === 'fields' && (
                  <div className="flex flex-wrap gap-1">
                    {result.allFieldIds.map((f) => (
                      <span
                        key={f}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono text-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Record Types */}
            {result.allRecordTypes.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('records')}
                  className="text-sm font-medium mb-2 flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  Record Types
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {result.allRecordTypes.length}
                  </Badge>
                </button>
                {expandedSection === 'records' && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.allRecordTypes.map((rt) => (
                      <span
                        key={rt}
                        className="text-xs px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-mono"
                      >
                        {rt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div>
                <button
                  onClick={() => toggleSection('warnings')}
                  className="text-sm font-medium mb-2 flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                  Warnings
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {result.warnings.length}
                  </Badge>
                </button>
                {expandedSection === 'warnings' && (
                  <div className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-muted-foreground bg-yellow-500/10 px-2 py-1 rounded">
                        {w.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No results message */}
            {result.latestVersionsAnalyzed === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <Info className="h-5 w-5 mx-auto mb-2" />
                No scripts found to analyze. Make sure scripts are loaded from the repository.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
