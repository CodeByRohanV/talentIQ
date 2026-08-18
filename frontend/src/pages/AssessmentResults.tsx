// Assessment Results Page
import { useEffect, useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

import {
  ArrowLeft,
  Loader2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Download,
  Eye,
  ShieldAlert,
  AlertTriangle,
  ClipboardList,
  CheckCircle,
  XCircle as XCircleIcon,
  AlertCircle,
  Mail,
  ArrowUpDown,
  Search,
  FileSpreadsheet,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { resolveApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { assessmentsAPI, candidatesAPI, resultsAPI, domainsAPI } from '@/lib/api';
import { format } from 'date-fns';

interface DetailedResponse {
  responseId: string;
  questionType: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  selectedAnswer: number | null;
  textAnswer: string | null;
  manualScore: number | null;
  graderFeedback: string | null;
  domain: string;
  difficulty: string;
  answeredAt: string;
  max_score?: number;
}

interface CandidateResult {
  id: string;
  name: string;
  email: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  overallScore: number | null;
  domainScores: Record<string, any> | null;
  passed: boolean | null;
  submissionMode: 'manual' | 'auto' | null;
  totalQuestions: number | null;
  attemptedQuestions: number | null;
  correctAnswers: number | null;
  incorrectAnswers: number | null;
  unansweredQuestions: number | null;
  unansweredQuestions: number | null;
  tabSwitchCount: number | null;
  photoIdUrl: string | null;
  ipAddress: string | null;
}

interface Domain {
  id: string;
  name: string;
  slug: string;
}


const CandidateReportView = ({ candidate, detailedResponses, loadingDetailed, getDomainName, onClose, assessmentTitle, onGradeSaved }: any) => {
  const [editingGrades, setEditingGrades] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-8 py-4" >
      {/* Header Info - Using Table for PDF stability */}
      <div className="bg-muted/40 p-6 rounded-2xl border border-border/50">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '40%', verticalAlign: 'top', paddingBottom: '4px' }}>
                <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Email Address</p>
                <p style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{candidate.email}</p>
              </td>
              <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center', paddingBottom: '4px' }}>
                <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Method</p>
                <div style={{ display: 'inline-block', border: '1px solid #e2e8f0', padding: '2px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', color: '#475569', backgroundColor: 'white', textTransform: 'capitalize' }}>
                  {candidate.submissionMode || 'Manual'} Submission
                </div>
              </td>
              <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center', paddingBottom: '4px' }}>
                <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>IP Address</p>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{candidate.ipAddress || 'N/A'}</p>
              </td>
              <td style={{ width: '20%', verticalAlign: 'top', textAlign: 'right', paddingBottom: '4px' }}>
                <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Status</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    backgroundColor: candidate.passed === null ? '#f59e0b' : (candidate.passed ? '#10b981' : '#ef4444'),
                    color: 'white',
                    padding: '4px 16px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    minWidth: '80px',
                    textAlign: 'center',
                    display: 'inline-block',
                    lineHeight: '1.2'
                  }}>
                    {candidate.passed === null ? 'NEEDS GRADING' : (candidate.passed ? 'Pass' : 'Fail')}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ paddingTop: '16px', verticalAlign: 'top' }}>
                <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Test Date</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                  {candidate.startedAt ? format(new Date(candidate.startedAt), 'MMM dd, yyyy') : 'N/A'}
                </p>
              </td>
              <td style={{ paddingTop: '16px', verticalAlign: 'top', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Start Time</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                  {candidate.startedAt ? format(new Date(candidate.startedAt), 'hh:mm:ss a') : 'N/A'}
                </p>
              </td>
              <td style={{ paddingTop: '16px', verticalAlign: 'top', textAlign: 'right' }}>
                <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>End Time</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                  {candidate.completedAt ? format(new Date(candidate.completedAt), 'hh:mm:ss a') : 'N/A'}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Photo ID Section */}
      {candidate.photoIdUrl && (
        <div className="flex flex-col items-center p-4 bg-muted/20 border rounded-xl">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-3">Identity Verification Photo</p>
          <img
            src={candidate.photoIdUrl.startsWith('http')
              ? `${resolveApiUrl(import.meta.env.VITE_API_URL).replace(/\/+$/, '')}/proctoring/media?url=${encodeURIComponent(candidate.photoIdUrl)}`
              : `${resolveApiUrl(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '')}${candidate.photoIdUrl}`}
            alt="Candidate ID"
            crossOrigin="anonymous"
            className="rounded-lg shadow-sm border max-w-[240px] max-h-[240px] object-cover"
          />
        </div>
      )}

      {/* Performance Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20 shadow-none">
          <CardContent className="pt-6 text-center p-4">
            <p className="text-[10px] font-black uppercase text-primary/60 mb-1">Score</p>
            <p className="text-3xl font-black text-primary">{candidate.overallScore !== null ? `${candidate.overallScore}%` : 'N/A'}</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20 shadow-none">
          <CardContent className="pt-6 text-center p-4">
            <p className="text-[10px] font-black uppercase text-success/60 mb-1">Correct</p>
            <p className="text-3xl font-black text-success">{candidate.correctAnswers !== null ? candidate.correctAnswers : '—'}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          "shadow-none",
          (candidate.unansweredQuestions || 0) > 0 ? "bg-amber-50 border-amber-200" : "bg-muted border-border/50"
        )}>
          <CardContent className="pt-6 text-center p-4">
            <p className={cn(
              "text-[10px] font-black uppercase mb-1",
              (candidate.unansweredQuestions || 0) > 0 ? "text-amber-600" : "text-muted-foreground"
            )}>Unanswered</p>
            <p className={cn(
              "text-3xl font-black",
              (candidate.unansweredQuestions || 0) > 0 ? "text-amber-600" : ""
            )}>{candidate.unansweredQuestions || 0}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          "shadow-none",
          (candidate.tabSwitchCount || 0) > 0 ? "bg-destructive/5 border-destructive/20" : "bg-muted border-border/50"
        )}>
          <CardContent className="pt-6 text-center p-4">
            <div className="flex flex-col items-center">
              <p className={cn(
                "text-[10px] font-black uppercase mb-1",
                (candidate.tabSwitchCount || 0) > 0 ? "text-destructive/60" : "text-muted-foreground"
              )}>Tab Switches</p>
              <div className="flex items-center gap-1">
                {(candidate.tabSwitchCount || 0) > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <p className={cn(
                  "text-3xl font-black",
                  (candidate.tabSwitchCount || 0) > 0 ? "text-destructive" : ""
                )}>{candidate.tabSwitchCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Advisory */}
      {(candidate.tabSwitchCount || 0) > 0 && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-destructive">Security Alert: Tab Switching Detected</h4>
            <p className="text-xs text-destructive/80 mt-1 leading-relaxed">
              This candidate attempted to switch browser tabs or windows **{candidate.tabSwitchCount} times** during the assessment.
            </p>
          </div>
        </div>
      )}



      {/* Question Breakdown */}
      <div className="space-y-4 pt-4 border-t">
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
              <Card id={`question-${item.responseId || idx}`} key={`${candidate?.id || 'candidate'}-${item.questionId || idx}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }} className={cn(
                "shadow-none border-l-4 break-inside-avoid",
                item.questionType === 'SUBJECTIVE'
                  ? "border-l-blue-500 bg-blue-50/10"
                  : item.selectedAnswer === item.correctAnswer
                    ? "border-l-success bg-success/5"
                    : item.selectedAnswer === null
                      ? "border-l-amber-500 bg-amber-50/30"
                      : "border-l-destructive bg-destructive/5"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-0.5 uppercase border-transparent rounded-md">
                        Q{idx + 1}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 uppercase border-transparent rounded-md">
                        {getDomainName(item.domain)}
                      </Badge>
                      {item.questionType !== 'SUBJECTIVE' && item.selectedAnswer === null && (
                        <Badge variant="outline" className="text-[9px] font-black text-amber-700 bg-amber-100 border-amber-300 px-2 py-0.5 uppercase tracking-wide rounded-md">
                          NOT ANSWERED
                        </Badge>
                      )}
                      {item.questionType !== 'SUBJECTIVE' && item.selectedAnswer === item.correctAnswer && (
                        <Badge className="text-[9px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-0.5 border-transparent uppercase tracking-wide rounded-md">
                          CORRECT
                        </Badge>
                      )}
                      {item.questionType !== 'SUBJECTIVE' && item.selectedAnswer !== null && item.selectedAnswer !== item.correctAnswer && (
                        <Badge className="text-[9px] font-black text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 border-transparent uppercase tracking-wide rounded-md">
                          INCORRECT
                        </Badge>
                      )}
                      {item.questionType === 'SUBJECTIVE' && item.manualScore !== null && (
                        <Badge className="text-[9px] font-black text-white bg-blue-500 hover:bg-blue-600 px-2 py-0.5 border-transparent uppercase tracking-wide rounded-md">
                          GRADED: {item.manualScore}
                        </Badge>
                      )}
                      {item.questionType === 'SUBJECTIVE' && item.manualScore === null && (
                        <Badge variant="outline" className="text-[9px] font-black text-amber-700 bg-amber-100 border-amber-300 px-2 py-0.5 uppercase tracking-wide rounded-md">
                          NEEDS GRADING
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.difficulty}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold leading-relaxed pt-2">
                    {item.questionText}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {(item.questionType === 'SUBJECTIVE' || item.question_type === 'SUBJECTIVE') ? (
                    <div className="space-y-4 w-full max-w-full overflow-hidden">
                      <div className="p-4 bg-muted/30 border rounded-lg whitespace-pre-wrap break-all [overflow-wrap:anywhere] min-w-0">
                        {item.textAnswer || <span className="text-muted-foreground italic">No text answer provided.</span>}
                      </div>
                      {item.manualScore !== null && item.manualScore !== undefined && !editingGrades[item.responseId] ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-green-200 bg-green-50/30 rounded-lg gap-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <Trophy className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="w-full max-w-full overflow-hidden">
                              <h4 className="text-sm font-bold text-green-900">Graded: {item.manualScore} / {item.max_score || 1}</h4>
                              {item.graderFeedback && <p className="text-xs text-green-700/80 mt-0.5 whitespace-pre-wrap break-all [overflow-wrap:anywhere] min-w-0">"{item.graderFeedback}"</p>}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold bg-white shrink-0" onClick={() => {
                            setEditingGrades(prev => ({ ...prev, [item.responseId]: true }));
                          }}>
                            Edit Grade
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 mt-2 border rounded-xl bg-slate-50/50 dark:bg-slate-900/30 flex-nowrap" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <div className="flex-1 w-full min-w-[200px]">
                            <Input
                              className="w-full h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm"
                              placeholder="Add optional feedback..."
                              defaultValue={item.graderFeedback || ''}
                              id={`feedback-${item.responseId}`}
                            />
                          </div>

                          <div className="flex items-center gap-4 shrink-0 flex-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Points:</span>
                              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2.5 py-1 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                                <Input
                                  type="number"
                                  className="w-14 h-7 text-center font-bold p-0 border-none shadow-none focus-visible:ring-0 bg-transparent text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  min="0"
                                  max={item.max_score || 1}
                                  step="0.5"
                                  defaultValue={item.manualScore ?? (!item.textAnswer?.trim() ? 0 : '')}
                                  id={`score-${item.responseId}`}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const max = item.max_score || 1;
                                    if (!isNaN(val)) {
                                      if (val > max) e.target.value = max.toString();
                                      if (val < 0) e.target.value = "0";
                                    }
                                  }}
                                />
                                <span className="text-slate-400 font-medium select-none text-sm pr-1">/ {item.max_score || 1}</span>
                              </div>
                            </div>
                            <Button size="sm" className="h-9 px-5 shadow-sm shrink-0 font-semibold" onClick={async (e) => {
                              const btn = e.currentTarget;
                              const feedback = (document.getElementById(`feedback-${item.responseId}`) as HTMLInputElement)?.value;
                              const score = (document.getElementById(`score-${item.responseId}`) as HTMLInputElement)?.value;
                              if (score === '') return;

                              const parsedScore = parseFloat(score);
                              const maxScore = item.max_score || 1;
                              if (parsedScore < 0 || parsedScore > maxScore) {
                                toast({ title: 'Invalid Score', description: `Score cannot exceed the maximum marks of ${maxScore}.`, variant: 'destructive' });
                                return;
                              }

                              const originalText = btn.innerText;
                              btn.innerText = 'Saving...';
                              btn.disabled = true;
                              try {
                                const res = await resultsAPI.gradeResponse(item.responseId || null, parsedScore, feedback, candidate.id, item.questionId);
                                btn.innerText = 'Saved!';
                                btn.classList.add('bg-success');

                                // End edit mode locally so it flips to static view
                                setEditingGrades(prev => ({ ...prev, [res.data?.id || item.responseId]: false }));

                                if (typeof onGradeSaved === 'function') {
                                  onGradeSaved(res.data?.overallScore || res.overallScore, res.data?.unansweredQuestions || res.unansweredQuestions, res.data?.id || item.responseId, parsedScore, feedback, res.passed ?? res.data?.passed, item.questionId);
                                }

                                setTimeout(() => { btn.innerText = originalText; btn.disabled = false; btn.classList.remove('bg-success'); }, 2000);
                              } catch (err: any) {
                                alert('Error saving grade: ' + err.message);
                                btn.innerText = originalText;
                                btn.disabled = false;
                              }
                            }}>Save Grade</Button>
                            {item.manualScore !== null && item.manualScore !== undefined && (
                              <Button size="sm" variant="ghost" className="h-9 shrink-0 text-muted-foreground" onClick={() => {
                                setEditingGrades(prev => ({ ...prev, [item.responseId]: false }));
                              }}>Cancel</Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {(item.options || []).map((option: any, optIdx: number) => (
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
                            <span className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                              optIdx === item.correctAnswer ? "bg-success text-white" : "bg-muted"
                            )}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            {option}
                          </div>
                          <div className="flex items-center gap-2">
                            {optIdx === item.correctAnswer && (
                              <span className="text-[9px] font-black uppercase text-success mr-2">Correct Answer</span>
                            )}
                            {optIdx === item.selectedAnswer && (
                              <span className={cn(
                                "text-[9px] font-black uppercase mr-2",
                                optIdx === item.correctAnswer ? "text-success" : "text-destructive"
                              )}>
                                {optIdx === item.correctAnswer ? "Your Choice" : "Candidate Selection"}
                              </span>
                            )}
                            {optIdx === item.correctAnswer && <CheckCircle className="h-4 w-4 shrink-0" />}
                            {optIdx === item.selectedAnswer && optIdx !== item.correctAnswer && <XCircleIcon className="h-4 w-4 shrink-0" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.questionType !== 'SUBJECTIVE' && item.selectedAnswer === null && (
                    <div className="p-2 bg-amber-50 border border-amber-100 rounded text-[11px] text-amber-700 font-medium flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Candidate did not provide an answer for this question.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={() => {
          const firstUngradedIndex = detailedResponses.findIndex(r => r.manualScore === null && r.questionType === 'SUBJECTIVE');
          if (firstUngradedIndex !== -1) {
            const item = detailedResponses[firstUngradedIndex];
            const elId = `question-${item.responseId || firstUngradedIndex}`;
            const el = document.getElementById(elId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              el.style.transition = 'box-shadow 0.3s ease-in-out';
              el.style.boxShadow = '0 0 0 3px rgba(234, 179, 8, 0.5)';
              setTimeout(() => { el.style.boxShadow = 'none'; }, 2000);
              
              toast({ title: 'Action Required', description: 'Please grade all subjective questions before closing.', variant: 'destructive' });
              return;
            }
          }
          onClose && onClose();
        }} className="px-8">
          Close Report
        </Button>
      </div>
    </div>

  );
};

export default function AssessmentResults() {

  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [assessmentDuration, setAssessmentDuration] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);
  const [detailedResponses, setDetailedResponses] = useState<DetailedResponse[]>([]);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'pending' | 'timed_out' | 'passed' | 'failed'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof CandidateResult; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const reportRef = useRef<HTMLDivElement>(null);

  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [showUngradedGuard, setShowUngradedGuard] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [id, user, authLoading, navigate, toast]);

  const handleSort = (key: keyof CandidateResult) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getDomainName = (key: string) => {
    const domain = domains.find(d => d.id === key || d.slug === key);
    if (domain) return domain.name;
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const activeDomains = Array.from(new Set(
    candidates.flatMap(c => c.domainScores ? Object.keys(c.domainScores) : [])
  ));

  const filteredAndSortedCandidates = candidates
    .filter(c => {
      // Search Term
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase());

      // Status Filter
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;

      const isTimedOut = c.status === 'in_progress' &&
        c.startedAt &&
        assessmentDuration &&
        (new Date().getTime() - new Date(c.startedAt).getTime()) > (assessmentDuration * 60 * 1000);

      if (statusFilter === 'timed_out') return isTimedOut;
      if (statusFilter === 'passed') return c.passed === true;
      if (statusFilter === 'failed') return c.passed === false;
      if (statusFilter === 'completed') return c.status === 'completed';
      if (statusFilter === 'in_progress') return c.status === 'in_progress' && !isTimedOut;
      if (statusFilter === 'pending') return c.status === 'pending';

      return true;
    })
    .sort((a, b) => {
      const { key, direction } = sortConfig;
      const aValue = a[key] ?? '';
      const bValue = b[key] ?? '';

      if (aValue === bValue) return 0;
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      return direction === 'asc' ? 1 : -1;
    });

  useEffect(() => {
    if (selectedCandidate && showResultDialog) {
      fetchDetailedResponses(selectedCandidate.id);
    }
  }, [selectedCandidate, showResultDialog]);

  const fetchDetailedResponses = async (candidateId: string) => {
    try {
      setLoadingDetailed(true);
      const res = await resultsAPI.getDetailedByCandidate(candidateId);
      setDetailedResponses(res.data || []);
    } catch (error) {
      console.error('Error fetching detailed responses:', error);
    } finally {
      setLoadingDetailed(false);
    }
  };

  useEffect(() => {
    if (user && id) fetchResults();
  }, [user, id]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      if (!id) return;

      const [assessmentRes, candidatesRes, resultsRes, domainsRes] = await Promise.all([
        assessmentsAPI.getById(id),
        candidatesAPI.getByAssessment(id),
        resultsAPI.getByAssessment(id),
        domainsAPI.getAll()
      ]);

      if (assessmentRes?.data) {
        setAssessmentTitle(assessmentRes.data.title);
        setAssessmentDuration(assessmentRes.data.duration_minutes || null);
      }
      setDomains(domainsRes.data || []);

      const candidatesData = candidatesRes?.data || [];
      const resultsData = resultsRes?.data || [];

      const resultsMap: Record<string, any> = {};
      resultsData.forEach((r: any) => { if (r.candidateId) resultsMap[r.candidateId] = r; });

      const combined: CandidateResult[] = candidatesData.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        status: c.status || 'pending',
        startedAt: c.startedAt || null,
        completedAt: c.completedAt || null,
        overallScore: resultsMap[c.id]?.overallScore ?? null,
        domainScores: resultsMap[c.id]?.domainScores ?? null,
        passed: resultsMap[c.id]?.passed ?? null,
        submissionMode: resultsMap[c.id]?.submissionMode ?? null,
        totalQuestions: resultsMap[c.id]?.totalQuestions ?? null,
        attemptedQuestions: resultsMap[c.id]?.attemptedQuestions ?? null,
        correctAnswers: resultsMap[c.id]?.correctAnswers ?? null,
        incorrectAnswers: resultsMap[c.id]?.incorrectAnswers ?? null,
        unansweredQuestions: resultsMap[c.id]?.unansweredQuestions ?? null,
        tabSwitchCount: resultsMap[c.id]?.tabSwitchCount ?? null,
        photoIdUrl: resultsMap[c.id]?.photoIdUrl ?? null,
        ipAddress: resultsMap[c.id]?.ipAddress ?? null,
      }));

      setCandidates(combined);
    } catch (error: any) {
      console.error('Error fetching results:', error);
      toast({ title: 'Error', description: 'Failed to load assessment results', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (candidates.length === 0) return;

    const headers = ['Candidate Name', 'Email', 'Status', 'Submission Mode', 'Overall Score (%)', 'Correct', 'Total Questions', 'Passed', 'Started At', 'Completed At'];
    activeDomains.forEach(domain => {
      headers.push(`${getDomainName(domain)} (%)`);
    });

    const data = filteredAndSortedCandidates.map(c => {
      const startDate = c.startedAt ? format(new Date(c.startedAt), 'dd-MM-yyyy HH:mm') : 'N/A';
      const completionDate = c.completedAt ? format(new Date(c.completedAt), 'dd-MM-yyyy HH:mm') : 'N/A';
      const row: any = {
        'Candidate Name': c.name,
        'Email': c.email,
        'Status': c.status,
        'Submission Mode': c.submissionMode || 'manual',
        'Overall Score (%)': c.overallScore !== null ? `${c.overallScore}%` : 'N/A',
        'Correct': c.correctAnswers !== null ? c.correctAnswers : 'N/A',
        'Total Questions': c.totalQuestions !== null ? c.totalQuestions : 'N/A',
        'Passed': c.passed === null ? 'Needs Grading' : (c.passed ? 'Pass' : 'Fail'),
        'Started At': startDate,
        'Completed At': completionDate
      };

      activeDomains.forEach(domain => {
        const score = c.domainScores?.[domain];
        const key = `${getDomainName(domain)} (%)`;
        if (score === undefined || score === null) {
          row[key] = 'N/A';
        } else {
          const percentage = typeof score === 'object' ? (score as any).percentage : score;
          row[key] = `${percentage}%`;
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    worksheet['!cols'] = headers.map(() => ({ wch: 25 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    XLSX.writeFile(workbook, `${assessmentTitle || 'assessment'}_results.xlsx`);

    toast({
      title: 'Export complete',
      description: 'The results have been exported to Excel',
    });
  };

  const downloadAllPDFs = async () => {
    if (!id) return;
    const completedCandidates = candidates.filter(c => c.status === 'completed');
    if (completedCandidates.length === 0) {
      toast({ title: 'No Candidates', description: 'There are no completed candidates to generate reports for.', variant: 'destructive' });
      return;
    }

    try {
      setBulkDownloading(true);
      const res = await resultsAPI.downloadBulkPDF(id);
      
      const blob = new Blob([res as any], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${assessmentTitle.replace(/\s+/g, '_')}_All_Reports.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Bulk Download Complete',
        description: 'All candidate reports have been successfully generated.',
      });
    } catch (error) {
      console.error('Bulk PDF generation error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate bulk PDF reports. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBulkDownloading(false);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current || !selectedCandidate) return;

    try {
      setDownloading(true);
      const element = reportRef.current;
      const fileName = `${selectedCandidate.name.replace(/\s+/g, '_')}_Report.pdf`;

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

      toast({
        title: 'Report Downloaded',
        description: 'The candidate report has been saved as a PDF.',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate PDF report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard/assessments')} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assessments
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">{assessmentTitle || 'Assessment'} — Results</h1>
            <p className="text-muted-foreground mt-1">View candidate scores and performance</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button variant="outline" onClick={() => {
              if (candidates.some(c => c.status === 'completed' && c.passed === null)) {
                setShowUngradedGuard(true);
                return;
              }
              downloadAllPDFs();
            }} disabled={bulkDownloading || candidates.filter(c => c.status === 'completed').length === 0}>
              {bulkDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {bulkDownloading ? 'Generating ZIP...' : 'Download All Reports'}
            </Button>
            <Button variant="outline" onClick={() => {
              if (candidates.some(c => c.status === 'completed' && c.passed === null)) {
                setShowUngradedGuard(true);
                return;
              }
              exportToExcel();
            }}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="md:col-span-3">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search candidates by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 border-primary/10 focus-visible:ring-primary/20"
                    />
                  </div>
                  <div className="flex bg-muted p-1 rounded-xl border border-border/50 gap-1 overflow-x-auto no-scrollbar">
                    {(['all', 'completed', 'in_progress', 'pending', 'timed_out', 'passed', 'failed'] as const).map((filter) => (
                      <Button
                        key={filter}
                        variant={statusFilter === filter ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-8 text-[11px] font-black tracking-wider px-3 rounded-lg capitalize",
                          statusFilter === filter ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-primary"
                        )}
                        onClick={() => setStatusFilter(filter)}
                      >
                        {filter === 'pending' ? 'Not Started' : (filter === 'passed' ? 'Pass' : (filter === 'failed' ? 'Fail' : filter.replace('_', ' ')))}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="min-w-[140px]">
                <CardContent className="p-4 flex flex-col justify-center items-center h-full">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Average Score</p>
                  <p className="text-2xl font-black text-primary">
                    {(() => {
                      const fullyGraded = candidates.filter(c => c.status === 'completed' && c.passed !== null && c.overallScore !== null && !isNaN(Number(c.overallScore)));
                      if (fullyGraded.length === 0) return '0%';
                      const totalScore = fullyGraded.reduce((sum, c) => sum + Number(c.overallScore), 0);
                      return Math.round(totalScore / fullyGraded.length) + '%';
                    })()}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle>Candidates Detail List</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center text-[10px] font-black tracking-tighter text-muted-foreground/50">#</TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors group" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-2">
                          Candidate {sortConfig.key === 'name' && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                        <div className="flex items-center gap-2">
                          Status {sortConfig.key === 'status' && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('overallScore')}>
                        <div className="flex items-center gap-2">
                          Score {sortConfig.key === 'overallScore' && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </TableHead>
                      {activeDomains.map((domain) => (
                        <TableHead key={domain} className="hidden lg:table-cell">
                          {getDomainName(domain)}
                        </TableHead>
                      ))}
                      <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('completedAt')}>
                        <div className="flex items-center gap-2">
                          Completed {sortConfig.key === 'completedAt' && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </TableHead>
                      <TableHead>Unanswered</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedCandidates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8 + activeDomains.length} className="text-center py-8 text-muted-foreground">
                          No candidates found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedCandidates.map((candidate, index) => (
                        <TableRow key={candidate.id} className="group hover:bg-muted/50 transition-colors">
                          <TableCell className="text-center text-xs font-bold text-muted-foreground/60">{index + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold">{candidate.name}</p>
                              <p className="text-xs text-muted-foreground">{candidate.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const isTimedOut = candidate.status === 'in_progress' &&
                                candidate.startedAt &&
                                assessmentDuration &&
                                (new Date().getTime() - new Date(candidate.startedAt).getTime()) > (assessmentDuration * 60 * 1000);

                              if ((candidate.status === 'completed' && candidate.submissionMode === 'auto') || isTimedOut) {
                                return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-transparent capitalize text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">Auto-Submitted</Badge>;
                              }

                              if (candidate.status === 'completed') {
                                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent capitalize text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">Completed</Badge>;
                              }

                              if (candidate.status === 'in_progress') {
                                return <Badge className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 capitalize text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">In Progress</Badge>;
                              }

                              return (
                                <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 capitalize text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">
                                  Not Started
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            {candidate.overallScore !== null ? (
                              <div className="flex flex-col gap-1.5 min-w-[120px]">
                                <div className="flex items-center gap-2">
                                  <Progress value={candidate.overallScore} className="h-1.5 flex-1" />
                                  <span className="text-xs font-black w-8">
                                    {candidate.overallScore}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          {activeDomains.map((domain) => {
                            const scoreData = candidate.domainScores?.[domain];
                            if (scoreData === undefined || scoreData === null) {
                              return (
                                <TableCell key={domain} className="hidden lg:table-cell">
                                  <span className="text-xs text-muted-foreground">—</span>
                                </TableCell>
                              );
                            }
                            const isObject = typeof scoreData === 'object';
                            const percentage = isObject ? (scoreData as any).percentage : scoreData;
                            return (
                              <TableCell key={domain} className="hidden lg:table-cell">
                                <span className="text-xs font-bold text-primary">{percentage}%</span>
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <span className="text-xs font-medium">
                              {candidate.completedAt ? format(new Date(candidate.completedAt), 'MMM dd, HH:mm') :
                                (candidate.status === 'in_progress' && candidate.startedAt && assessmentDuration &&
                                  (new Date().getTime() - new Date(candidate.startedAt).getTime()) > (assessmentDuration * 60 * 1000)) ?
                                  format(new Date(new Date(candidate.startedAt).getTime() + (assessmentDuration * 60 * 1000)), 'MMM dd, HH:mm') + ' (Est.)' :
                                  '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-xs font-bold",
                              (candidate.unansweredQuestions || 0) > 0 ? "text-amber-600" : "text-muted-foreground"
                            )}>
                              {candidate.unansweredQuestions !== null ? candidate.unansweredQuestions : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {candidate.passed !== null ? (
                              candidate.passed ? (
                                <Badge className="bg-success text-white text-xs font-bold h-6 px-3">Pass</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs font-bold h-6 px-3">Fail</Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-black text-amber-700 bg-amber-100 border-amber-300 px-3 h-6 tracking-wide">Needs Grading</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {candidate.tabSwitchCount !== null && candidate.tabSwitchCount > 0 && (
                                <Badge variant="outline" className="border-destructive/40 bg-destructive/5 text-destructive font-bold h-6 px-1.5 text-[9px] cursor-pointer hover:bg-destructive/10" onClick={() => navigate(`/dashboard/assessments/${id}/results/${candidate.id}/proctoring`)}>
                                  <ShieldAlert className="h-2.5 w-2.5 mr-1" />
                                  {candidate.tabSwitchCount}
                                </Badge>
                              )}
                              {(candidate.status === 'completed' || candidate.status === 'in_progress') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-primary/5 hover:text-primary transition-colors border-primary/20"
                                  onClick={() => navigate(`/dashboard/assessments/${id}/results/${candidate.id}/proctoring`)}
                                  title="View Proctoring Evidence"
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-primary/5 hover:text-primary transition-colors"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setShowResultDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-10">
              <div className="flex items-center gap-2 text-2xl">
                <Eye className="h-6 w-6 text-primary" />
                Candidate Report: {selectedCandidate?.name}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-bold flex items-center gap-2"
                onClick={() => {
                  if (detailedResponses.some(r => r.manualScore === null && r.questionType === 'SUBJECTIVE')) {
                    setShowUngradedGuard(true);
                    return;
                  }
                  downloadPDF();
                }}
                disabled={downloading || loadingDetailed}
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin font-bold" /> : <Download className="h-4 w-4" />}
                {downloading ? 'Generating...' : 'Download PDF'}
              </Button>
            </DialogTitle>
            <DialogDescription>
              Detailed performance metrics for candidate evaluation.
            </DialogDescription>
          </DialogHeader>

          {selectedCandidate && (
            <div ref={reportRef}><CandidateReportView
              candidate={selectedCandidate}
              detailedResponses={detailedResponses}
              loadingDetailed={loadingDetailed}
              getDomainName={getDomainName}
              onClose={() => setShowResultDialog(false)}
              assessmentTitle={assessmentTitle}
              onGradeSaved={(newScore: number, newUnanswered: number, responseId: string, parsedScore: number, feedback: string, newPassed?: boolean, questionId?: string) => {
                setDetailedResponses(prev => prev.map(r =>
                  (r.responseId === responseId || r.questionId === questionId)
                    ? { ...r, responseId: responseId, manualScore: parsedScore, graderFeedback: feedback }
                    : r
                ));
                setSelectedCandidate(prev => prev ? {
                  ...prev,
                  overallScore: newScore,
                  unansweredQuestions: newUnanswered !== undefined ? newUnanswered : prev.unansweredQuestions,
                  passed: newPassed !== undefined ? newPassed : prev.passed
                } : prev);
                fetchResults();
              }}
            /></div>
          )}
        </DialogContent>
      </Dialog>


      <Dialog open={showUngradedGuard} onOpenChange={setShowUngradedGuard}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-6 w-6" />
              Grading Incomplete
            </DialogTitle>
            <DialogDescription className="pt-3 text-center text-base text-slate-600 dark:text-slate-300">
              Please grade all pending subjective responses before exporting reports.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-2">
            <Button onClick={() => setShowUngradedGuard(false)}>Understood</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>

  );
}
