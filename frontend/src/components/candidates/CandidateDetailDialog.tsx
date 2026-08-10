import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useEffect, useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { resultsAPI, domainsAPI, proctoringAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  PieChart, 
  Download, 
  Eye, 
  ClipboardList, 
  ShieldAlert, 
  AlertTriangle,
  CheckCircle,
  XCircle as XCircleIcon
} from 'lucide-react';

interface CandidateDetailProps {
  candidate: {
    id: string;
    name: string;
    email: string;
    status: string;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    assessment_title: string;
    assessment_id: string;
    result?: {
      overall_score: number;
      passed: boolean;
      domainScores?: Record<string, any>;
      submissionMode?: 'manual' | 'auto';
      totalQuestions?: number;
      attemptedQuestions?: number;
      correctAnswers?: number;
      incorrectAnswers?: number;
      unansweredQuestions?: number;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Domain {
  id: string;
  name: string;
  slug: string;
}

interface DomainScore {
  domain: string;
  score: number;
  total: number;
  percentage: number;
}

const formatDuration = (start: string | null, end: string | null) => {
  if (!start || !end) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const diffMs = endTime - startTime;

  if (diffMs <= 0) return '0s';

  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);

  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

export default function CandidateDetailDialog({ candidate, open, onOpenChange }: CandidateDetailProps) {
  const [domainScores, setDomainScores] = useState<DomainScore[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailedResponses, setDetailedResponses] = useState<any[]>([]);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [proctoringReport, setProctoringReport] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && candidate) {
      if (domains.length === 0) fetchDomains();
      if (candidate.result?.domainScores) {
        processScores(candidate.result.domainScores);
      } else if (candidate.status === 'completed') {
        fetchDomainScores();
      }

      if (candidate.status === 'completed') {
        fetchDetailedResponses();
        fetchProctoringReport();
      }
    } else {
      setDomainScores([]);
      setDetailedResponses([]);
      setProctoringReport(null);
    }
  }, [open, candidate]);

  const fetchProctoringReport = async () => {
    if (!candidate) return;
    try {
      const res = await proctoringAPI.getReport(candidate.id) as any;
      setProctoringReport(res.report);
    } catch (e) {
      console.error('Error fetching proctoring report', e);
    }
  };

  const processScores = (rawScores: Record<string, any>) => {
    const scores = Object.entries(rawScores)
      .map(([domain, val]) => {
        if (typeof val === 'number') {
          return { domain, score: 0, total: 0, percentage: val };
        }
        const correct = (val as any).correct || 0;
        const total = (val as any).total || 0;
        const percentage = (val as any).percentage !== undefined
          ? (val as any).percentage
          : (total > 0 ? Math.round((correct / total) * 100) : 0);

        return {
          domain,
          score: correct,
          total: total,
          percentage: percentage,
        };
      })
      .filter(s => s.total > 0 || s.percentage > 0);
    setDomainScores(scores);
  };

  const fetchDomains = async () => {
    try {
      const response = await domainsAPI.getAll();
      setDomains(response.data || []);
    } catch (err) {
      console.error('Error fetching domains:', err);
    }
  };

  const getDomainName = (key: string) => {
    const domain = domains.find(d => d.id === key || d.slug === key);
    if (domain) return domain.name;
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const fetchDomainScores = async () => {
    if (!candidate) return;
    setLoading(true);
    try {
      const response = await resultsAPI.getByCandidate(candidate.id);
      if (response.data?.domainScores) {
        processScores(response.data.domainScores);
      }
    } catch (error) {
      console.error('Error fetching domain scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedResponses = async () => {
    if (!candidate) return;
    setLoadingDetailed(true);
    try {
      const res = await resultsAPI.getDetailedByCandidate(candidate.id);
      setDetailedResponses(res.data || []);
    } catch (error) {
      console.error('Error fetching detailed responses:', error);
    } finally {
      setLoadingDetailed(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current || !candidate) return;

    try {
      setDownloading(true);
      const element = reportRef.current;
      const fileName = `${candidate.name.replace(/\s+/g, '_')}_Report.pdf`;

      const options = {
        margin: 10,
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const worker = html2pdf().set(options).from(element);
      await worker.save();
    } catch (error) {
      console.error('PDF generation error:', error);
    } finally {
      setDownloading(false);
    }
  };

  if (!candidate) return null;

  const duration = formatDuration(candidate.started_at || candidate.created_at, candidate.completed_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Candidate Report: {candidate.name}
            </div>
            {candidate.status === 'completed' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="font-bold flex items-center gap-2 mr-6"
                onClick={downloadPDF}
                disabled={downloading || loadingDetailed}
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? 'Generating...' : 'Download PDF'}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          <div ref={reportRef} className="space-y-6 py-2">
            {/* Candidate Info */}
          {/* Header Info - Table for PDF stability */}
          <div className="bg-muted/40 p-6 rounded-2xl border border-border/50">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '60%', verticalAlign: 'top', paddingBottom: '8px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{candidate.name}</h3>
                    <p style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', margin: '2px 0 0 0' }}>{candidate.email}</p>
                  </td>
                  <td style={{ width: '40%', verticalAlign: 'top', textAlign: 'right', paddingBottom: '8px' }}>
                    <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Test Status</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {candidate.status === 'completed' ? (
                        candidate.result?.submissionMode === 'auto' ? (
                          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center' }}>
                            Auto Submitted
                          </div>
                        ) : (
                          <div style={{ 
                            backgroundColor: '#10b981', 
                            color: 'white', 
                            padding: '4px 16px', 
                            borderRadius: '9999px', 
                            fontSize: '10px', 
                            fontWeight: '900', 
                            textTransform: 'uppercase',
                            minWidth: '100px',
                            textAlign: 'center',
                            display: 'inline-block'
                          }}>
                            Completed
                          </div>
                        )
                      ) : (
                        <div style={{ border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', color: '#64748b' }}>
                          {candidate.status.replace('_', ' ')}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingTop: '16px', verticalAlign: 'top' }}>
                    <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Test Date</p>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                      {candidate.started_at || candidate.created_at ? format(new Date(candidate.started_at || candidate.created_at), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </td>
                  <td colSpan={2} style={{ paddingTop: '16px', verticalAlign: 'top', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '32px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Start Time</p>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                          {candidate.started_at || candidate.created_at ? format(new Date(candidate.started_at || candidate.created_at), 'hh:mm:ss a') : 'N/A'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>End Time</p>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                          {candidate.completed_at ? format(new Date(candidate.completed_at), 'hh:mm:ss a') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '12px', paddingTop: '8px' }}>
               <span style={{ fontSize: '9px', fontWeight: '900', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                 Assessment: {candidate.assessment_title}
               </span>
            </div>
          </div>

          {/* Timeline & Overall */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none bg-accent/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase font-bold">Timeline</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Started:</span>
                    <span className="font-semibold">{format(new Date(candidate.started_at || candidate.created_at), 'MMM d, p')}</span>
                  </div>
                  {candidate.completed_at && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Finished:</span>
                      <span className="font-semibold">{format(new Date(candidate.completed_at), 'MMM d, p')}</span>
                    </div>
                  )}
                  {duration && (
                    <div className="flex justify-between text-xs pt-1 border-t border-accent/20">
                      <span className="text-muted-foreground font-medium">Total Duration:</span>
                      <span className="font-bold text-primary">{duration}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className={candidate.result?.passed ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}>
              <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Overall Result</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black">{candidate.result?.overall_score ?? 0}%</span>
                  <span className="text-xs font-semibold uppercase">{candidate.result?.passed ? 'Passed' : 'Failed'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* New Stats Section */}
          {candidate.result && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-success/5 border border-success/10 p-3 rounded-lg text-center">
                <p className="text-[10px] uppercase font-bold text-success/70 mb-1">Correct</p>
                <p className="text-xl font-bold text-success">{candidate.result.correctAnswers ?? 0}</p>
              </div>
              <div className="bg-destructive/5 border border-destructive/10 p-3 rounded-lg text-center">
                <p className="text-[10px] uppercase font-bold text-destructive/70 mb-1">Incorrect</p>
                <p className="text-xl font-bold text-destructive">{candidate.result.incorrectAnswers ?? 0}</p>
              </div>
              <div className="bg-muted border p-3 rounded-lg text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Unanswered</p>
                <p className="text-xl font-bold">{candidate.result.unansweredQuestions ?? 0}</p>
              </div>
            </div>
          )}

          {/* Domain Breakdown */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Domain Breakdown</h4>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>

            {candidate.result ? (
              <div className="space-y-5">
                {domainScores.length > 0 ? (
                  domainScores.map((ds) => (
                    <div key={ds.domain} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-semibold">{getDomainName(ds.domain)}</span>
                        <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-primary">
                          {ds.total > 0 ? `${ds.score} / ${ds.total} Questions` : `${ds.percentage}%`}
                        </span>
                      </div>
                      <Progress
                        value={ds.percentage}
                        className="h-2"
                        indicatorClassName={cn(
                          ds.percentage >= 70 ? "bg-success" :
                            ds.percentage >= 40 ? "bg-warning" : "bg-destructive"
                        )}
                      />
                    </div>
                  ))
                ) : !loading && (
                  <div className="text-center py-8 border-2 border-dashed rounded-xl">
                    <p className="text-sm text-muted-foreground italic">No detailed domain data found for this result.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed">
                <XCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">The candidate has not completed the test yet.</p>
              </div>
            )}
          </div>

          {/* Question Breakdown */}
          {candidate.status === 'completed' && (
            <div className="space-y-4 pt-6 border-t mt-6">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-3.5 w-3.5 text-primary" />
                </div>
                Question-by-Question Breakdown
              </h3>

              {loadingDetailed ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Loading detailed responses...</p>
                </div>
              ) : detailedResponses.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed">
                  <p className="text-sm text-muted-foreground">No detailed responses available for this candidate.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {detailedResponses.map((item, idx) => (
                    <Card key={idx} className={cn(
                      "shadow-none border-l-4",
                      item.selectedAnswer === item.correctAnswer 
                        ? "border-l-success bg-success/5" 
                        : item.selectedAnswer === null 
                          ? "border-l-muted bg-muted/20" 
                          : "border-l-destructive bg-destructive/5"
                    )}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-muted-foreground/10 text-muted-foreground px-1.5 py-0.5 rounded uppercase">
                              Q{idx + 1}
                            </span>
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">
                              {getDomainName(item.domain)}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {item.difficulty}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-semibold leading-relaxed pt-2">
                          {item.questionText}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-2">
                        <div className="grid gap-2">
                          {item.options.map((option: string, optIdx: number) => (
                            <div 
                              key={optIdx} 
                              className={cn(
                                "p-3 rounded-lg text-sm border flex items-center justify-between",
                                optIdx === item.correctAnswer 
                                  ? "bg-success/10 border-success/30 text-success font-medium" 
                                  : optIdx === item.selectedAnswer 
                                    ? "bg-destructive/10 border-destructive/30 text-destructive font-medium" 
                                    : "bg-background border-border"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                {option}
                              </div>
                              {optIdx === item.correctAnswer && <CheckCircle className="h-4 w-4 shrink-0" />}
                              {optIdx === item.selectedAnswer && optIdx !== item.correctAnswer && <XCircleIcon className="h-4 w-4 shrink-0" />}
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 flex items-center gap-4 text-[11px] font-medium">
                          {item.selectedAnswer === null ? (
                            <span className="text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">Unanswered</span>
                          ) : item.selectedAnswer === item.correctAnswer ? (
                            <span className="text-success bg-success/10 px-2 py-0.5 rounded flex items-center gap-1">
                              Correct Answer
                            </span>
                          ) : (
                            <span className="text-destructive bg-destructive/10 px-2 py-0.5 rounded flex items-center gap-1">
                              Incorrect Answer
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Proctoring Evidence Summary Link */}
          {candidate.status === 'completed' && proctoringReport && (
            <div className="space-y-4 pt-6 border-t mt-6">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center">
                  <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                </div>
                Proctoring & Security Status
              </h3>
              
              <Card className={cn(
                "border",
                (proctoringReport.logs?.length > 0) ? "border-destructive/20 bg-destructive/5" : "border-success/20 bg-success/5"
              )}>
                <CardContent className="p-4 flex items-center justify-between">
                   <div>
                     <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Cheating Risk Status</p>
                     <span className={cn("text-xl font-black", (proctoringReport.logs?.length > 0) ? "text-destructive" : "text-success")}>
                        {(proctoringReport.logs?.length > 0) ? `${proctoringReport.logs.length} Violations Detected` : 'CLEAN'}
                     </span>
                   </div>
                   <Button 
                     variant="outline"
                     className={cn(
                       "font-bold",
                       (proctoringReport.logs?.length > 0) ? "text-destructive border-destructive hover:bg-destructive/10" : ""
                     )}
                     onClick={() => {
                        window.location.href = `/dashboard/assessments/${candidate.assessment_id}/results/${candidate.id}/proctoring`;
                     }}
                   >
                     View Evidence Report
                   </Button>
                </CardContent>
              </Card>
            </div>
          )}

          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

