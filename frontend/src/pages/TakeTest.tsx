import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { testAPI, candidatesAPI, proctoringAPI } from '@/lib/api';
import ProctoringEngine from '@/components/proctoring/ProctoringEngine';
import MultiMonitorDetector from '@/components/proctoring/MultiMonitorDetector';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  AlertCircle,
  Send,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Question {
  id: string;
  domain: string;
  domain_name?: string;
  questionText: string;
  options: string[];
  displayPosition: number; // backend-assigned shuffle position (0-based)
}

interface Response {
  questionId: string;
  selectedAnswer: number | null;
  isFlagged: boolean;
}

interface SecurityConfig {
  disableRightClick: boolean;
  disableCopyPaste: boolean;
  maxTabSwitchWarnings: number;
  fullscreenRequired: boolean;
  autoSubmitOnViolation: boolean;
  disablePrintScreen: boolean;
  monitorWindowResize: boolean;
  detectDevTools: boolean;
}

interface Assessment {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  instructions: string | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  videoProctoringEnabled?: boolean;
}

interface Candidate {
  id: string;
  name: string;
  status: string;
  startedAt: string | null;
}

export default function TakeTest() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Registration state
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [assessmentForRegistration, setAssessmentForRegistration] = useState<Assessment | null>(null);
  const [registering, setRegistering] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');

  // Test state
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Map<string, Response>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testCompleted, setTestCompleted] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  // Security & Anti-cheating state
  const [violationCount, setViolationCount] = useState(0);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [warningType, setWarningType] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Refs — always hold the latest values so event-listener callbacks never go stale
  const violationCountRef = useRef(0);
  const lastViolationTime = useRef(0);
  const isSubmittingRef = useRef(false);
  const showWarningDialogRef = useRef(false);
  const securityConfigRef = useRef<SecurityConfig | null>(null);
  const testCompletedRef = useRef(false);
  const tokenRef = useRef<string | undefined>(token);
  const internalClipboardRef = useRef<string>('');
  // Tracks when fullscreenchange last fired so resize events caused by
  // fullscreen transitions are not double-counted as separate violations
  const lastFullscreenChangeTime = useRef(0);

  // Keep refs in sync synchronously
  useLayoutEffect(() => {
    securityConfigRef.current = securityConfig;
  }, [securityConfig]);

  useLayoutEffect(() => {
    testCompletedRef.current = testCompleted;
  }, [testCompleted]);

  useLayoutEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useLayoutEffect(() => {
    showWarningDialogRef.current = showWarningDialog;
  }, [showWarningDialog]);

  useEffect(() => {
    if (token) {
      initializeTest();
    }
  }, [token]);

  // Timer effect
  useEffect(() => {
    if (timeRemaining <= 0 || requiresRegistration) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit('auto');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, requiresRegistration]);

  // Track visited questions
  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex]) {
      setVisitedQuestions((prev) => {
        const next = new Set(prev);
        next.add(questions[currentIndex].id);
        return next;
      });
    }
  }, [currentIndex, questions]);

  const getBrowserMetadata = () => ({
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    outerWindowSize: `${window.outerWidth}x${window.outerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    timestamp: new Date().toISOString(),
  });

  // Stable violation handler
  const handleViolation = useCallback(async (
    type: 'tab_switch' | 'fullscreen_exit' | 'forbidden_action' | 'resize' | 'devtools' | 'printscreen' | 'page_reload' | 'ai_violation',
    metadata: Record<string, unknown> = {}
  ) => {
    const cfg = securityConfigRef.current;
    if (!cfg || testCompletedRef.current || isSubmittingRef.current) return;

    // Feature-flag guards
    if (type === 'fullscreen_exit' && !cfg.fullscreenRequired) return;
    if (type === 'resize' && !cfg.monitorWindowResize) return;
    if (type === 'printscreen' && !cfg.disablePrintScreen) return;
    if (type === 'devtools' && !cfg.detectDevTools) return;

    const now = Date.now();
    if (now - lastViolationTime.current < 2000 && type !== 'forbidden_action') return;
    lastViolationTime.current = now;

    if (showWarningDialogRef.current && type !== 'forbidden_action') return;

    let newCount = violationCountRef.current;
    if (type === 'tab_switch' || type === 'fullscreen_exit' || type === 'resize' || type === 'devtools' || type === 'printscreen' || type === 'page_reload' || type === 'ai_violation') {
      newCount = violationCountRef.current + 1;
      violationCountRef.current = newCount;
    }

    try {
      // Capture proctoring screenshot if active (non-blocking)
      try {
        const pData = (window as any).__proctoringCapture?.();
        if (pData) {
          proctoringAPI.logEvent(pData.sessionId, type, 'Security violation triggered', pData.screenshotBase64, 'medium').catch(() => {});
        }
      } catch (_) { /* proctoring capture is best-effort */ }

      await testAPI.logViolation(tokenRef.current!, type, {
        ...metadata,
        browser: getBrowserMetadata(),
        violationCount: newCount,
      });
    } catch (err) {
      console.error('Error logging violation:', err);
    }

    if (type === 'tab_switch' || type === 'fullscreen_exit' || type === 'resize' || type === 'devtools' || type === 'printscreen' || type === 'page_reload' || type === 'ai_violation') {
      const maxWarnings = Number(cfg.maxTabSwitchWarnings || 3);

      if (newCount >= maxWarnings) {
        if (!isSubmittingRef.current) {
          isSubmittingRef.current = true;
          setViolationCount(newCount);
          setIsTerminated(true);
          setTerminationReason('security_violation');
          setShowWarningDialog(false);
          toast({
            title: 'Assessment Terminated',
            description: 'Maximum security violations reached. The assessment has been locked.',
            variant: 'destructive',
          });
          handleSubmit('auto');
        }
      } else {
        setViolationCount(newCount);
        setWarningType(type);
        if (type === 'ai_violation' && metadata.reason) {
          setWarningMessage(metadata.reason as string);
        } else {
          setWarningMessage(null);
        }
        setShowWarningDialog(true);
      }
    }
  }, [toast]);

  // Anti-cheating effects
  useEffect(() => {
    if (loading || requiresRegistration || testCompleted || !securityConfig) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleViolation('tab_switch');
    };
    const handleFocus = () => { };
    const handleBlur = () => handleViolation('tab_switch');

    const handleFullscreenChange = () => {
      lastFullscreenChangeTime.current = Date.now();
      if (!document.fullscreenElement) {
        handleViolation('fullscreen_exit');
      }
    };

    const handleResize = () => {
      if (Date.now() - lastFullscreenChangeTime.current < 1000) return;
      handleViolation('resize');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        handleViolation('printscreen');
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
        handleViolation('forbidden_action', { action: 'devtools_shortcut', key: e.key });
      }
      // Detect reload shortcuts: F5, Ctrl+R, Ctrl+Shift+R
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.ctrlKey && e.shiftKey && e.key === 'R')) {
        e.preventDefault();
        handleViolation('page_reload', { action: 'reload_shortcut', key: e.key });
      }
    };

    let devtoolsDetectionInterval: NodeJS.Timeout;
    if (securityConfig.detectDevTools) {
      devtoolsDetectionInterval = setInterval(() => {
        const threshold = 160;
        if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
          handleViolation('devtools');
        }
      }, 3000);
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!testCompletedRef.current && !isSubmittingRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (devtoolsDetectionInterval) clearInterval(devtoolsDetectionInterval);
    };
  }, [loading, requiresRegistration, testCompleted, securityConfig, handleViolation]);

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        lastFullscreenChangeTime.current = Date.now();
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
      toast({
        title: 'Fullscreen Error',
        description: 'Failed to enter fullscreen. Please enable it for the test.',
        variant: 'destructive',
      });
    }
  };

  const initializeTest = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await testAPI.getTest(token!) as any;

      if (response.requiresRegistration) {
        setRequiresRegistration(true);
        setAssessmentForRegistration(response.data.assessment);
        setLoading(false);
        return;
      }

      const { attemptId: initAttemptId, candidate: candidateData, assessment: assessmentData, securityConfig: securityData, questions: questionsData, responses: responsesData, timeRemaining: time, violationCount: vCount } = response.data;

      if (assessmentData.requiresPhotoId && !candidateData.photoIdCaptured) {
        navigate(`/test/${token}`, { replace: true });
        return;
      }

      setAttemptId(initAttemptId);
      setCandidate(candidateData);
      setAssessment(assessmentData);
      setSecurityConfig(securityData);
      setViolationCount(vCount || 0);
      violationCountRef.current = vCount || 0;

      // Detection of refresh/re-entry
      const sessionKey = `test_active_${token}`;
      if (sessionStorage.getItem(sessionKey)) {
        // If it was already active in this tab session, it's likely a refresh
        handleViolation('page_reload');
      } else {
        // Mark as active for future refreshes
        sessionStorage.setItem(sessionKey, 'true');
      }

      // Sort by displayPosition to guarantee candidate-specific shuffle
      const sortedQuestions = [...questionsData].sort(
        (a: Question, b: Question) => (a.displayPosition ?? 0) - (b.displayPosition ?? 0)
      );
      setQuestions(sortedQuestions);
      setTimeRemaining(time);

      const responseMap = new Map<string, Response>();
      responsesData.forEach((r: any) => {
        responseMap.set(r.questionId, {
          questionId: r.questionId,
          selectedAnswer: r.selectedAnswer,
          isFlagged: r.isFlagged,
        });
      });
      setResponses(responseMap);

      if (candidateData.status === 'pending') {
        await testAPI.startTest(token!);
      }

      if (candidateData.status === 'completed') {
        setTestCompleted(true);
        setTestResult({ stats: { submissionMode: 'manual' }, alreadyCompleted: true });
        setLoading(false);
        sessionStorage.removeItem(sessionKey);
        return;
      }

      setLoading(false);
    } catch (err: any) {
      if (err.response?.data?.completed) {
        setTestCompleted(true);
        setTestResult({ stats: { submissionMode: 'manual' }, alreadyCompleted: true });
        setLoading(false);
        sessionStorage.removeItem(`test_active_${token}`);
        return;
      }
      const message = err.response?.data?.message || err.message || 'Failed to load test';
      setError(message);
      setLoading(false);
    }
  };

  const [registrationCompleted, setRegistrationCompleted] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [tempId, setTempId] = useState<number | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim()) {
      toast({ title: 'Missing information', description: 'Please provide both name and email', variant: 'destructive' });
      return;
    }
    if (!assessmentForRegistration) return;

    try {
      setRegistering(true);
      const response = await candidatesAPI.register({
        assessmentId: assessmentForRegistration.id,
        name: candidateName.trim(),
        email: candidateEmail.trim(),
      });
      
      if (response.requiresOtp) {
        setTempId(response.tempId);
        setShowOtpInput(true);
        setRegistering(false);
        return;
      }
      
      const newToken = response.data?.shareToken || response.data?.share_token || response.shareToken;
      if (newToken) {
        setTempToken(newToken);
        setRegistrationCompleted(true);
      } else {
        toast({ title: 'Registration failed', description: 'Access token missing', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.response?.data?.message || err.message || 'Failed to register. Please try again.', variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !tempId) return;
    setRegistering(true);
    try {
      const response = await candidatesAPI.verifyOtp({ tempId, otp: otpCode });
      const newToken = response.data?.shareToken || response.data?.share_token || response.shareToken;
      if (newToken) {
        setTempToken(newToken);
        setRegistrationCompleted(true);
      } else {
        toast({ title: 'Verification failed', description: 'Access token missing', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Verification failed', description: err.response?.data?.message || 'Invalid OTP.', variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  const startTestFromFallback = () => {
    if (tempToken) {
      navigate(`/test/${tempToken}/take`, { replace: true });
    }
  };

  const handleAnswerChange = async (questionId: string, answerIndex: number) => {
    const currentRes = responses.get(questionId);
    const newAnswerIndex = currentRes?.selectedAnswer === answerIndex ? null : answerIndex;

    const newResponse: Response = {
      questionId,
      selectedAnswer: newAnswerIndex,
      isFlagged: currentRes?.isFlagged || false,
    };

    setResponses(new Map(responses.set(questionId, newResponse)));

    try {
      await testAPI.saveResponse(token!, questionId, newAnswerIndex, newResponse.isFlagged);
    } catch (err) {
      console.error('Error saving response:', err);
    }
  };

  const toggleFlag = async (questionId: string) => {
    const currentRes = responses.get(questionId);
    const newResponse: Response = {
      questionId,
      selectedAnswer: currentRes?.selectedAnswer ?? null,
      isFlagged: !currentRes?.isFlagged,
    };

    setResponses(new Map(responses.set(questionId, newResponse)));

    try {
      await testAPI.saveResponse(token!, questionId, newResponse.selectedAnswer, newResponse.isFlagged);
    } catch (err) {
      console.error('Error toggling flag:', err);
    }
  };

  const handleSubmit = async (mode: string = 'manual') => {
    if (submitting) return;

    try {
      setSubmitting(true);
      isSubmittingRef.current = true;
      const result = await testAPI.submitTest(token!, mode);
      setTestResult(result.data);
      setTestCompleted(true);
      if (mode === 'auto' && violationCountRef.current >= (securityConfig?.maxTabSwitchWarnings || 3)) {
        setIsTerminated(true);
        setTerminationReason('security_violation');
      }
      setShowSubmitDialog(false);
      setShowWarningDialog(false);
      sessionStorage.removeItem(`test_active_${token}`);
      toast({ title: 'Test submitted!', description: mode === 'auto' ? 'Test was auto-submitted due to time or violations.' : 'Your responses have been recorded.' });
    } catch (err: any) {
      isSubmittingRef.current = false;
      toast({ title: 'Submission failed', description: err.message || 'Failed to submit test', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const currentResponse = currentQuestion ? responses.get(currentQuestion.id) : null;
  const answeredCount = Array.from(responses.values()).filter((r) => r.selectedAnswer !== null).length;
  const flaggedCount = Array.from(responses.values()).filter((r) => r.isFlagged).length;
  const allVisited = visitedQuestions.size === questions.length;

  if (requiresRegistration && assessmentForRegistration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        {!registrationCompleted ? (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md border border-slate-50">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
              </div>
              <CardTitle className="text-2xl">{showOtpInput ? 'Verify Email' : assessmentForRegistration.title}</CardTitle>
              {showOtpInput ? (
                <CardDescription className="mt-2">Enter the 6-digit code sent to your email.</CardDescription>
              ) : (
                assessmentForRegistration.description && <CardDescription className="mt-2">{assessmentForRegistration.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {showOtpInput ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code *</Label>
                    <Input 
                      id="otp" 
                      type="text" 
                      placeholder="123456" 
                      maxLength={6}
                      value={otpCode} 
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                      required 
                      disabled={registering} 
                      className="text-center text-2xl tracking-widest"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={registering || otpCode.length !== 6}>
                    {registering ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : <>Verify & Continue</>}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input id="name" type="text" placeholder="Enter your full name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} required disabled={registering} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input id="email" type="email" placeholder="Enter your email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} required disabled={registering} />
                  </div>
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    <p className="text-muted-foreground"><strong>Duration:</strong> {assessmentForRegistration.durationMinutes} minutes</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={registering}>
                    {registering ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering...</> : <><UserPlus className="mr-2 h-4 w-4" />Continue to Instructions</>}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Test Instructions
              </CardTitle>
              <CardDescription>Read carefully before you begin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {assessment?.instructions || assessmentForRegistration?.instructions ? (
                  <div className="p-4 bg-muted/60 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-border/50">
                    <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Specific Guidelines</p>
                    {assessment?.instructions || assessmentForRegistration?.instructions}
                  </div>
                ) : null}
                
                <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-1">Standard Prohibitions</p>
                {[
                  { title: "Internet", desc: "Ensure your connection is stable." },
                  { title: "Fullscreen", desc: "Exiting fullscreen is a violation." },
                  { title: "Monitoring", desc: "Tab switching is strictly tracked." },
                  { title: "Integrity", desc: "Copy-paste and Right-click are disabled." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-muted/40 rounded-lg text-sm">
                    <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-primary">0{i+1}</div>
                    <div><strong>{item.title}</strong>: <span className="text-muted-foreground">{item.desc}</span></div>
                  </div>
                ))}
              </div>
              <Button onClick={startTestFromFallback} className="w-full h-11 font-bold mt-4 shadow-lg shadow-primary/20">I'm Ready, Begin Test</Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Test</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isTerminated || (testCompleted && testResult?.stats?.submissionMode === 'auto' && violationCount >= (securityConfig?.maxTabSwitchWarnings || 3))) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-destructive/5">
        <Card className="max-w-md w-full border-destructive shadow-2xl">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-black text-destructive mb-3 tracking-tight">Full Screen Exited</h2>
            <p className="text-muted-foreground font-medium mb-6">
              Your assessment has been <strong>permanently locked</strong> due to multiple security violations. 
              The window was closed or fullscreen was exited after maximum warnings.
            </p>
            <div className="p-4 bg-muted/50 rounded-xl text-xs text-left space-y-2 border border-border/50">
              <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">Incident Report</p>
              <div className="flex justify-between"><span>Status:</span> <span className="font-bold text-destructive">Terminated</span></div>
              <div className="flex justify-between"><span>Violations:</span> <span className="font-bold">{violationCount} recorded</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (testCompleted && testResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Card className="max-w-md w-full animate-in fade-in zoom-in duration-500">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-2xl font-black mb-2 tracking-tight">Assessment Completed!</h2>
            <p className="text-muted-foreground mb-8">
              {testResult.alreadyCompleted 
                ? "You have already submitted this assessment. Your responses are being reviewed." 
                : "Thank you for completing the assessment. Your responses have been successfully recorded."}
            </p>
            <div className="p-4 bg-muted/50 rounded-xl border border-border/50 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-bold text-success">Submitted</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completion Method</span>
                <span className="font-bold capitalize">{testResult?.stats?.submissionMode || 'manual'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!assessment || !candidate || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full"><CardContent className="pt-6 text-center"><AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" /><h2 className="text-xl font-semibold mb-2">Technical Error</h2><p className="text-muted-foreground">Data missing or no questions found.</p></CardContent></Card>
      </div>
    );
  }

  const handleCopy = (e: React.ClipboardEvent) => {
    if (securityConfig?.disableCopyPaste) {
      e.preventDefault();
      return;
    }
    const text = window.getSelection()?.toString() || '';
    if (text) {
      internalClipboardRef.current = text;
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (securityConfig?.disableCopyPaste) {
      e.preventDefault();
      return;
    }
    
    const pastedText = e.clipboardData?.getData('text') || '';
    if (pastedText && pastedText !== internalClipboardRef.current) {
      e.preventDefault();
      handleViolation('forbidden_action', { action: 'external_paste' });
      toast({
        title: 'External Paste Blocked',
        description: 'Pasting content copied from outside the assessment is strictly prohibited.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div
      className="min-h-screen bg-background"
      onContextMenu={(e) => securityConfig?.disableRightClick && e.preventDefault()}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onCut={(e) => securityConfig?.disableCopyPaste && e.preventDefault()}
      style={{ userSelect: securityConfig?.disableCopyPaste ? 'none' : 'auto' } as any}
    >
      {!testCompleted && !isTerminated && assessment && candidate && attemptId && assessment.videoProctoringEnabled && (
         <ProctoringEngine attemptId={attemptId} onViolation={(t, m) => handleViolation(t as any, m)} isActive={true} />
      )}
      <AlertDialog open={!!securityConfig?.fullscreenRequired && !document.fullscreenElement && !testCompleted && !isTerminated}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fullscreen Mode Required</AlertDialogTitle>
            <AlertDialogDescription>Please enter fullscreen to continue the assessment.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { enterFullscreen(); }}>Enter Fullscreen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent className="border-destructive">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2"><AlertCircle className="h-6 w-6" /><AlertDialogTitle>Security Violation Detected</AlertDialogTitle></div>
            <AlertDialogDescription asChild>
              <div className="text-sm text-foreground">
                {warningType === 'tab_switch' && "You switched tabs or windows."}
                {warningType === 'fullscreen_exit' && "You exited fullscreen mode."}
                {warningType === 'resize' && "Window resizing detected."}
                {warningType === 'devtools' && "Browser Developer Tools detected."}
                {warningType === 'printscreen' && "Screenshot attempt detected."}
                {warningType === 'page_reload' && "Page refresh detected. Please do not refresh the test window."}
                {warningType === 'ai_violation' && <span className="font-bold text-destructive">AI Detection: {warningMessage}</span>}
                <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-destructive font-semibold text-center">Warning {violationCount} of {securityConfig?.maxTabSwitchWarnings}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction onClick={() => { if (securityConfig?.fullscreenRequired && !document.fullscreenElement) enterFullscreen(); setShowWarningDialog(false); }}>I Understand</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{assessment.title}</h1>
              <p className="text-sm text-muted-foreground">Question {currentIndex + 1} of {questions.length}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className={cn("font-mono font-semibold", timeRemaining < 300 && "text-destructive")}>{formatTime(timeRemaining)}</span>
              </div>
              <Button onClick={() => setShowSubmitDialog(true)} variant="default"><Send className="mr-2 h-4 w-4" />Submit</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Question Area */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <Card className={cn("transition-all duration-200 border-2", (allVisited && !currentResponse?.selectedAnswer) ? "border-destructive/30 shadow-destructive/5" : "border-transparent")}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Badge variant="secondary" className="px-3 py-1 bg-primary/10 text-primary border-primary/20">
                      {currentQuestion.domain_name || currentQuestion.domain.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                    <p className="text-xl font-medium leading-relaxed">{currentQuestion.questionText}</p>
                  </div>
                  <Button variant={currentResponse?.isFlagged ? 'default' : 'outline'} size="icon" onClick={() => toggleFlag(currentQuestion.id)} className={cn(currentResponse?.isFlagged && "bg-warning hover:bg-warning/90 border-warning")}>
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentQuestion.options.map((option, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center space-x-4 border-2 rounded-xl p-5 transition-all cursor-pointer group hover:border-primary/40",
                        currentResponse?.selectedAnswer === index ? "bg-primary/5 border-primary ring-1 ring-primary" : "bg-card border-border hover:bg-accent/50"
                      )}
                      onClick={() => handleAnswerChange(currentQuestion.id, index)}
                    >
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors", currentResponse?.selectedAnswer === index ? "border-primary bg-primary" : "border-muted-foreground/30")}>
                        {currentResponse?.selectedAnswer === index && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="text-lg font-medium">{option}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-between items-center pt-6 border-t font-semibold">
                  <div className="flex gap-4">
                    <Button variant="outline" size="lg" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="px-8"><ChevronLeft className="mr-2 h-5 w-5" />Prev</Button>
                    <Button variant="outline" size="lg" onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))} disabled={currentIndex === questions.length - 1} className="px-8">Next<ChevronRight className="ml-2 h-5 w-5" /></Button>
                  </div>
                  {currentResponse?.selectedAnswer !== null && currentResponse?.selectedAnswer !== undefined && (
                    <Button variant="ghost" size="sm" onClick={() => handleAnswerChange(currentQuestion.id, currentResponse.selectedAnswer!)} className="text-muted-foreground hover:text-destructive">Clear Selection</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar Navigator */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-success/5 rounded-lg border border-success/10"><div className="text-2xl font-bold text-success">{answeredCount}</div><div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Done</div></div>
                    <div className="text-center p-3 bg-warning/5 rounded-lg border border-warning/10"><div className="text-2xl font-bold text-warning">{flaggedCount}</div><div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Flag</div></div>
                  </div>
                  <div className="mt-4 pt-4 border-t text-sm flex justify-between items-center"><span className="text-muted-foreground">Progress</span><span className="font-bold">{Math.round((answeredCount / questions.length) * 100)}%</span></div>
                  <div className="mt-2 w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
                </CardContent>
              </Card>

              <Card className="flex flex-col max-h-[60vh]">
                <CardHeader className="py-4 border-b text-sm font-bold flex flex-row items-center justify-between">Question Navigator <Badge variant="outline">{currentIndex + 1}/{questions.length}</Badge></CardHeader>
                <CardContent className="p-4 overflow-y-auto">
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((q, idx) => {
                      const resp = responses.get(q.id);
                      const isAnswered = resp?.selectedAnswer !== null && resp?.selectedAnswer !== undefined;
                      const isFlagged = resp?.isFlagged;
                      const isCurrent = idx === currentIndex;

                      return (
                        <Button
                          key={q.id}
                          variant={isCurrent ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            'h-10 w-full font-bold transition-all relative',
                            isCurrent && 'ring-2 ring-primary ring-offset-2 scale-105 z-10',
                            isAnswered && !isCurrent && 'bg-success/10 border-success text-success hover:bg-success/20',
                            (!isAnswered && !isCurrent && visitedQuestions.has(q.id)) && 'bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20',
                            isFlagged && !isCurrent && 'border-warning ring-1 ring-warning/30'
                          )}
                          onClick={() => setCurrentIndex(idx)}
                        >
                          {idx + 1}
                          {isFlagged && (
                            <div className="absolute -top-1 -right-1">
                              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-warning shadow-sm">
                                <Flag className="h-2 w-2 text-white fill-current" />
                              </span>
                            </div>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <Button onClick={() => setShowSubmitDialog(true)} variant="default" size="lg" className="w-full h-12 text-lg font-bold shadow-lg"><Send className="mr-2 h-5 w-5" />Submit Test</Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Test?</AlertDialogTitle>
            <AlertDialogDescription>
              Done: {answeredCount}/{questions.length}
              {answeredCount < questions.length && <span className="block mt-2 text-destructive font-semibold">Warning: {questions.length - answeredCount} unanswered!</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmit()} disabled={submitting}>{submitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirm Submit'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
