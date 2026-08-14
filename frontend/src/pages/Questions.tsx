import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/ui/MagicCard';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { questionsAPI, domainsAPI } from '@/lib/api';
import {
  Upload,
  Search,
  FileQuestion,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  Info,
  Brain,
  Calculator,
  Users,
  BarChart3,
  Database,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  Pencil,
  Plus
} from 'lucide-react';
import QuestionDetailDialog from '@/components/questions/QuestionDetailDialog';
import DeleteConfirmDialog from '@/components/questions/DeleteConfirmDialog';
import EditQuestionDialog from '@/components/questions/EditQuestionDialog';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface Question {
  id: string;
  domain: string;
  domain_id: string;
  domain_name?: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  difficulty: string;
  question_type?: string;
  created_at: string;
}

interface Domain {
  id: string;
  name: string;
  slug: string;
  question_count?: number;
}

const DOMAIN_STYLES: Record<string, { 
  color: string, 
  icon: any, 
  gradient: string,
  badge: string,
  light: string,
  glow: string
}> = {
  'arithmetic': { 
    color: 'text-blue-600 dark:text-blue-400', 
    icon: Calculator, 
    gradient: 'from-blue-500/10 via-blue-500/5 to-indigo-500/10 border-blue-200/50 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-400 dark:bg-blue-950/20',
    badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 hover:bg-blue-200 dark:hover:bg-blue-500/30',
    light: 'bg-blue-50/50 dark:bg-blue-500/10',
    glow: 'bg-blue-500'
  },
  'behavioral': { 
    color: 'text-emerald-600 dark:text-emerald-400', 
    icon: Users, 
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-emerald-200/50 dark:border-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-400 dark:bg-emerald-950/20',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/30',
    light: 'bg-emerald-50/50 dark:bg-emerald-500/10',
    glow: 'bg-emerald-500'
  },
  'logical_reasoning': { 
    color: 'text-amber-600 dark:text-amber-400', 
    icon: Brain, 
    gradient: 'from-amber-500/10 via-amber-500/5 to-orange-500/10 border-amber-200/50 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-400 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 hover:bg-amber-200 dark:hover:bg-amber-500/30',
    light: 'bg-amber-50/50 dark:bg-amber-500/10',
    glow: 'bg-amber-500'
  },
  'quantitative_aptitude': { 
    color: 'text-rose-600 dark:text-rose-400', 
    icon: BarChart3, 
    gradient: 'from-rose-500/10 via-rose-500/5 to-pink-500/10 border-rose-200/50 dark:border-rose-500/30 hover:border-rose-400 dark:hover:border-rose-400 dark:bg-rose-950/20',
    badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 hover:bg-rose-200 dark:hover:bg-rose-500/30',
    light: 'bg-rose-50/50 dark:bg-rose-500/10',
    glow: 'bg-rose-500'
  },
  'big_data': { 
    color: 'text-cyan-600 dark:text-cyan-400', 
    icon: Database, 
    gradient: 'from-cyan-500/10 via-cyan-500/5 to-sky-500/10 border-cyan-200/50 dark:border-cyan-500/30 hover:border-cyan-400 dark:hover:border-cyan-400 dark:bg-cyan-950/20',
    badge: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30 hover:bg-cyan-200 dark:hover:bg-cyan-500/30',
    light: 'bg-cyan-50/50 dark:bg-cyan-500/10',
    glow: 'bg-cyan-500'
  },
  'data_analytics': { 
    color: 'text-violet-600 dark:text-violet-400', 
    icon: BarChart3, 
    gradient: 'from-violet-500/10 via-violet-500/5 to-purple-500/10 border-violet-200/50 dark:border-violet-500/30 hover:border-violet-400 dark:hover:border-violet-400 dark:bg-violet-950/20',
    badge: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30 hover:bg-violet-200 dark:hover:bg-violet-500/30',
    light: 'bg-violet-50/50 dark:bg-violet-500/10',
    glow: 'bg-violet-500'
  },
  'sap_abap': { 
    color: 'text-sky-600 dark:text-sky-400', 
    icon: Code2, 
    gradient: 'from-sky-500/10 via-sky-500/5 to-blue-500/10 border-sky-200/50 dark:border-sky-500/30 hover:border-sky-400 dark:hover:border-sky-400 dark:bg-sky-950/20',
    badge: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30 hover:bg-sky-200 dark:hover:bg-sky-500/30',
    light: 'bg-sky-50/50 dark:bg-sky-500/10',
    glow: 'bg-sky-500'
  }
};

const DEFAULT_STYLE = {
  color: 'text-slate-600 dark:text-slate-400',
  icon: Layers,
  gradient: 'from-slate-500/10 via-slate-500/5 to-slate-500/10 border-slate-200/50 dark:border-slate-500/30 hover:border-slate-400 dark:hover:border-slate-400 dark:bg-slate-950/20',
  badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30 hover:bg-slate-200 dark:hover:bg-slate-500/30',
  light: 'bg-slate-50/50 dark:bg-slate-500/10',
  glow: 'bg-slate-500'
};

export default function Questions() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const canWrite = (user as any)?.permissions?.includes('create_questions') ||
    (user as any)?.permissions?.includes('all') ||
    (user as any)?.roles?.includes('SUPER_ADMIN') ||
    (user as any)?.roles?.includes('ADMIN') ||
    (user as any)?.roles?.includes('Admin');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAllSelectedGlobally, setIsAllSelectedGlobally] = useState(false);
  const [viewQuestion, setViewQuestion] = useState<Question | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [usedInAssessmentsCount, setUsedInAssessmentsCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search
      setSelectedIds(new Set());
      setIsAllSelectedGlobally(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-open upload dialog if ?upload=true is in the URL
  useEffect(() => {
    if (searchParams.get('upload') === 'true' && canWrite && !initialLoading) {
      setUploadOpen(true);
      // Clean up the URL param without re-navigating
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('upload');
        return next;
      }, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canWrite, initialLoading]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchInitialData();
    }
  }, [user]);

  // Refetch when page or filters change
  useEffect(() => {
    if (user && !initialLoading) {
      fetchQuestions();
    }
  }, [currentPage, domainFilter, debouncedSearch, difficultyFilter]);

  const fetchInitialData = async () => {
    setInitialLoading(true);
    setLoading(true);
    try {
      const isManager = (user as any)?.roles?.includes('MANAGER');
      const isRecruiter = (user as any)?.roles?.includes('RECRUITER');

      let fetchPromise;
      if (isManager) {
        fetchPromise = questionsAPI.getMyDomain({
          page: 1,
          limit: rowsPerPage,
          search: debouncedSearch || undefined,
          domainId: domainFilter === 'all' ? undefined : domainFilter,
          difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter
        });
      } else if (isRecruiter) {
        fetchPromise = questionsAPI.getAssigned({
          page: 1,
          limit: rowsPerPage,
          search: debouncedSearch || undefined,
          domainId: domainFilter === 'all' ? undefined : domainFilter,
          difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter
        });
      } else {
        fetchPromise = questionsAPI.getAll({
          page: 1,
          limit: rowsPerPage,
          domainId: domainFilter === 'all' ? undefined : domainFilter,
          search: debouncedSearch || undefined,
          difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter
        });
      }

      const [domainsRes, questionsRes] = await Promise.all([
        domainsAPI.getAll(),
        fetchPromise
      ]);

      setDomains(domainsRes.data || []);
      setTotalCount((questionsRes as any).total || 0);

      const transformedData = (questionsRes.data || []).map((q: any) => ({
        id: q.id,
        domain: q.domain,
        domain_id: q.domainId,
        domain_name: q.domainName,
        question_text: q.questionText,
        options: Array.isArray(q.options) ? q.options : JSON.parse((q.options as string) || '[]'),
        correct_answer: q.correctAnswer,
        difficulty: q.difficulty,
        question_type: q.questionType,
        created_at: q.createdAt,
      }));

      setQuestions(transformedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setInitialLoading(false);
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const isManager = (user as any)?.roles?.includes('MANAGER');
      const isRecruiter = (user as any)?.roles?.includes('RECRUITER');

      let questionsPromise;
      if (isManager) {
        questionsPromise = questionsAPI.getMyDomain({
          page: currentPage,
          limit: rowsPerPage,
          search: debouncedSearch || undefined,
          domainId: domainFilter === 'all' ? undefined : domainFilter,
          difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter
        });
      } else if (isRecruiter) {
        questionsPromise = questionsAPI.getAssigned({
          page: currentPage,
          limit: rowsPerPage,
          search: debouncedSearch || undefined,
          domainId: domainFilter === 'all' ? undefined : domainFilter,
          difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter
        });
      } else {
        questionsPromise = questionsAPI.getAll({
          page: currentPage,
          limit: rowsPerPage,
          domainId: domainFilter === 'all' ? undefined : domainFilter,
          search: debouncedSearch || undefined,
          difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter
        });
      }

      const [questionsRes, domainsRes] = await Promise.all([
        questionsPromise,
        domainsAPI.getAll()
      ]);

      const response = questionsRes as any;
      setTotalCount(response.total || 0);
      setDomains(domainsRes.data || []);

      const transformedData = (response.data || []).map((q: any) => ({
        id: q.id,
        domain: q.domain,
        domain_id: q.domainId,
        domain_name: q.domainName,
        question_text: q.questionText,
        options: Array.isArray(q.options) ? q.options : JSON.parse((q.options as string) || '[]'),
        correct_answer: q.correctAnswer,
        difficulty: q.difficulty,
        question_type: q.questionType,
        created_at: q.createdAt,
      }));
      setQuestions(transformedData);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseCSVRow = useCallback((row: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      const nextChar = row[i + 1];
      if (inQuotes) {
        if (char === '"' && nextChar === '"') { current += '"'; i++; }
        else if (char === '"') inQuotes = false;
        else current += char;
      } else {
        if (char === '"') inQuotes = true;
        else if (char === ',') { fields.push(current.trim()); current = ''; }
        else current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  }, []);

  const parseCSV = useCallback((text: string): any[] => {
    const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) throw new Error('CSV must have a header row');
    const headers = parseCSVRow(lines[0]).map((h) => h.toLowerCase());
    const requiredHeaders = ['domain', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) throw new Error(`Missing: ${missingHeaders.join(', ')}`);

    const domainIndex = headers.indexOf('domain');
    const questionIndex = headers.indexOf('question');
    const optionAIndex = headers.indexOf('option_a');
    const optionBIndex = headers.indexOf('option_b');
    const optionCIndex = headers.indexOf('option_c');
    const optionDIndex = headers.indexOf('option_d');
    const correctIndex = headers.indexOf('correct_answer');
    const difficultyIndex = headers.indexOf('difficulty');

    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCSVRow(line);
      const domainSlug = values[domainIndex]?.toLowerCase().replace(/\s+/g, '_');
      const domainName = values[domainIndex];
      const matchingDomain = domains.find(d => d.slug === domainSlug || d.name.toLowerCase() === domainName?.toLowerCase());

      const cleanValue = (v: string) => v?.replace(/^"|"$/g, '') || '';
      const questionText = cleanValue(values[questionIndex]);
      const optionsArray = [cleanValue(values[optionAIndex]), cleanValue(values[optionBIndex]), cleanValue(values[optionCIndex]), cleanValue(values[optionDIndex])];
      
      let questionType = 'MULTIPLE_CHOICE';
      const isOptionsEmpty = optionsArray.every(opt => opt === '');
      const isSubjectiveText = /explain|describe|what is|how do you|why|scenario|write|compare|analyze|discuss|outline|list|summarize/i.test(questionText);
      
      if (isOptionsEmpty || isSubjectiveText) {
          questionType = 'SUBJECTIVE';
      }

      let correctAnswer = parseInt(values[correctIndex]);
      if (questionType === 'MULTIPLE_CHOICE') {
          if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) continue;
      } else {
          correctAnswer = 0; // Default or null equivalent for subjective
      }

      parsed.push({
        domain: matchingDomain?.slug || domainSlug,
        domain_id: matchingDomain?.id,
        domain_name: matchingDomain?.name || domainName,
        question_text: questionText,
        options: optionsArray,
        correct_answer: correctAnswer,
        difficulty: difficultyIndex >= 0 ? cleanValue(values[difficultyIndex]) || 'medium' : 'medium',
        question_type: questionType,
      });
    }
    return parsed;
  }, [parseCSVRow, domains]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadPreview([]);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setUploadPreview(parsed);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to parse CSV');
    }
  };

  const handleConfirmUpload = async () => {
    if (uploadPreview.length === 0) return;
    setUploading(true);
    try {
      const questionsToInsert = uploadPreview.map((q) => ({
        domain: q.domain,
        domainName: q.domain_name,
        domain_id: q.domain_id,
        questionText: q.question_text,
        options: q.options,
        correctAnswer: q.correct_answer,
        difficulty: q.difficulty,
      }));
      await questionsAPI.bulkCreate(questionsToInsert);
      toast({ title: 'Success!', description: `${questionsToInsert.length} questions imported` });
      setUploadOpen(false);
      setUploadPreview([]);
      fetchQuestions();
    } catch (error) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteClick = async (ids: string[] | 'all') => {
    if (ids === 'all') {
      setIsDeletingAll(true);
      setDeleteTargetIds([]);
    } else {
      setIsDeletingAll(false);
      setDeleteTargetIds(ids);
    }

    const filters = {
      domainId: domainFilter === 'all' ? undefined : domainFilter,
      difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
      search: debouncedSearch || undefined
    };

    const response = await questionsAPI.checkUsage(ids, filters);
    setUsedInAssessmentsCount(response.data.usedCount || 0);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const filters = {
        domainId: domainFilter === 'all' ? undefined : domainFilter,
        difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
        search: debouncedSearch || undefined
      };

      await questionsAPI.bulkDelete(isDeletingAll ? 'all' : deleteTargetIds, filters);
      fetchQuestions(); // Sync with API count
      setSelectedIds(new Set());
      setIsAllSelectedGlobally(false);
      toast({ title: 'Deleted', description: `Questions removed successfully` });
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally { setDeleteOpen(false); }
  };

  const downloadTemplate = () => {
    const headers = ['domain', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'difficulty'];
    const exampleRow = ['Arithmetic', 'What is 5 + 7?', '10', '11', '12', '13', '2', 'easy'];
    const csvContent = [headers, exampleRow].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "questions_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const domainIdToSlug = domains.reduce((acc, d) => { acc[d.id] = d.slug; return acc; }, {} as Record<string, string>);
  const slugToDomainId = domains.reduce((acc, d) => { acc[d.slug] = d.id; return acc; }, {} as Record<string, string>);

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-h-[90px]">
          <div className="flex-1">
            <div className="flex items-center gap-3 h-10 overflow-hidden group">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform duration-500">
                <Sparkles className="h-6 w-6" fill="currentColor" opacity={0.2} />
              </div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Question Bank</h1>
              <div className="flex items-center ml-2">
                {initialLoading ? (
                  <Skeleton className="h-7 w-20 rounded-full" />
                ) : (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold px-3 h-7 rounded-full">
                    {totalCount} Total
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-muted-foreground mt-1 h-6 font-medium text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" /> Shared organizational question repository
            </p>
          </div>
          <div className="flex gap-2">
            {canWrite && selectedIds.size > 0 && (
              <Button variant="destructive" onClick={() => handleDeleteClick(isAllSelectedGlobally ? 'all' : Array.from(selectedIds))}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete ({isAllSelectedGlobally ? totalCount : selectedIds.size})
              </Button>
            )}
            {canWrite && (
              <div className="flex gap-2">
                <Button 
                  onClick={() => { setEditQuestion(null); setEditOpen(true); }}
                  className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Question
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Upload className="mr-2 h-4 w-4 rotate-180" /> Download Template
                </Button>
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild><Button><Upload className="mr-2 h-4 w-4" /> Upload CSV</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Import Questions</DialogTitle>
                      <DialogDescription>CSV columns: domain, question, option_a, option_b, option_c, option_d, correct_answer, difficulty</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 pt-2">
                    <div 
                      className={cn(
                        "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 group flex flex-col items-center justify-center gap-3",
                        uploadPreview.length > 0 ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <input
                        type="file"
                        accept=".csv"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileUpload}
                        id="csv-upload"
                      />
                      
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center bg-primary/10 transition-transform duration-300 group-hover:scale-110",
                        uploadPreview.length > 0 ? "bg-primary text-white" : "text-primary"
                      )}>
                        {uploadPreview.length > 0 ? <CheckCircle2 className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
                      </div>
                      
                      <div className="text-center">
                        <p className="font-bold text-sm">
                          {uploadPreview.length > 0 ? "File Ready for Import" : "Click to upload or drag and drop"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {uploadPreview.length > 0 ? `${uploadPreview.length} questions detected` : "CSV file only (Max 5MB)"}
                        </p>
                      </div>

                      {uploadPreview.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-lg text-xs font-bold animate-in fade-in zoom-in-95 duration-300">
                          <FileQuestion className="h-3.5 w-3.5 text-primary" />
                          <span className="truncate max-w-[200px]">
                            {(document.getElementById('csv-upload') as HTMLInputElement)?.files?.[0]?.name || 'dataset.csv'}
                          </span>
                        </div>
                      )}
                    </div>

                    {uploadError && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3 animate-in shake-in-1 duration-300">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-destructive">Upload Error</p>
                          <p className="text-xs text-destructive/80 font-medium leading-relaxed">{uploadError}</p>
                        </div>
                      </div>
                    )}

                    {uploadPreview.length > 0 && (
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setUploadPreview([]);
                            setUploadError(null);
                            const input = document.getElementById('csv-upload') as HTMLInputElement;
                            if (input) input.value = '';
                          }}
                          className="flex-1 font-bold h-11 rounded-xl"
                          disabled={uploading}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleConfirmUpload} 
                          disabled={uploading} 
                          className="flex-[2] font-bold h-11 rounded-xl shadow-lg shadow-primary/20"
                        >
                          {uploading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                          ) : (
                            <>Confirm Import ({uploadPreview.length} Questions)</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
          </div>
        </div>

        <div className="min-h-[54px]">
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-4 flex items-center gap-3 text-sm font-medium text-primary">
              <Info className="h-5 w-5 shrink-0" />
              <span>
                {(user as any)?.roles?.includes('MANAGER') || (user as any)?.roles?.includes('RECRUITER')
                  ? "This question bank is restricted to your assigned domain and managerial scope."
                  : "This question bank is shared across your entire organization. Any question added by your team is visible here for reuse in assessments."
                }
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Domain Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[100px]">
          {initialLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="h-[92px] shadow-none border-dashed"><CardContent className="pt-4 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-12" /></CardContent></Card>
            ))
          ) : (
            domains.map((domain: any, index) => {
              const isActive = domainFilter === domain.id || domainFilter === domain.slug;
              const style = DOMAIN_STYLES[domain.slug] || DEFAULT_STYLE;
              const Icon = style.icon;

              return (
                <motion.div
                  key={domain.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="h-full"
                >
                  <MagicCard
                    className={cn(
                      "cursor-pointer transition-all duration-500 h-[100px] border-2 relative group overflow-hidden bg-gradient-to-br",
                      style.gradient,
                      isActive ? "ring-2 ring-primary ring-offset-2 scale-[1.02] shadow-lg" : "hover:scale-[1.01]"
                    )}
                    onClick={() => {
                      const nextFilter = isActive ? 'all' : domain.id;
                      setDomainFilter(nextFilter);
                      setCurrentPage(1);
                      setSelectedIds(new Set());
                      setIsAllSelectedGlobally(false);
                    }}
                  >
                    <CardContent className="p-4 flex justify-between items-center w-full h-full relative z-20">
                      <div className="overflow-hidden flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">{domain.name}</p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-3xl font-black tabular-nums tracking-tighter">{domain.question_count ?? 0}</p>
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Questions</span>
                        </div>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110",
                        style.light,
                        style.color
                      )}>
                        <Icon className="h-6 w-6" strokeWidth={2.5} />
                      </div>
                    </CardContent>
                    
                    <div className={cn(
                      "absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 dark:opacity-20 transition-all duration-500 group-hover:opacity-40",
                      style.glow
                    )} />
                  </MagicCard>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Global Selection Banner */}
        {selectedIds.size === questions.length && totalCount > questions.length && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>
                All <strong>{questions.length}</strong> questions on this page are selected.{' '}
                {isAllSelectedGlobally ? (
                  <span className="font-bold text-primary">All {totalCount} questions selected.</span>
                ) : (
                  <span>Select all <strong>{totalCount}</strong> questions matching this filter.</span>
                )}
              </span>
            </div>
            {!isAllSelectedGlobally ? (
              <Button
                variant="link"
                size="sm"
                className="font-bold h-7 px-2"
                onClick={() => setIsAllSelectedGlobally(true)}
              >
                Select all {totalCount} questions
              </Button>
            ) : (
              <Button
                variant="link"
                size="sm"
                className="font-bold h-7 px-2 text-muted-foreground"
                onClick={() => {
                  setSelectedIds(new Set());
                  setIsAllSelectedGlobally(false);
                }}
              >
                Clear selection
              </Button>
            )}
          </div>
        )}

        {/* Filters and Table Area */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 backdrop-blur-md shadow-sm transition-all duration-300">
          <div className="relative w-full sm:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input 
              placeholder="Search shared question bank..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-11 h-12 bg-slate-50/50 dark:bg-black/40 border-slate-200/50 dark:border-slate-800/50 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-2xl font-medium shadow-none text-sm" 
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 px-1">
             <div className="text-[10px] font-black text-muted-foreground/50 dark:text-muted-foreground/40 uppercase tracking-[0.2em] mr-2">Filter by Difficulty</div>
             <Select value={difficultyFilter} onValueChange={(val) => {
               setDifficultyFilter(val);
               setCurrentPage(1);
               setSelectedIds(new Set());
             }}>
               <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white/50 dark:bg-black/40 border-slate-200/50 dark:border-slate-800/50 font-bold text-xs uppercase tracking-wider">
                 <SelectValue placeholder="All Difficulties" />
               </SelectTrigger>
               <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                 <SelectItem value="all" className="font-bold text-xs uppercase tracking-wider">All Difficulties</SelectItem>
                 <SelectItem value="easy" className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Easy</SelectItem>
                 <SelectItem value="medium" className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">Medium</SelectItem>
                 <SelectItem value="hard" className="font-bold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">Hard</SelectItem>
               </SelectContent>
             </Select>
          </div>
        </div>

        <Card className="min-h-[720px] shadow-sm border-border flex flex-col">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-y">
                <TableRow className="hover:bg-transparent">
                  {canWrite && (
                    <TableHead className="w-12 px-6">
                      <Checkbox
                        checked={selectedIds.size === questions.length && questions.length > 0}
                        onCheckedChange={() => {
                          if (selectedIds.size === questions.length) {
                            setSelectedIds(new Set());
                            setIsAllSelectedGlobally(false);
                          } else {
                            setSelectedIds(new Set(questions.map(q => q.id)));
                          }
                        }}
                      />
                    </TableHead>
                  )}
                  <TableHead className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground px-4">Domain</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">Difficulty</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">Question Content</TableHead>
                  <TableHead className="text-right font-bold uppercase tracking-wider text-[11px] text-muted-foreground px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {loading && questions.length === 0 ? (
                    Array(rowsPerPage).fill(0).map((_, i) => (
                      <TableRow key={i} className="h-20 border-b">
                        {canWrite && <TableCell className="px-6"><Skeleton className="h-4 w-4" /></TableCell>}
                        <TableCell className="px-4"><Skeleton className="h-8 w-24 rounded-lg" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-[80%] rounded-md" /></TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1">
                            <Skeleton className="h-9 w-9 rounded-xl" />
                            <Skeleton className="h-9 w-9 rounded-xl" />
                            <Skeleton className="h-9 w-9 rounded-xl" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : questions.length === 0 ? (
                    <TableRow className="h-80">
                      <TableCell colSpan={canWrite ? 4 : 3} className="text-center p-0">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center justify-center space-y-4"
                        >
                          <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <FileQuestion className="h-10 w-10" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xl font-black tracking-tight">No questions found</p>
                            <p className="text-sm text-muted-foreground font-medium">Try adjusting your filters or search terms</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-full px-6 border-slate-200 dark:border-slate-800"
                            onClick={() => {
                              setSearchQuery('');
                              setDomainFilter('all');
                            }}
                          >
                            Reset all filters
                          </Button>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    questions.map((q, idx) => (
                      <motion.tr
                        key={q.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          "h-20 group transition-all border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/50",
                          loading && "opacity-50 pointer-events-none"
                        )}
                      >
                        {canWrite && (
                          <TableCell className="px-6">
                            <Checkbox 
                              checked={selectedIds.has(q.id)} 
                              onCheckedChange={() => {
                                const next = new Set(selectedIds);
                                if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                                setSelectedIds(next);
                              }} 
                            />
                          </TableCell>
                        )}
                        <TableCell className="px-4">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "font-black px-3 py-1 border shadow-none rounded-lg text-[10px] uppercase tracking-wider",
                              (DOMAIN_STYLES[q.domain] || DEFAULT_STYLE).badge
                            )}
                          >
                            {q.domain_name || q.domain}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-tighter",
                              q.difficulty === 'easy' ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800" :
                              q.difficulty === 'medium' ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" :
                              "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800"
                            )}
                          >
                            {q.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md font-medium text-slate-700 dark:text-slate-300">
                          <div className="truncate group-hover:whitespace-normal group-hover:line-clamp-2 transition-all">
                            {q.question_text}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1.5">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md dark:hover:bg-slate-800 transition-all"
                              onClick={() => { setViewQuestion(q); setViewOpen(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canWrite && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md dark:hover:bg-slate-800 transition-all"
                                  onClick={() => { setEditQuestion(q); setEditOpen(true); }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-9 h-9 rounded-xl text-destructive hover:text-white hover:bg-destructive hover:shadow-lg hover:shadow-destructive/20 transition-all" 
                                  onClick={() => handleDeleteClick([q.id])}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      if (!isAllSelectedGlobally) setSelectedIds(new Set());
                    }}
                    className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={currentPage === pageNum}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          if (!isAllSelectedGlobally) setSelectedIds(new Set());
                        }}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      if (!isAllSelectedGlobally) setSelectedIds(new Set());
                    }}
                    className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <QuestionDetailDialog question={viewQuestion} open={viewOpen} onOpenChange={setViewOpen} />
      <EditQuestionDialog question={editQuestion} domains={domains} open={editOpen} onOpenChange={setEditOpen} onSuccess={fetchQuestions} />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={isDeletingAll ? totalCount : deleteTargetIds.length}
        usedInAssessments={usedInAssessmentsCount}
        onConfirm={handleDeleteConfirm}
      />
    </DashboardLayout>
  );
}
