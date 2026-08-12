import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MagicCard } from '@/components/ui/MagicCard';
import { Button } from '@/components/ui/button';

import { dashboardAPI } from '@/lib/api';

import {
  FileQuestion,
  ClipboardList,
  Users,
  TrendingUp,
  Plus,
  Upload,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface DashboardStats {
  totalQuestions: number;
  totalAssessments: number;
  totalCandidates: number;
  passRate: number;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalQuestions: 0,
    totalAssessments: 0,
    totalCandidates: 0,
    passRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats();
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Questions',
      value: stats.totalQuestions,
      icon: FileQuestion,
      description: 'In your question bank',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Assessments',
      value: stats.totalAssessments,
      icon: ClipboardList,
      description: 'Active assessments',
      color: 'text-primary',
      bgColor: 'bg-accent',
    },
    {
      title: 'Candidates',
      value: stats.totalCandidates,
      icon: Users,
      description: 'Total test takers',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Pass Rate',
      value: `${stats.passRate}%`,
      icon: TrendingUp,
      description: 'Overall success rate',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
  ];

  const canWriteQuestions = user?.permissions?.includes('create_questions') || user?.permissions?.includes('all') || user?.roles?.includes('SUPER_ADMIN');
  const canWriteAssessments = user?.permissions?.includes('create_assessments') || user?.permissions?.includes('all') || user?.roles?.includes('SUPER_ADMIN');

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              Welcome back, {user?.fullName || 'Recruiter'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's an overview of your assessment platform
            </p>
          </div>
          <div className="flex gap-3">
            {canWriteQuestions && (
              <Button variant="outline" onClick={() => navigate('/dashboard/questions?upload=true')}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Questions
              </Button>
            )}
            {canWriteAssessments && (
              <Button onClick={() => navigate('/dashboard/assessments/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Assessment
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {statCards.map((stat) => (
            <MagicCard key={stat.title} className="flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    stat.value
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-nowrap">
                  {stat.description}
                </p>
              </CardContent>
            </MagicCard>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {canWriteQuestions && (
            <MagicCard className="flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Import Questions
                </CardTitle>
                <CardDescription>
                  Upload a CSV file with your aptitude questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Quickly populate your question bank by importing questions from a CSV file.
                  Supports all four domains: Behavioral, Arithmetic, Logical Reasoning, and Quantitative Aptitude.
                </p>
                <Button variant="outline" onClick={() => navigate('/dashboard/questions?upload=true')}>
                  Go to Question Bank
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </MagicCard>
          )}

          {canWriteAssessments && (
            <MagicCard className="flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Create Assessment
                </CardTitle>
                <CardDescription>
                  Build a new aptitude test for your candidates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure question distribution, set time limits, define passing thresholds,
                  and generate a shareable link for candidates.
                </p>
                <Button onClick={() => navigate('/dashboard/assessments/new')}>
                  Create New Assessment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </MagicCard>
          )}
        </div>

        {/* Admin Quick Actions */}
        {(user.permissions?.includes('manage_roles') || user.roles?.includes('SUPER_ADMIN')) && (
          <MagicCard className="flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 bg-primary/5 border-primary/20 shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Organization Administration
              </CardTitle>
              <CardDescription>
                Manage users, roles, and enterprise-grade settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
                As an administrator, you have the authority to manage the team hierarchy.
                Access the specialized Admin Panel to onboard new users, define granular permission sets,
                and assign recruiters to specific managers.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => navigate('/dashboard/admin')} className="btn-gradient px-8 h-11 rounded-xl shadow-lg shadow-primary/20">
                  Go to Admin Panel
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="flex gap-2 items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 border-l pl-4 border-border ml-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Privileged Access Active
                </div>
              </div>
            </CardContent>
          </MagicCard>
        )}

        {/* Getting Started (if no data) */}
        {!loading && stats.totalQuestions === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileQuestion className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Get Started</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Start by uploading your question bank. You can import questions from a CSV file
                  with support for all four aptitude domains.
                </p>
                <Button onClick={() => navigate('/dashboard/questions?upload=true')}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Your First Questions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
