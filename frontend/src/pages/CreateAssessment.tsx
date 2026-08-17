import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { assessmentsAPI, questionsAPI, domainsAPI } from '@/lib/api';
import { ArrowLeft, Loader2, Copy, CheckCircle2, ShieldAlert, ChevronDown, LayoutPanelLeft, Clock, Calendar, Minus, Plus, Video, VideoOff, Search, FileQuestion } from 'lucide-react';
import { z } from 'zod';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const assessmentSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100)
    .regex(/^[a-zA-Z0-9\s!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/, 'Title contains invalid characters'),
  instructions: z.string().max(2000).optional(),
  duration_minutes: z.number().min(1).max(180),
});

interface Domain {
  id: string;
  name: string;
  slug: string;
  counts: {
    total: number;
    easy: number;
    medium: number;
    hard: number;
  };
}

export default function CreateAssessment() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState(60);
  const [domains, setDomains] = useState<Domain[]>([]);

  // Auto Selection State
  const [questionsConfig, setQuestionsConfig] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [thresholds, setThresholds] = useState<Record<string, number>>({ overall: 60 });

  const [securityConfig, setSecurityConfig] = useState({
    disableRightClick: false,
    disableCopyPaste: false,
    maxTabSwitchWarnings: 3,
    fullscreenRequired: false,
    autoSubmitOnViolation: false,
    disablePrintScreen: false,
    monitorWindowResize: false,
    detectDevTools: false,
  });

  const [videoProctoringEnabled, setVideoProctoringEnabled] = useState(false);
  const [requiresPhotoId, setRequiresPhotoId] = useState(true);

  const [deadlineHours, setDeadlineHours] = useState<number | null>(null);
  const [availabilityMode, setAvailabilityMode] = useState<'anytime' | 'scheduled'>('anytime');
  const [testDate, setTestDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});



  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDomainsAndCounts();
    }
  }, [user]);

  const fetchDomainsAndCounts = async () => {
    try {
      const domainsRes = await domainsAPI.getAll();
      const fetchedDomains = domainsRes.data || [];
      setDomains(fetchedDomains);

      const slugToDomainId: Record<string, string> = {};

      fetchedDomains.forEach((d: any) => {
        slugToDomainId[d.slug] = d.id;
      });

      // Initialize config with zeros if not set
      const initialConfig: Record<string, Record<string, Record<string, number>>> = {};
      const initialThresholds: Record<string, number> = { overall: 60 };

      fetchedDomains.forEach((d: any) => {
        initialConfig[d.id] = {};
        if (d.counts && d.counts.types) {
            Object.keys(d.counts.types).forEach(type => {
                initialConfig[d.id][type] = { easy: 0, medium: 0, hard: 0 };
            });
        } else {
            initialConfig[d.id]['MCQ'] = { easy: 0, medium: 0, hard: 0 };
        }
        initialThresholds[d.id] = 50;
      });

      setQuestionsConfig(initialConfig);
      setThresholds(initialThresholds);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = assessmentSchema.safeParse({ title, instructions, duration_minutes: duration });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => { if (err.path[0]) fieldErrors[err.path[0] as string] = err.message; });
      setErrors(fieldErrors);
      return;
    }

    const totalAuto = Object.values(questionsConfig).reduce((sum, domainConfig) => {
      return sum + Object.values(domainConfig).reduce((dSum, typeConfig) => {
          return dSum + Object.values(typeConfig).reduce((tSum, count) => tSum + count, 0);
      }, 0);
    }, 0);

    const isAutoEmpty = totalAuto === 0;

    if (isAutoEmpty) {
      toast({ title: 'No questions selected', description: 'Please select at least one question', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Check for duplicate title (Optional: frontend pre-check if we had a list, 
      // but let's assume backend handles unique constraint if we add one.
      // For now, we'll just check if title is valid.)
      
      const questionIds: string[] = [];

      for (const [domainId, typesConfig] of Object.entries(questionsConfig)) {
        for (const [qType, difficulties] of Object.entries(typesConfig)) {
            for (const [difficulty, count] of Object.entries(difficulties)) {
              if (count > 0) {
                const isNumeric = /^\d+$/.test(domainId);
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(domainId);
                const filters: Record<string, string | number> = { limit: 1000, difficulty, questionType: qType };
                if (isNumeric || isUUID) filters.domainId = domainId;
                else filters.domain = domainId;

                const response = await questionsAPI.getAll(filters);
                const domainQuestions = response.data || [];
                const shuffled = domainQuestions.sort(() => Math.random() - 0.5).slice(0, count);
                shuffled.forEach((q: { id: string }) => questionIds.push(q.id));
              }
            }
        }
      }

      if (questionIds.length === 0) {
        toast({
          title: 'Assessment is empty',
          description: 'No questions were found in the database matching your selection. Please check your question bank.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      let expiresAt = null;
      if (deadlineHours) {
        const date = new Date();
        date.setHours(date.getHours() + deadlineHours);
        expiresAt = date.toISOString();
      }

      let availableFrom = null;
      let availableUntil = null;

      if (availabilityMode === 'scheduled' && testDate) {
        if (startTime) {
          availableFrom = new Date(`${testDate}T${startTime}`).toISOString();
        }
        if (endTime) {
          availableUntil = new Date(`${testDate}T${endTime}`).toISOString();
        }
      }

      const response = await assessmentsAPI.create({
        title,
        description: null,
        durationMinutes: duration,
        questionsConfig,
        thresholds,
        securityConfig,
        questionIds,
        expiresAt,
        availableFrom,
        availableUntil,
        instructions: instructions || null,
        videoProctoringEnabled,
        requiresPhotoId
      });

      const assessmentToken = response.data.shareToken || response.data.share_token;
      setShareLink(`${window.location.origin}/test/${assessmentToken}`);
      setCreated(true);
      toast({ title: 'Assessment created!', description: 'Your assessment is ready to share' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create assessment', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: 'Link copied!', description: 'Assessment link copied to clipboard' });
  };

  const totalQuestionsTotal = Object.values(questionsConfig).reduce((sum, domainConfig) => {
    return sum + Object.values(domainConfig).reduce((dSum, typeConfig) => {
        return dSum + Object.values(typeConfig).reduce((tSum, count) => tSum + count, 0);
    }, 0);
  }, 0);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (created) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-8 text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Assessment Created!</h2>
              <p className="text-muted-foreground mb-6">Share this link with candidates to take the test</p>
              <div className="flex items-center gap-2 bg-muted p-3 rounded-lg mb-6">
                <Input value={shareLink} readOnly className="bg-transparent border-0 text-sm" />
                <Button size="icon" variant="ghost" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard/assessments')}>View All Assessments</Button>
                <Button className="flex-1" onClick={() => { setCreated(false); setTitle(''); }}>Create Another</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/dashboard/assessments')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assessments
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold">Create Assessment</h1>
          <p className="text-muted-foreground mt-1">Configure your assessment settings</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle><CardDescription>Give your assessment a name and description</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Assessment Title *</Label>
                <Input id="title" placeholder="e.g., Software Engineer Aptitude Test" value={title} onChange={(e) => setTitle(e.target.value)} className={errors.title ? 'border-destructive' : ''} />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2 pt-2">
                <Label htmlFor="instructions" className="flex items-center gap-2">
                  Custom Instructions
                </Label>
                <Textarea 
                  id="instructions" 
                  placeholder="e.g., You will need a calculator for Section 2. Follow all standard code of conduct..." 
                  value={instructions} 
                  onChange={(e) => setInstructions(e.target.value)} 
                  className="min-h-[120px] font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground italic">These instructions will be shown to the candidate after they enter their details but before starting the timer.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Test Duration</CardTitle><CardDescription>Set the total time allowed per candidate</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><Label>Duration</Label><span className="text-lg font-semibold">{duration} minutes</span></div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-background border rounded-xl p-1 shadow-sm">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-primary/10"
                      onClick={() => setDuration(prev => Math.max(1, prev > 5 ? prev - 5 : prev - 1))}
                      disabled={duration <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input 
                      type="number"
                      className="w-14 h-8 text-center font-black border-none bg-transparent focus-visible:ring-0 p-0"
                      min={1}
                      max={180}
                      value={duration}
                      onChange={(e) => {
                        const val = Math.min(180, Math.max(1, parseInt(e.target.value) || 0));
                        setDuration(val);
                      }}
                    />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-primary/10"
                      onClick={() => setDuration(prev => Math.min(180, prev < 5 ? prev + 1 : prev + 5))}
                      disabled={duration >= 180}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">minutes</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Assessment Availability</CardTitle>
              <CardDescription>Choose when candidates can take the test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <div className="flex p-1 bg-muted rounded-lg w-fit mb-4">
                <Button 
                  type="button"
                  variant={availabilityMode === 'anytime' ? 'secondary' : 'ghost'} 
                  size="sm"
                  className={cn("h-8 text-xs font-bold", availabilityMode === 'anytime' && "bg-background shadow-sm")}
                  onClick={() => setAvailabilityMode('anytime')}
                >
                  Anytime Access
                </Button>
                <Button 
                  type="button"
                  variant={availabilityMode === 'scheduled' ? 'secondary' : 'ghost'} 
                  size="sm"
                  className={cn("h-8 text-xs font-bold", availabilityMode === 'scheduled' && "bg-background shadow-sm")}
                  onClick={() => setAvailabilityMode('scheduled')}
                >
                  Scheduled Slot
                </Button>
              </div>

              {availabilityMode === 'scheduled' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold tracking-tight">Time-Restricted Access</p>
                      <p className="text-xs text-muted-foreground">The test link will activate at the start time and expire exactly at the end time.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Testing Date
                      </Label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <Input 
                          type="date" 
                          value={testDate} 
                          onChange={(e) => setTestDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="pl-10 h-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Start Time
                        </Label>
                        <Input 
                          type="time" 
                          value={startTime} 
                          onChange={(e) => setStartTime(e.target.value)}
                          className="h-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 font-bold"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          End Time
                        </Label>
                        <Input 
                          type="time" 
                          value={endTime} 
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-12 bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Candidates attempting to access the test outside this window will see a 'Not Started' or 'Expired' message.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Relative Expiry</Label>
                      <p className="text-xs text-muted-foreground">Link expires after a certain period from creation</p>
                    </div>
                    <Switch
                      checked={deadlineHours !== null}
                      onCheckedChange={(checked) => setDeadlineHours(checked ? 24 : null)}
                    />
                  </div>
                  
                  {deadlineHours !== null && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex items-center gap-3">
                        <Clock className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-bold">Automatic Completion Enabled</p>
                          <p className="text-xs text-muted-foreground">The test will expire and mark itself as completed in {deadlineHours} hours.</p>
                        </div>
                      </div>
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <Label>Time until expiry</Label>
                          <span className="text-lg font-semibold">
                            {deadlineHours < 24 ? `${deadlineHours} hours` :
                              deadlineHours === 24 ? "1 day" :
                                `${Math.round(deadlineHours / 24)} days`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-background border rounded-xl p-1 shadow-sm">
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg hover:bg-primary/10"
                              onClick={() => setDeadlineHours(prev => {
                                if (prev === null) return 24;
                                const step = prev <= 24 ? 1 : 24;
                                return Math.max(1, prev - step);
                              })}
                              disabled={(deadlineHours || 0) <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input 
                              type="number"
                              className="w-14 h-8 text-center font-black border-none bg-transparent focus-visible:ring-0 p-0"
                              value={deadlineHours || 0}
                              onChange={(e) => {
                                const val = Math.min(168, Math.max(1, parseInt(e.target.value) || 0));
                                setDeadlineHours(val);
                              }}
                            />
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg hover:bg-primary/10"
                              onClick={() => setDeadlineHours(prev => {
                                if (prev === null) return 24;
                                const step = prev < 24 ? 1 : 24;
                                return Math.min(168, prev + step);
                              })}
                              disabled={(deadlineHours || 0) >= 168}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground/60 italic">
                            Max: 168 hours (7 days)
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          Once expired, the test will be marked as 'Completed' and the link will stop working.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutPanelLeft className="h-5 w-5 text-primary" />
                Question Distribution
              </CardTitle>
              <CardDescription>Select number of questions by domain and difficulty</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="pt-2">
                  <Accordion type="multiple" className="w-full space-y-3">
                {domains.map((domain) => {
                  const domainConfig = questionsConfig[domain.id] || {};
                  const domainTotal = Object.values(domainConfig).reduce((s, typeConfig) => s + Object.values(typeConfig).reduce((t, count) => t + count, 0), 0);
                  const available = domain.counts;

                  return (
                    <AccordionItem
                      key={domain.id}
                      value={domain.id}
                      className="border rounded-xl px-4 bg-muted/20 data-[state=open]:bg-muted/40 transition-colors"
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="font-bold text-base text-foreground">{domain.name}</span>
                            <span className="text-xs text-muted-foreground">Adjust easy, medium and hard questions</span>
                          </div>
                          <div className="bg-background/80 px-3 py-1 rounded-full border shadow-sm flex items-center gap-2">
                            <span className={`font-bold ${domainTotal > available.total ? 'text-destructive' : 'text-primary'}`}>
                              {domainTotal}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {available.total} selected</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-6 pt-2">
                        <div className="space-y-8 pl-4 border-l-2 border-primary/20 mt-2">
                          {Object.entries(domain.counts.types || { 'MCQ': domain.counts }).map(([qType, typeCounts]) => {
                            if (!typeCounts || (typeCounts as any).total === 0) return null;
                            const typeConfig = domainConfig[qType] || { easy: 0, medium: 0, hard: 0 };
                            return (
                              <div key={qType} className="space-y-4">
                                <div className="flex items-center gap-2 border-b pb-2">
                                  <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider font-black", qType === 'SUBJECTIVE' ? 'bg-purple-100/50 text-purple-700 border-purple-200' : 'bg-blue-100/50 text-blue-700 border-blue-200')}>
                                    {qType === 'SUBJECTIVE' ? 'Subjective format' : 'Multiple choice'}
                                  </Badge>
                                </div>
                                <div className="grid gap-4 pl-2">
                                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                                    <div key={diff} className="space-y-3 px-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            diff === 'easy' ? "bg-green-500" : diff === 'medium' ? "bg-amber-500" : "bg-red-500"
                                          )} />
                                          <Label className="text-xs uppercase tracking-widest font-black text-muted-foreground">{diff}</Label>
                                        </div>
                                        <div className="text-xs font-bold tabular-nums">
                                          <span className={typeConfig[diff] > (typeCounts as any)[diff] ? 'text-destructive' : 'text-primary'}>
                                            {typeConfig[diff]}
                                          </span>
                                          <span className="text-muted-foreground/60 font-medium ml-1">available {(typeCounts as any)[diff]}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 bg-background border rounded-xl p-1 shadow-sm">
                                          <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => setQuestionsConfig(prev => {
                                              const current = ((prev[domain.id] || {})[qType] || {})[diff] || 0;
                                              return {
                                                ...prev,
                                                [domain.id]: { 
                                                  ...(prev[domain.id] || {}), 
                                                  [qType]: { ...((prev[domain.id] || {})[qType] || {}), [diff]: Math.max(0, current - 1) }
                                                }
                                              };
                                            })}
                                            disabled={(((questionsConfig[domain.id] || {})[qType] || {})[diff] || 0) <= 0}
                                          >
                                            <Minus className="h-3.5 w-3.5" />
                                          </Button>
                                          <Input 
                                            type="number"
                                            className="w-14 h-8 text-center font-black border-none bg-transparent focus-visible:ring-0 p-0"
                                            min={0}
                                            max={(typeCounts as any)[diff] || 0}
                                            value={((questionsConfig[domain.id] || {})[qType] || {})[diff] || 0}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value) || 0;
                                              const max = (typeCounts as any)[diff] || 0;
                                              setQuestionsConfig(prev => ({
                                                ...prev,
                                                [domain.id]: { 
                                                  ...(prev[domain.id] || {}), 
                                                  [qType]: { ...((prev[domain.id] || {})[qType] || {}), [diff]: Math.max(0, Math.min(max, val)) }
                                                }
                                              }));
                                            }}
                                          />
                                          <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                                            onClick={() => setQuestionsConfig(prev => {
                                              const current = ((prev[domain.id] || {})[qType] || {})[diff] || 0;
                                              const max = (typeCounts as any)[diff] || 0;
                                              return {
                                                ...prev,
                                                [domain.id]: { 
                                                  ...(prev[domain.id] || {}), 
                                                  [qType]: { ...((prev[domain.id] || {})[qType] || {}), [diff]: Math.min(max, current + 1) }
                                                }
                                              };
                                            })}
                                            disabled={(((questionsConfig[domain.id] || {})[qType] || {})[diff] || 0) >= ((typeCounts as any)[diff] || 0)}
                                          >
                                            <Plus className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 italic">
                                          Max: {(typeCounts as any)[diff] || 0}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              <div className="pt-6 border-t flex items-center justify-between px-2">
                <span className="font-medium text-muted-foreground">Total Questions Selected</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-primary">{totalQuestionsTotal}</span>
                  <span className="text-sm font-medium text-muted-foreground">questions</span>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Passing Thresholds</CardTitle><CardDescription>Set minimum scores required to pass</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="font-semibold">Overall Passing Score</Label><span className="text-lg font-semibold">{thresholds.overall}%</span></div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-background border rounded-xl p-1 shadow-sm">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-primary/10"
                      onClick={() => setThresholds(prev => ({ ...prev, overall: Math.max(0, prev.overall - 5) }))}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input 
                      min={0}
                      max={100}
                      value={thresholds.overall}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                        setThresholds(prev => ({ ...prev, overall: val }));
                      }}
                    />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-primary/10"
                      onClick={() => setThresholds(prev => ({ ...prev, overall: Math.min(100, prev.overall + 5) }))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-sm font-bold text-primary">%</span>
                </div>
              </div>
              <div className="pt-4 border-t space-y-4">
                <p className="text-sm text-muted-foreground">Domain-specific thresholds (optional)</p>
                {domains.filter(domain => {
                  const domainConfig = questionsConfig[domain.id] || { easy: 0, medium: 0, hard: 0 };
                  const domainTotal = Object.values(domainConfig).reduce((s, v) => s + v, 0);
                  return domainTotal > 0;
                }).map((domain) => (
                  <div key={domain.id} className="space-y-2">
                    <div className="flex items-center justify-between"><Label className="text-sm">{domain.name}</Label><span className="font-medium">{thresholds[domain.id] || 50}%</span></div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-background border rounded-xl p-1 shadow-sm opacity-80">
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-lg hover:bg-primary/10"
                          onClick={() => setThresholds(prev => ({ ...prev, [domain.id]: Math.max(0, (prev[domain.id] || 50) - 5) }))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input 
                          min={0}
                          max={100}
                          value={thresholds[domain.id] || 50}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            setThresholds(prev => ({ ...prev, [domain.id]: val }));
                          }}
                        />
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-lg hover:bg-primary/10"
                          onClick={() => setThresholds(prev => ({ ...prev, [domain.id]: Math.min(100, (prev[domain.id] || 50) + 5) }))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /><CardTitle>Exam Security</CardTitle></div></CardHeader>
            <CardContent className="space-y-6">

              {/* ── Video Proctoring Toggle ── */}
              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300",
                videoProctoringEnabled
                  ? "bg-primary/5 border-primary/30"
                  : "bg-muted/40 border-border"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300",
                    videoProctoringEnabled ? "bg-primary/15" : "bg-muted"
                  )}>
                    {videoProctoringEnabled
                      ? <Video className="h-5 w-5 text-primary" />
                      : <VideoOff className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="space-y-0.5">
                    <Label className={cn("text-sm font-bold", videoProctoringEnabled ? "text-primary" : "text-foreground")}>
                      Video Proctoring
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {videoProctoringEnabled
                        ? "Candidate's webcam will be recorded during the test"
                        : "Video proctoring is disabled for this assessment"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={videoProctoringEnabled}
                  onCheckedChange={setVideoProctoringEnabled}
                />
              </div>


              <div className="flex items-center justify-between pb-4 border-b">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-primary">Enable All Features</Label>
                  <p className="text-[10px] text-muted-foreground">Toggle all specialized proctoring controls at once</p>
                </div>
                <Switch 
                  checked={[
                    'disableRightClick', 'disableCopyPaste', 'fullscreenRequired', 
                    'monitorWindowResize', 'detectDevTools', 'disablePrintScreen', 'autoSubmitOnViolation'
                  ].every(k => (securityConfig as any)[k])}
                  onCheckedChange={(checked) => {
                    const updates: any = {};
                    [
                      'disableRightClick', 'disableCopyPaste', 'fullscreenRequired', 
                      'monitorWindowResize', 'detectDevTools', 'disablePrintScreen', 'autoSubmitOnViolation'
                    ].forEach(k => { updates[k] = checked; });
                    setSecurityConfig(prev => ({ ...prev, ...updates }));
                  }}
                />
              </div>

              {[
                { label: 'Disable Right-Click', key: 'disableRightClick' },
                { label: 'Block Copy, Paste & Selection', key: 'disableCopyPaste' },
                { label: 'Require Fullscreen Mode', key: 'fullscreenRequired' },
                { label: 'Monitor Window Resizing', key: 'monitorWindowResize' },
                { label: 'Detect Developer Tools', key: 'detectDevTools' },
                { label: 'Block Print Screen & Screenshots', key: 'disablePrintScreen' },
                { label: 'Auto-Submit on Violation', key: 'autoSubmitOnViolation' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between pt-4 border-t first:pt-0 first:border-t-0">
                  <Label>{item.label}</Label>
                  <Switch checked={(securityConfig as any)[item.key]} onCheckedChange={(checked) => setSecurityConfig(prev => ({ ...prev, [item.key]: checked }))} />
                </div>
              ))}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between"><Label>Max Tab Switching Allowed</Label><span className="text-lg font-semibold">{securityConfig.maxTabSwitchWarnings}</span></div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-background border rounded-xl p-1 shadow-sm">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-primary/10"
                      onClick={() => setSecurityConfig(prev => ({ ...prev, maxTabSwitchWarnings: Math.max(1, prev.maxTabSwitchWarnings - 1) }))}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input 
                      min={1}
                      max={10}
                      value={securityConfig.maxTabSwitchWarnings}
                      onChange={(e) => {
                        const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 0));
                        setSecurityConfig(prev => ({ ...prev, maxTabSwitchWarnings: val }));
                      }}
                    />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-lg hover:bg-primary/10"
                      onClick={() => setSecurityConfig(prev => ({ ...prev, maxTabSwitchWarnings: Math.min(10, prev.maxTabSwitchWarnings + 1) }))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">warnings</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/dashboard/assessments')}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Create Assessment'}</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
