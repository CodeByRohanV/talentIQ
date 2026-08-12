import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { candidatesAPI, assessmentsAPI, resultsAPI } from '@/lib/api';
import { Search, Users, Loader2, Download, Eye, Trash2, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
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
import CandidateDetailDialog from '@/components/candidates/CandidateDetailDialog';

interface Candidate {
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
}

export default function Candidates() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Detail dialog state
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Delete dialog state
  const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCandidates();
    }
  }, [user]);

  const fetchCandidates = async () => {
    try {
      // Fetch all data in parallel
      const [candidatesResponse, assessmentsResponse, resultsResponse] = await Promise.all([
        candidatesAPI.getAll(),
        assessmentsAPI.getAll(),
        resultsAPI.getAll()
      ]);

      const assessmentMap = Object.fromEntries(
        (assessmentsResponse.data || []).map((a: any) => [a.id, a.title])
      );

      const resultsMap = Object.fromEntries(
        (resultsResponse.data || []).map((r: any) => [r.candidateId, {
          overall_score: r.overallScore,
          passed: r.passed,
          domainScores: r.domainScores,
          submissionMode: r.submissionMode,
          totalQuestions: r.totalQuestions,
          attemptedQuestions: r.attemptedQuestions,
          correctAnswers: r.correctAnswers,
          incorrectAnswers: r.incorrectAnswers,
          unansweredQuestions: r.unansweredQuestions
        }])
      );

      const candidatesWithDetails = (candidatesResponse.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        status: c.status,
        created_at: c.createdAt,
        started_at: c.startedAt,
        completed_at: c.completedAt,
        assessment_id: c.assessmentId,
        assessment_title: assessmentMap[c.assessmentId] || 'Unknown',
        result: resultsMap[c.id],
      }));

      setCandidates(candidatesWithDetails);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load candidates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCandidate = async () => {
    if (!deleteCandidate) return;
    try {
      setDeleteLoading(true);
      await candidatesAPI.delete(deleteCandidate.id);
      setCandidates(prev => prev.filter(c => c.id !== deleteCandidate.id));
      toast({
        title: 'Candidate deleted',
        description: `${deleteCandidate.name} has been removed successfully.`,
      });
      setDeleteCandidate(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete candidate. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredCandidates = candidates.filter(c => {
    const query = searchQuery.trim().toLowerCase();
    
    // If user typed only whitespace, return no results as per item 26 requirement 1
    if (searchQuery.length > 0 && query.length === 0) return false;

    const matchesSearch =
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'completed'
        ? c.status === 'completed'
        : statusFilter === 'auto_completed'
          ? (c.status === 'completed' && c.result?.submissionMode === 'auto')
          : statusFilter === 'manual_completed'
            ? (c.status === 'completed' && (!c.result || c.result.submissionMode === 'manual'))
            : c.status === statusFilter;

    let matchesResult = true;
    if (resultFilter === 'passed') {
      matchesResult = c.result?.passed === true;
    } else if (resultFilter === 'failed') {
      matchesResult = c.result?.passed === false;
    } else if (resultFilter === 'pending') {
      matchesResult = !c.result;
    }

    return matchesSearch && matchesStatus && matchesResult;
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any;
    let bValue: any;

    if (key === 'score') {
      aValue = a.result?.overall_score ?? -1;
      bValue = b.result?.overall_score ?? -1;
    } else if (key === 'name') {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (key === 'assessment_title') {
      aValue = a.assessment_title.toLowerCase();
      bValue = b.assessment_title.toLowerCase();
    } else if (key === 'created_at') {
      aValue = new Date(a.created_at).getTime();
      bValue = new Date(b.created_at).getTime();
    } else {
      aValue = (a as any)[key];
      bValue = (b as any)[key];
    }

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    return direction === 'asc' ? 1 : -1;
  });


  const exportToExcel = () => {
    const headers = ['Name', 'Email', 'Assessment', 'Status', 'Score', 'Result', 'Started At', 'Completed At'];
    const data = sortedCandidates.map(c => {
      const startDate = c.started_at ? format(new Date(c.started_at), 'dd-MM-yyyy HH:mm') : 'N/A';
      const completionDate = c.completed_at ? format(new Date(c.completed_at), 'dd-MM-yyyy HH:mm') : 'N/A';
      return {
        'Name': c.name,
        'Email': c.email,
        'Assessment': c.assessment_title,
        'Status': c.status,
        'Score': c.result ? `${c.result.overall_score}%` : 'N/A',
        'Result': c.result ? (c.result.passed ? 'Passed' : 'Failed') : 'N/A',
        'Started At': startDate,
        'Completed At': completionDate
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    worksheet['!cols'] = headers.map(() => ({ wch: 25 })); // Set all widths to 25

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
    XLSX.writeFile(workbook, `candidates-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    toast({
      title: 'Export complete',
      description: 'Candidates data exported to Excel',
    });
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getStatusBadge = (candidate: Candidate) => {
    switch (candidate.status) {
      case 'completed':
        if (candidate.result?.submissionMode === 'auto') {
          return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-transparent text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">Auto-Submitted</Badge>;
        }
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">In Progress</Badge>;
      default:
        return <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 text-[10px] font-bold py-0 h-5 px-2.5 whitespace-nowrap w-fit flex items-center justify-center shadow-sm">Not Started</Badge>;
    }
  };

  const getResultBadge = (result?: { overall_score: number; passed: boolean; correctAnswers?: number; totalQuestions?: number }) => {
    if (!result) return <span className="text-muted-foreground">—</span>;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-bold">{result.overall_score}%</span>
          <Badge variant={result.passed ? 'default' : 'destructive'} className={result.passed ? 'status-passed' : 'status-failed'}>
            {result.passed ? 'Passed' : 'Failed'}
          </Badge>
        </div>
        {result.totalQuestions !== undefined && (
          <div className="text-[10px] font-medium text-muted-foreground">
            {result.correctAnswers} / {result.totalQuestions} correct
          </div>
        )}
      </div>
    );
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Candidates</h1>
            <p className="text-muted-foreground mt-1">
              View and manage all test takers
            </p>
          </div>
          {candidates.length > 0 && (
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed (All)</SelectItem>
              <SelectItem value="manual_completed">Manual Submission</SelectItem>
              <SelectItem value="auto_completed">Auto-Submitted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={setResultFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Result" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Not Graded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Candidates Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No candidates yet</h3>
                <p className="text-muted-foreground mb-4">
                  Share your assessment links to start receiving candidates
                </p>
                <Button onClick={() => navigate('/dashboard/assessments')}>
                  View Assessments
                </Button>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No matches found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 text-center text-[10px] font-black tracking-tighter text-muted-foreground/50">#</TableHead>
                    <TableHead 
                      onClick={() => requestSort('name')} 
                      className="cursor-pointer hover:text-primary transition-colors py-4"
                    >
                      <div className="flex items-center gap-2">
                        Candidate {sortConfig?.key === 'name' && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      onClick={() => requestSort('assessment_title')} 
                      className="cursor-pointer hover:text-primary transition-colors py-4"
                    >
                      <div className="flex items-center gap-2">
                        Assessment {sortConfig?.key === 'assessment_title' && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="py-4">Status</TableHead>
                    <TableHead 
                      onClick={() => requestSort('score')} 
                      className="cursor-pointer hover:text-primary transition-colors py-4"
                    >
                      <div className="flex items-center gap-2">
                        Result {sortConfig?.key === 'score' && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      onClick={() => requestSort('created_at')} 
                      className="cursor-pointer hover:text-primary transition-colors py-4"
                    >
                      <div className="flex items-center gap-2">
                        Date {sortConfig?.key === 'created_at' && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="w-20 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCandidates.map((candidate, index) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="text-center text-xs font-bold text-muted-foreground/60">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{candidate.name}</p>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{candidate.assessment_title}</span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(candidate)}
                      </TableCell>
                      <TableCell>
                        {getResultBadge(candidate.result)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(candidate.created_at), 'MMM d, yyyy')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedCandidate(candidate);
                              setDetailOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(user?.roles?.includes('ADMIN') || user?.roles?.includes('SUPER_ADMIN')) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteCandidate(candidate)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Candidate Detail Dialog */}
      <CandidateDetailDialog
        candidate={selectedCandidate}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteCandidate?.name}</span> ({deleteCandidate?.email})?
              This will permanently remove all their data including test results and responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCandidate}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Candidate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
