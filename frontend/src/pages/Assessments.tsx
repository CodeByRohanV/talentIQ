import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ExpiryStatus from '@/components/ExpiryStatus';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { assessmentsAPI, candidatesAPI, domainsAPI } from '@/lib/api';
import {
  ClipboardList,
  Link as LinkIcon,
  Users,
  Clock,
  Loader2,
  Copy,
  ExternalLink,
  MoreVertical,
  Trash2,
  User as UserIcon,
  Calendar,
  CheckSquare,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layout,
  Info,
  Mail,
  Pencil,
  Save,
  X,
  Minus,
  Plus
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import SendLinkDialog from '@/components/assessments/SendLinkDialog';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';

const formatForDateTimeInput = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DDTHH:mm using local time
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (e) {
    return '';
  }
};

interface Assessment {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  questions_config: Record<string, any>;
  thresholds: Record<string, number>;
  security_config: Record<string, any>;
  share_token: string;
  isActive: boolean;
  status: 'active' | 'inactive' | 'completed';
  created_at: string;
  expiresAt?: string | null;
  candidate_count?: number;
  candidateCount?: number;
  creator_name?: string;
  creator_email?: string;
  creator_role?: string;
  instructions?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export default function Assessments() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const canEditScheduling = user?.roles?.includes('SUPER_ADMIN') || user?.permissions?.includes('edit_assessment_scheduling');
  const canEditInstructions = user?.roles?.includes('SUPER_ADMIN') || user?.permissions?.includes('edit_assessment_instructions');
  const canEditSecurity = user?.roles?.includes('SUPER_ADMIN') || user?.permissions?.includes('edit_assessment_security');

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<any[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [editedInstructions, setEditedInstructions] = useState('');
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [editedAvailability, setEditedAvailability] = useState({
    from: '',
    until: ''
  });
  const [isEditingSecurity, setIsEditingSecurity] = useState(false);
  const [editedSecurity, setEditedSecurity] = useState<any>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [showSendLinkDialog, setShowSendLinkDialog] = useState(false);
  const [sendLinkAssessment, setSendLinkAssessment] = useState<{ id: string, title: string } | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Quick Edit State
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickEditData, setQuickEditData] = useState<{
    duration: number;
    availableFrom: string;
    availableUntil: string;
  } | null>(null);

  // Memoized fetch function for re-use
  const fetchAssessments = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [assessmentsResponse, domainsResponse] = await Promise.all([
        assessmentsAPI.getAll(),
        domainsAPI.getAll()
      ]);

      if (domainsResponse.data) setDomains(domainsResponse.data);

      const transformedAssessments = (assessmentsResponse.data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        duration_minutes: a.durationMinutes || a.duration_minutes,
        questions_config: (a.questionsConfig || a.questions_config) as Record<string, number>,
        thresholds: (a.thresholds || a.thresholds_config) as Record<string, number>,
        share_token: a.shareToken || a.share_token,
        isActive: a.isActive !== undefined ? a.isActive : a.is_active,
        status: a.status || (a.isActive ? 'active' : 'inactive'),
        created_at: a.createdAt,
        expiresAt: a.expiresAt || a.expires_at,
        security_config: a.securityConfig || a.security_config || {},
        candidate_count: a.candidateCount || a.candidate_count || 0,
        creator_name: a.creatorName,
        creator_email: a.creatorEmail,
        creator_role: a.creatorRole,
        instructions: a.instructions,
        available_from: a.availableFrom || a.available_from,
        available_until: a.availableUntil || a.available_until
      }));

      setAssessments(transformedAssessments);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchAssessments();

      // REAL-TIME UPDATE: Refetch every 30 seconds
      const interval = setInterval(() => fetchAssessments(false), 30000);

      // Refetch when page gains focus
      const handleFocus = () => fetchAssessments(false);
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [user, fetchAssessments]);

  const toggleSelectAll = () => {
    if (selectedIds.length === assessments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(assessments.map(a => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} assessments? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsBulkDeleting(true);
      await assessmentsAPI.bulkDelete(selectedIds);
      setAssessments(prev => prev.filter(a => !selectedIds.includes(a.id)));
      setSelectedIds([]);
      toast({
        title: 'Bulk delete successful',
        description: `Successfully deleted ${selectedIds.length} assessments`,
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete selected assessments',
        variant: 'destructive',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const copyShareLink = (shareToken?: string) => {
    if (!shareToken) {
      toast({
        title: 'Error',
        description: 'No share link available for this assessment',
        variant: 'destructive',
      });
      return;
    }
    const link = `${window.location.origin}/test/${shareToken}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link copied!',
      description: 'Assessment link copied to clipboard',
    });
  };

  const deleteAssessment = async (id: string) => {
    try {
      await assessmentsAPI.delete(id);
      setAssessments(prev => prev.filter(a => a.id !== id));
      toast({
        title: 'Assessment deleted',
        description: 'The assessment has been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete assessment',
        variant: 'destructive',
      });
    }
  };

  const updateAssessmentStatus = async (id: string, newStatus: 'active' | 'inactive' | 'completed') => {
    try {
      await assessmentsAPI.update(id, {
        status: newStatus,
        isActive: newStatus === 'active'
      });

      setAssessments(prev => prev.map(a =>
        a.id === id ? { ...a, status: newStatus, isActive: newStatus === 'active' } : a
      ));

      toast({
        title: 'Status updated',
        description: `Assessment marked as ${newStatus}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const getTotalQuestions = (config: Record<string, any>) => {
    return Object.values(config || {}).reduce((sum, value) => {
      if (typeof value === 'object' && value !== null) {
        return sum + Object.values(value).reduce((dSum: number, count: any) => dSum + (Number(count) || 0), 0);
      }
      return sum + (Number(value) || 0);
    }, 0);
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
        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl p-4 flex items-center gap-6 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center gap-3 pr-6 border-r">
              <div className="h-4 w-4 rounded bg-primary flex items-center justify-center">
                <CheckSquare className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-black text-primary">
                {selectedIds.length} Assessments Selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 font-bold text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedIds([])}
              >
                Clear Selection
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-9 font-bold shadow-lg shadow-destructive/20"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Assessments</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your aptitude tests
            </p>
          </div>
          <div className="flex items-center gap-3">
            {assessments.length > 0 && (
              <Button 
                variant="outline" 
                onClick={toggleSelectAll}
                className={cn(
                  "font-bold",
                  selectedIds.length === assessments.length ? "bg-primary/5 border-primary/20 text-primary" : ""
                )}
              >
                {selectedIds.length === assessments.length ? (
                  <><CheckSquare className="mr-2 h-4 w-4" /> Deselect All</>
                ) : (
                  <><Layout className="mr-2 h-4 w-4" /> Select All</>
                )}
              </Button>
            )}
            <Button onClick={() => navigate('/dashboard/assessments/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Assessment
            </Button>
          </div>
        </div>

        {/* Assessments Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : assessments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No assessments yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Create your first assessment to start evaluating candidates.
                </p>
                <Button onClick={() => navigate('/dashboard/assessments/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Assessment
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assessments.map((assessment) => (
              <Card 
                key={assessment.id} 
                className={cn(
                  "card-hover border-border/50 flex flex-col h-full relative group transition-all duration-300",
                  selectedIds.includes(assessment.id) ? "ring-2 ring-primary border-primary bg-primary/[0.02]" : ""
                )}
              >
                {/* Selection Checkbox */}
                <div 
                  className={cn(
                    "absolute top-4 left-4 z-10 transition-all duration-300 cursor-pointer",
                    selectedIds.includes(assessment.id) ? "opacity-100 scale-110" : "opacity-0 group-hover:opacity-100 scale-100"
                  )}
                  onClick={() => toggleSelect(assessment.id)}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-colors",
                    selectedIds.includes(assessment.id) ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/30 hover:border-primary"
                  )}>
                    {selectedIds.includes(assessment.id) && <CheckSquare className="h-4 w-4" />}
                  </div>
                </div>

                <CardHeader className="pb-3 pl-12">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-5",
                          assessment.status === 'active' ? "border-green-500 text-green-500" :
                            assessment.status === 'completed' ? "border-blue-500 text-blue-500" :
                              "border-muted-foreground text-muted-foreground"
                        )}>
                          {assessment.status}
                        </Badge>
                        {assessment.creator_role && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-2 h-5 bg-primary/5 text-primary border-primary/10">
                            {assessment.creator_role}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg truncate font-bold">{assessment.title}</CardTitle>
                      <div className="mt-1 h-3" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyShareLink(assessment.share_token)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSendLinkAssessment({ id: assessment.id, title: assessment.title });
                          setShowSendLinkDialog(true);
                        }}>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => window.open(`/test/${assessment.share_token}`, '_blank')}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Preview Test
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateAssessmentStatus(assessment.id, assessment.status === 'active' ? 'inactive' : 'active')}>
                          <ClipboardList className="mr-2 h-4 w-4" />
                          Mark as {assessment.status === 'active' ? 'Inactive' : 'Active'}
                        </DropdownMenuItem>
                        {assessment.status !== 'completed' && (
                          <DropdownMenuItem onClick={() => updateAssessmentStatus(assessment.id, 'completed')}>
                            <CheckSquare className="mr-2 h-4 w-4" />
                            Mark as Completed
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          setSelectedAssessment(assessment);
                          setShowSettingsDialog(true);
                        }}>
                          <Settings className="mr-2 h-4 w-4" />
                          View Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive font-bold"
                          onClick={() => deleteAssessment(assessment.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col p-5">
                  {quickEditId === assessment.id ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                       <div className="space-y-2">
                         <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Duration</Label>
                            <span className="text-xs font-bold text-primary">{quickEditData?.duration} min</span>
                         </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-background border rounded-xl p-1 shadow-sm">
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg hover:bg-primary/10"
                                onClick={() => setQuickEditData(prev => prev ? { ...prev, duration: Math.max(1, prev.duration > 5 ? prev.duration - 5 : prev.duration - 1) } : null)}
                                disabled={(quickEditData?.duration || 0) <= 1}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Input 
                                type="number"
                                className="w-14 h-8 text-center font-black border-none bg-transparent focus-visible:ring-0 p-0"
                                min={1}
                                max={180}
                                value={quickEditData?.duration || 60}
                                onChange={(e) => {
                                  const val = Math.min(180, Math.max(1, parseInt(e.target.value) || 0));
                                  setQuickEditData(prev => prev ? { ...prev, duration: val } : null);
                                }}
                              />
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg hover:bg-primary/10"
                                onClick={() => setQuickEditData(prev => prev ? { ...prev, duration: Math.min(180, prev.duration < 5 ? prev.duration + 1 : prev.duration + 5) } : null)}
                                disabled={(quickEditData?.duration || 0) >= 180}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60 italic">
                              1 - 180 min
                            </span>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1 tracking-widest">
                              <Clock className="h-3 w-3" /> Start Window
                            </Label>
                            <Input 
                              type="datetime-local" 
                              value={quickEditData?.availableFrom || ''}
                              onChange={(e) => setQuickEditData(prev => prev ? { ...prev, availableFrom: e.target.value } : null)}
                              className="h-8 text-[11px] font-bold py-1 px-2 bg-background border-primary/20 focus-visible:ring-primary/20"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1 tracking-widest">
                              <Calendar className="h-3 w-3" /> End Window
                            </Label>
                            <Input 
                              type="datetime-local" 
                              value={quickEditData?.availableUntil || ''}
                              onChange={(e) => setQuickEditData(prev => prev ? { ...prev, availableUntil: e.target.value } : null)}
                              className="h-8 text-[11px] font-bold py-1 px-2 bg-background border-primary/20 focus-visible:ring-primary/20"
                            />
                          </div>
                       </div>

                       <div className="flex gap-2 pt-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 h-9 text-xs font-bold rounded-lg"
                            onClick={() => setQuickEditId(null)}
                            disabled={saveLoading}
                          >
                            <X className="mr-1.5 h-3 w-3" /> Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 h-9 text-xs font-bold rounded-lg shadow-sm"
                            onClick={async () => {
                              setSaveLoading(true);
                              try {
                                const fromDate = quickEditData?.availableFrom ? new Date(quickEditData.availableFrom).toISOString() : null;
                                const untilDate = quickEditData?.availableUntil ? new Date(quickEditData.availableUntil).toISOString() : null;

                                const updates = {
                                  durationMinutes: quickEditData!.duration,
                                  availableFrom: fromDate,
                                  availableUntil: untilDate
                                };
                                await assessmentsAPI.update(assessment.id, updates);
                                setAssessments(prev => prev.map(a => 
                                  a.id === assessment.id ? { 
                                    ...a, 
                                    duration_minutes: updates.durationMinutes,
                                    available_from: updates.availableFrom, 
                                    available_until: updates.availableUntil
                                  } : a
                                ));
                                toast({ title: 'Assessment updated', description: 'Changes saved successfully.' });
                                setQuickEditId(null);
                              } catch (err) {
                                toast({ title: 'Error', description: 'Failed to update assessment.', variant: 'destructive' });
                              } finally {
                                setSaveLoading(false);
                              }
                            }}
                            disabled={saveLoading}
                          >
                            {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="mr-1.5 h-3 w-3" /> Save Changes</>}
                          </Button>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold bg-primary/5 px-2 py-1 rounded-md">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>{assessment.duration_minutes} min limit</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold bg-primary/5 px-2 py-1 rounded-md">
                          <ClipboardList className="h-3.5 w-3.5 text-primary" />
                          <span>{getTotalQuestions(assessment.questions_config)} questions</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/10">
                          <Users className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="text-indigo-600">{assessment.candidate_count || 0} registered</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Activation Window */}
                        <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col justify-between h-[68px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Activation Window</span>
                            {(!assessment.available_from || new Date(assessment.available_from) <= new Date()) && 
                             (!assessment.available_until || new Date(assessment.available_until) >= new Date()) && (
                              <Badge variant="outline" className="h-3.5 text-[7px] px-1 font-bold uppercase tracking-tighter border-primary/20 text-primary bg-primary/5">Active</Badge>
                            )}
                          </div>
                          <div className="text-xs font-black flex items-center gap-1.5 text-primary truncate">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {assessment.available_from ? format(new Date(assessment.available_from), 'MMM d, @ HH:mm') : 'Anytime'}
                          </div>
                        </div>

                        {/* Expiration Window */}
                        <div className={cn(
                          "p-3 rounded-xl border flex flex-col justify-between h-[68px]",
                          (assessment.available_until && new Date(assessment.available_until) < new Date()) 
                            ? "bg-destructive/10 border-destructive/20" 
                            : "bg-destructive/5 border-destructive/10"
                        )}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest",
                              (assessment.available_until && new Date(assessment.available_until) < new Date()) ? "text-destructive" : "text-destructive/60"
                            )}>Expiration Window</span>
                            {assessment.available_until && new Date(assessment.available_until) < new Date() && (
                              <Badge variant="destructive" className="h-3.5 text-[7px] px-1 font-bold uppercase tracking-tighter">Expired</Badge>
                            )}
                          </div>
                          <div className={cn(
                            "text-xs font-black flex items-center gap-1.5 truncate",
                            (assessment.available_until && new Date(assessment.available_until) < new Date()) ? "text-destructive" : "text-destructive"
                          )}>
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            {assessment.available_until ? format(new Date(assessment.available_until), 'MMM d, @ HH:mm') : 
                             (assessment.expiresAt ? format(new Date(assessment.expiresAt), 'MMM d, @ HH:mm') : 'No Limit')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2 group">
                          <div className="w-8 h-8 flex items-center justify-center bg-muted rounded-full group-hover:bg-primary/10 transition-colors">
                            <UserIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter mb-0.5">Primary Recruiter</span>
                            <span className="text-sm font-bold leading-tight">{assessment.creator_name || 'System User'}</span>
                          </div>
                        </div>
                        
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-8 group px-3 bg-primary/5 hover:bg-primary/10 text-primary border-primary/10 transition-all font-bold"
                          onClick={() => {
                            setQuickEditId(assessment.id);
                            setQuickEditData({
                              duration: assessment.duration_minutes,
                            availableFrom: formatForDateTimeInput(assessment.available_from),
                            availableUntil: formatForDateTimeInput(assessment.available_until || assessment.expiresAt)
                            });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5 group-hover:rotate-12 transition-transform" />
                          Quick Update
                        </Button>
                      </div>

                      <div className="mt-auto pt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 font-bold h-9 rounded-lg hover:bg-primary/5"
                          onClick={() => navigate(`/dashboard/assessments/${assessment.id}/results`)}
                        >
                          View Results
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 font-bold h-9 rounded-lg shadow-sm"
                          onClick={() => copyShareLink(assessment.share_token)}
                        >
                          Copy Link
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 font-bold h-9 rounded-lg shadow-sm"
                          onClick={() => {
                            setSendLinkAssessment({ id: assessment.id, title: assessment.title });
                            setShowSendLinkDialog(true);
                          }}
                        >
                          <Mail className="mr-1.5 h-3.5 w-3.5" />
                          Email
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>


      {/* View Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Assessment Settings
            </DialogTitle>
            <DialogDescription>
              Detailed configuration for "{selectedAssessment?.title}"
            </DialogDescription>
          </DialogHeader>

          {selectedAssessment && (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Duration</span>
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4 text-primary" />
                    {selectedAssessment.duration_minutes} Minutes
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Created On</span>
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    {format(new Date(selectedAssessment.created_at), 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>
              {/* Availability Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Availability & Scheduling
                  </h3>
                  {!isEditingAvailability ? (
                    canEditScheduling && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs font-bold text-primary"
                        onClick={() => {
                          setIsEditingAvailability(true);
                          setEditedAvailability({
                            from: formatForDateTimeInput(selectedAssessment.available_from),
                            until: formatForDateTimeInput(selectedAssessment.available_until || selectedAssessment.expiresAt)
                          });
                        }}
                      >
                        Edit Slot
                      </Button>
                    )
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs font-bold"
                        onClick={() => setIsEditingAvailability(false)}
                        disabled={saveLoading}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-7 text-xs font-bold"
                        onClick={async () => {
                          setSaveLoading(true);
                          try {
                            const isoFrom = editedAvailability.from ? new Date(editedAvailability.from).toISOString() : null;
                            const isoUntil = editedAvailability.until ? new Date(editedAvailability.until).toISOString() : null;

                            const updates: any = { 
                              availableFrom: isoFrom,
                              availableUntil: isoUntil
                            };
                            await assessmentsAPI.update(selectedAssessment.id, updates);
                            toast({ title: 'Availability updated', description: 'Changes saved successfully.' });
                            const localUpdates = {
                              availableFrom: updates.availableFrom,
                              availableUntil: updates.availableUntil,
                              available_from: updates.availableFrom,
                              available_until: updates.availableUntil
                            };
                            setAssessments(prev => prev.map(a => 
                              a.id === selectedAssessment.id ? { ...a, ...localUpdates } : a
                            ));
                            setSelectedAssessment(prev => prev ? { ...prev, ...localUpdates } : null);
                            setIsEditingAvailability(false);
                          } catch (err) {
                            toast({ title: 'Error', description: 'Failed to save availability settings.', variant: 'destructive' });
                          } finally {
                            setSaveLoading(false);
                          }
                        }}
                        disabled={saveLoading}
                      >
                        {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>

                {isEditingAvailability ? (
                  <div className="bg-muted/30 p-4 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Available From
                        </label>
                        <Input 
                          type="datetime-local" 
                          value={editedAvailability.from}
                          onChange={(e) => setEditedAvailability(prev => ({ ...prev, from: e.target.value }))}
                          className="h-10 text-sm font-bold bg-background border-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Available Until
                        </label>
                        <Input 
                          type="datetime-local" 
                          value={editedAvailability.until}
                          onChange={(e) => setEditedAvailability(prev => ({ ...prev, until: e.target.value }))}
                          className="h-10 text-sm font-bold bg-background border-primary/20"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic px-1">
                      Start and End window control exactly when the test link becomes active and when it expires.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <span className="text-[10px] font-black uppercase text-primary/60 block mb-2">Activation Window</span>
                      <div className="text-sm font-black flex items-center gap-2 text-primary">
                        <Clock className="h-4 w-4" />
                        {selectedAssessment.available_from ? format(new Date(selectedAssessment.available_from), 'MMM dd, yyyy @ HH:mm') : 'Instant / Anytime'}
                      </div>
                    </div>
                    <div className="bg-destructive/5 p-4 rounded-xl border border-destructive/10">
                      <span className="text-[10px] font-black uppercase text-destructive/60 block mb-2">Expiration Window</span>
                      <div className="text-sm font-black flex items-center gap-2 text-destructive">
                        <Calendar className="h-4 w-4" />
                        {selectedAssessment.available_until ? format(new Date(selectedAssessment.available_until), 'MMM dd, yyyy @ HH:mm') : 
                         (selectedAssessment.expiresAt ? format(new Date(selectedAssessment.expiresAt), 'MMM dd, yyyy @ HH:mm') : 'Indefinite')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Custom Instructions
                  </h3>
                  {!isEditingInstructions ? (
                    canEditInstructions && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs font-bold text-primary"
                        onClick={() => {
                          setIsEditingInstructions(true);
                          setEditedInstructions(selectedAssessment.instructions || '');
                        }}
                      >
                        Edit
                      </Button>
                    )
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs font-bold"
                        onClick={() => setIsEditingInstructions(false)}
                        disabled={saveLoading}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-7 text-xs font-bold"
                        onClick={async () => {
                          setSaveLoading(true);
                          try {
                            await assessmentsAPI.update(selectedAssessment.id, { instructions: editedInstructions });
                            toast({ title: 'Instructions updated', description: 'Changes saved successfully.' });
                            setAssessments(prev => prev.map(a => 
                              a.id === selectedAssessment.id ? { ...a, instructions: editedInstructions } : a
                            ));
                            setSelectedAssessment(prev => prev ? { ...prev, instructions: editedInstructions } : null);
                            setIsEditingInstructions(false);
                          } catch (err) {
                            toast({ title: 'Error', description: 'Failed to save instructions.', variant: 'destructive' });
                          } finally {
                            setSaveLoading(false);
                          }
                        }}
                        disabled={saveLoading}
                      >
                        {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>

                {isEditingInstructions ? (
                  <Textarea 
                    value={editedInstructions}
                    onChange={(e) => setEditedInstructions(e.target.value)}
                    placeholder="Enter special instructions for candidates..."
                    className="min-h-[120px] text-sm font-medium"
                  />
                ) : (
                  <div className="bg-muted/30 p-4 rounded-xl min-h-[100px]">
                    {selectedAssessment.instructions ? (
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{selectedAssessment.instructions}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic flex items-center justify-center h-[68px]">No custom instructions provided.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Exam Security Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Exam Security & Anti-Cheating
                  </h3>
                  {!isEditingSecurity ? (
                    canEditSecurity && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs font-bold text-primary"
                        onClick={() => {
                          setIsEditingSecurity(true);
                          setEditedSecurity(selectedAssessment.security_config || {});
                        }}
                      >
                        Configure
                      </Button>
                    )
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs font-bold"
                        onClick={() => setIsEditingSecurity(false)}
                        disabled={saveLoading}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-7 text-xs font-bold"
                        onClick={async () => {
                          setSaveLoading(true);
                          try {
                            await assessmentsAPI.update(selectedAssessment.id, { securityConfig: editedSecurity });
                            toast({ title: 'Security updated', description: 'Anti-cheating measures saved.' });
                            setAssessments(prev => prev.map(a => 
                              a.id === selectedAssessment.id ? { ...a, security_config: editedSecurity } : a
                            ));
                            setSelectedAssessment(prev => prev ? { ...prev, security_config: editedSecurity } : null);
                            setIsEditingSecurity(false);
                          } catch (err) {
                            toast({ title: 'Error', description: 'Failed to update security.', variant: 'destructive' });
                          } finally {
                            setSaveLoading(false);
                          }
                        }}
                        disabled={saveLoading}
                      >
                        {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}
                </div>

                {isEditingSecurity ? (
                  <div className="bg-muted/30 p-4 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      {/* Basic Restrictions */}
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sec-1" className="text-xs font-bold cursor-pointer">Disable Right-Click</Label>
                        <Switch id="sec-1" checked={editedSecurity.disableRightClick} onCheckedChange={(v) => setEditedSecurity({...editedSecurity, disableRightClick: v})} />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sec-2" className="text-xs font-bold cursor-pointer">Block Copy, Paste & Selection</Label>
                        <Switch id="sec-2" checked={editedSecurity.disableCopyPaste} onCheckedChange={(v) => setEditedSecurity({...editedSecurity, disableCopyPaste: v})} />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="sec-3" className="text-xs font-bold cursor-pointer">Require Fullscreen Mode</Label>
                        <Switch id="sec-3" checked={editedSecurity.fullscreenRequired} onCheckedChange={(v) => setEditedSecurity({...editedSecurity, fullscreenRequired: v})} />
                      </div>

                      <div className="flex items-center justify-between">
                         <Label htmlFor="sec-4" className="text-xs font-bold cursor-pointer">Monitor Window Resizing</Label>
                         <Switch id="sec-4" checked={editedSecurity.monitorWindowResize} onCheckedChange={(v) => setEditedSecurity({...editedSecurity, monitorWindowResize: v})} />
                      </div>

                      <div className="flex items-center justify-between">
                         <Label htmlFor="sec-5" className="text-xs font-bold cursor-pointer">Detect Developer Tools</Label>
                         <Switch id="sec-5" checked={editedSecurity.detectDevTools} onCheckedChange={(v) => setEditedSecurity({...editedSecurity, detectDevTools: v})} />
                      </div>

                      <div className="flex items-center justify-between">
                         <Label htmlFor="sec-6" className="text-xs font-bold cursor-pointer">Block Print Screen</Label>
                         <Switch id="sec-6" checked={editedSecurity.disablePrintScreen} onCheckedChange={(v) => setEditedSecurity({...editedSecurity, disablePrintScreen: v})} />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t sm:border-none">
                         <Label htmlFor="sec-7" className="text-xs font-bold text-destructive cursor-pointer">Auto-Submit on Violation</Label>
                         <Switch id="sec-7" checked={editedSecurity.autoSubmitOnViolation} onCheckedChange={(v) => setEditedSecurity({...editedSecurity, autoSubmitOnViolation: v})} />
                      </div>

                      <div className="space-y-2 pt-2 border-t sm:border-none">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground flex justify-between">
                          Max Tab Switching Allowed <span>{editedSecurity.maxTabSwitchWarnings ?? 3} Warnings</span>
                        </Label>
                        <div className="flex items-center gap-3">
                          <Slider 
                            value={[editedSecurity.maxTabSwitchWarnings ?? 3]} 
                            max={10} 
                            min={0} 
                            step={1}
                            onValueChange={([v]) => setEditedSecurity({...editedSecurity, maxTabSwitchWarnings: v})}
                            className="flex-1"
                          />
                          <Input 
                            type="number" 
                            value={editedSecurity.maxTabSwitchWarnings ?? 3} 
                            onChange={(e) => setEditedSecurity({...editedSecurity, maxTabSwitchWarnings: parseInt(e.target.value) || 0})}
                            className="w-12 h-7 text-xs font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={cn(
                      "p-3 rounded-xl border flex items-center justify-between",
                      selectedAssessment.security_config?.disableRightClick || selectedAssessment.security_config?.disableCopyPaste ? "bg-primary/5 border-primary/20" : "bg-muted/20"
                    )}>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">Browser Restrictions</span>
                        <span className="text-[10px] text-muted-foreground italic tracking-tight">R-Click, Copy/Paste, Selection</span>
                      </div>
                      <div className="flex gap-1">
                        {selectedAssessment.security_config?.disableRightClick && (
                          <Badge variant="secondary" className="text-[9px] px-1 h-5 font-bold">No RC</Badge>
                        )}
                        {selectedAssessment.security_config?.disableCopyPaste && (
                          <Badge variant="secondary" className="text-[9px] px-1 h-5 font-bold">No Copy</Badge>
                        )}
                        {!selectedAssessment.security_config?.disableRightClick && !selectedAssessment.security_config?.disableCopyPaste && (
                          <Badge variant="outline" className="text-[9px] px-1 h-5 italic text-muted-foreground">None</Badge>
                        )}
                      </div>
                    </div>

                    <div className={cn(
                      "p-3 rounded-xl border flex items-center justify-between",
                      selectedAssessment.security_config?.fullscreenRequired || selectedAssessment.security_config?.monitorWindowResize ? "bg-primary/5 border-primary/20" : "bg-muted/20"
                    )}>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">Environment Monitor</span>
                        <span className="text-[10px] text-muted-foreground italic tracking-tight">Fullscreen, Window, DevTools</span>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {selectedAssessment.security_config?.fullscreenRequired && <Badge variant="secondary" className="text-[9px] px-1 h-5 font-bold">FS</Badge>}
                        {selectedAssessment.security_config?.monitorWindowResize && <Badge variant="secondary" className="text-[9px] px-1 h-5 font-bold">Resize</Badge>}
                        {selectedAssessment.security_config?.detectDevTools && <Badge variant="secondary" className="text-[9px] px-1 h-5 font-bold">Tools</Badge>}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-destructive">Auto-Submit</span>
                        <span className="text-[10px] text-muted-foreground italic tracking-tight">On security violation</span>
                      </div>
                      <Badge variant="outline" className={cn(
                        "font-black text-[9px] px-2 h-5",
                        selectedAssessment.security_config?.autoSubmitOnViolation ? "border-destructive text-destructive" : "text-muted-foreground"
                      )}>
                        {selectedAssessment.security_config?.autoSubmitOnViolation ? "ENABLED" : "DISABLED"}
                      </Badge>
                    </div>

                    <div className="p-3 bg-muted/20 border rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">Tab Limit</span>
                        <span className="text-[10px] text-muted-foreground italic tracking-tight">Warnings allowed</span>
                      </div>
                      <Badge variant="outline" className="font-black border-primary/20 text-primary px-2 h-5 text-[10px]">
                        {selectedAssessment.security_config?.maxTabSwitchWarnings ?? 3} Warnings
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Question Distribution logic matches your actual display */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
                  <Layout className="h-4 w-4 text-primary" />
                  Question Distribution
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(selectedAssessment.questions_config || {})
                    .filter(([_, count]) => {
                      const total = typeof count === 'object' && count !== null
                        ? Object.values(count as object).reduce((a: number, b: any) => a + (Number(b) || 0), 0) 
                        : (Number(count) || 0);
                      return (total as number) > 0;
                    })
                    .map(([category, count]) => {
                    const totalForCategory = typeof count === 'object' && count !== null 
                      ? Object.values(count as object).reduce((a: number, b: any) => a + (Number(b) || 0), 0) 
                      : (Number(count) || 0);
                    const domainName = domains.find(d => d.id === category || d.slug === category)?.name || category.replace(/_/g, ' ');

                    return (
                      <div key={category} className="flex flex-col gap-2 p-3 bg-muted/20 border rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">{domainName}</span>
                          <Badge variant="secondary" className="font-black">{totalForCategory} Total</Badge>
                        </div>
                        {typeof count === 'object' && Object.entries(count).map(([diff, c]: [string, any]) => (
                          Number(c) > 0 && (
                            <div key={diff} className="flex items-center gap-2 pl-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                diff === 'easy' ? "bg-green-500" : diff === 'medium' ? "bg-amber-500" : "bg-red-500"
                              )} />
                              <span className="text-xs text-muted-foreground capitalize font-medium">{diff}: {c}</span>
                            </div>
                          )
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SendLinkDialog
        open={showSendLinkDialog}
        onOpenChange={setShowSendLinkDialog}
        assessmentId={sendLinkAssessment?.id || ''}
        assessmentTitle={sendLinkAssessment?.title || ''}
      />
    </DashboardLayout>
  );
}
