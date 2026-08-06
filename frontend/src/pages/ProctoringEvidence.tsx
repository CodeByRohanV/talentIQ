import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { proctoringAPI, resolveApiUrl } from '@/lib/api';
import { ArrowLeft, Loader2, ShieldAlert, AlertTriangle, CheckCircle2, Bot, LayoutGrid, List, Maximize2, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const BACKEND_BASE_URL = resolveApiUrl(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '');

export default function ProctoringEvidence() {
  const { id: assessmentId, candidateId } = useParams<{ id: string; candidateId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [proctoringReport, setProctoringReport] = useState<any>(null);
  
  // New State for Gallery/Timeline
  const [viewMode, setViewMode] = useState<'gallery' | 'timeline'>('gallery');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && candidateId) {
      fetchProctoringReport();
    }
  }, [user, candidateId]);

  const fetchProctoringReport = async () => {
    try {
      setLoading(true);
      const res = await proctoringAPI.getReport(candidateId as string) as any;
      setProctoringReport(res.report);
    } catch (error) {
      console.error('Error fetching proctoring report', error);
      toast({ title: 'Error', description: 'Failed to load proctoring evidence', variant: 'destructive' });
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

  const logs = proctoringReport?.logs || [];
  const highRiskLogs = logs.filter((l: any) => l.risk_level === 'high' || l.event_type === 'ai_violation' || l.event_type === 'mobile_phone').length;
  const mediumRiskLogs = logs.filter((l: any) => l.risk_level === 'medium' || l.event_type === 'tab_switch' || l.event_type === 'fullscreen_exit').length;
  let riskScore = (highRiskLogs * 30) + (mediumRiskLogs * 10);
  riskScore = Math.min(riskScore, 100);
  
  const riskLevel = riskScore >= 70 ? 'High Risk' : riskScore >= 30 ? 'Medium Risk' : 'Low Risk';
  const riskColor = riskScore >= 70 ? 'text-destructive' : riskScore >= 30 ? 'text-warning' : 'text-success';
  const riskBg = riskScore >= 70 ? 'bg-destructive/10 border-destructive/20' : riskScore >= 30 ? 'bg-warning/10 border-warning/20' : 'bg-success/10 border-success/20';

  const generateAISummary = () => {
    if (logs.length === 0) return "No suspicious activities were detected during the assessment. The candidate's session appears clean.";
    
    let summary = `The AI Proctoring system flagged ${logs.length} suspicious events during the assessment. `;
    if (highRiskLogs > 0) {
      summary += `This includes ${highRiskLogs} high-severity violations, which strongly suggest potential malpractice such as using a mobile phone or unauthorized assistance. `;
    }
    if (mediumRiskLogs > 0) {
      summary += `There were also ${mediumRiskLogs} medium-severity events like navigating away from the test window. `;
    }
    
    if (riskScore >= 70) {
      summary += "Based on the frequency and severity of these incidents, the candidate's integrity score is extremely low. Immediate review of the visual evidence below is recommended.";
    } else if (riskScore >= 30) {
      summary += "The detected anomalies warrant manual verification to rule out false positives or accidental window switches.";
    } else {
      summary += "The detected incidents are minor and likely benign, though standard verification is still recommended.";
    }
    
    return summary;
  };

  // Get unique event types for filter
  const eventTypes = Array.from(new Set(logs.map((l: any) => l.event_type)));

  // Filter logs
  const filteredLogs = logs.filter((log: any) => {
    const isHighRisk = log.risk_level === 'high' || log.event_type === 'ai_violation' || log.event_type === 'mobile_phone';
    const severityMatch = filterSeverity === 'all' || 
                          (filterSeverity === 'high' && isHighRisk) || 
                          (filterSeverity === 'medium' && !isHighRisk);
    const typeMatch = filterType === 'all' || log.event_type === filterType;
    return severityMatch && typeMatch;
  });

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`/dashboard/assessments/${assessmentId}/results`)} className="mb-2 -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidate Results
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              Proctoring Evidence Report
            </h1>
            <p className="text-muted-foreground mt-1">Review timestamped visual evidence of suspicious activities</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !proctoringReport ? (
          <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
            <p className="text-muted-foreground">No proctoring data found for this candidate.</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Risk Score & AI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className={`border ${riskBg} shadow-sm md:col-span-1`}>
                <CardContent className="p-6 flex flex-col justify-center items-center text-center h-full">
                   <p className="text-xs uppercase font-bold text-muted-foreground mb-3">Overall Risk Score</p>
                   <div className="flex items-baseline gap-1">
                     <span className={`text-6xl font-black ${riskColor}`}>{riskScore}</span>
                     <span className="text-lg font-bold text-muted-foreground">/ 100</span>
                   </div>
                   <Badge variant="outline" className={`mt-3 border-current ${riskColor} font-bold text-sm px-3 py-1`}>{riskLevel}</Badge>
                </CardContent>
              </Card>

              <Card className="border border-border/50 shadow-sm bg-accent/5 md:col-span-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Bot className="w-32 h-32" />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                    <Bot className="h-4 w-4" />
                    AI Proctoring Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground relative z-10">
                    {generateAISummary()}
                  </p>
                  
                  <div className="grid grid-cols-3 gap-4 mt-6 relative z-10">
                    <div className="bg-background/80 p-3 rounded-lg border border-border/50 text-center">
                      <p className="text-2xl font-black">{logs.length}</p>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Events</p>
                    </div>
                    <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-center">
                      <p className="text-2xl font-black text-destructive">{highRiskLogs}</p>
                      <p className="text-[10px] font-bold uppercase text-destructive/80">High Severity</p>
                    </div>
                    <div className="bg-warning/10 p-3 rounded-lg border border-warning/20 text-center">
                      <p className="text-2xl font-black text-warning-foreground">{mediumRiskLogs}</p>
                      <p className="text-[10px] font-bold uppercase text-warning-foreground/80">Medium Severity</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Evidence Viewer Controls */}
            {logs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-2">
                  <Button 
                    variant={viewMode === 'gallery' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setViewMode('gallery')}
                    className="flex items-center gap-2"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Gallery View
                  </Button>
                  <Button 
                    variant={viewMode === 'timeline' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setViewMode('timeline')}
                    className="flex items-center gap-2"
                  >
                    <List className="h-4 w-4" />
                    Timeline View
                  </Button>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={filterSeverity} 
                    onChange={(e) => setFilterSeverity(e.target.value as any)}
                    className="bg-background border border-input rounded-md text-sm px-3 py-2 flex-1 sm:w-auto"
                  >
                    <option value="all">All Severities</option>
                    <option value="high">High Severity</option>
                    <option value="medium">Medium Severity</option>
                  </select>
                  
                  <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-background border border-input rounded-md text-sm px-3 py-2 flex-1 sm:w-auto"
                  >
                    <option value="all">All Violations</option>
                    {eventTypes.map((type: any) => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            {/* Gallery / Timeline Content */}
            {logs.length > 0 ? (
              filteredLogs.length > 0 ? (
                viewMode === 'gallery' ? (
                  /* --- GALLERY VIEW --- */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLogs.map((log: any, index: number) => {
                      const isHighRisk = log.risk_level === 'high' || log.event_type === 'ai_violation' || log.event_type === 'mobile_phone';
                      
                      return (
                        <Card 
                          key={index} 
                          className={cn(
                            "overflow-hidden flex flex-col group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1",
                            isHighRisk ? "border-destructive/30" : "border-warning/30"
                          )}
                          onClick={() => setSelectedLog(log)}
                        >
                          <div className="relative aspect-video bg-muted/30 overflow-hidden flex items-center justify-center">
                            {log.screenshot_url ? (
                              <>
                                <img 
                                  src={log.screenshot_url.startsWith('http') ? log.screenshot_url : `${BACKEND_BASE_URL}${log.screenshot_url}`} 
                                  alt="Evidence Thumbnail" 
                                  className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Maximize2 className="h-8 w-8 text-white drop-shadow-md" />
                                </div>
                              </>
                            ) : (
                              <div className="text-muted-foreground flex flex-col items-center gap-2">
                                <AlertTriangle className="h-8 w-8 opacity-50" />
                                <span className="text-xs uppercase font-bold tracking-wider opacity-50">No Image</span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2 flex gap-2">
                              <Badge variant={isHighRisk ? "destructive" : "default"} className={isHighRisk ? "shadow-sm" : "bg-warning hover:bg-warning/80 text-warning-foreground shadow-sm"}>
                                {log.event_type.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-background/90 text-[10px] font-mono shadow-sm">
                                {format(new Date(log.timestamp), 'HH:mm:ss')}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4 flex-1 bg-gradient-to-b from-transparent to-muted/10">
                            <p className="text-sm font-medium line-clamp-2">{log.description}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  /* --- TIMELINE VIEW --- */
                  <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {filteredLogs.map((log: any, index: number) => {
                      const isHighRisk = log.risk_level === 'high' || log.event_type === 'ai_violation' || log.event_type === 'mobile_phone';
                      
                      return (
                        <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10",
                            isHighRisk ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"
                          )}>
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          
                          <Card className={cn(
                            "w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-5 shadow-md transition-all hover:shadow-lg",
                            isHighRisk ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
                          )}>
                             <div className="flex justify-between items-start mb-3">
                               <Badge variant={isHighRisk ? "destructive" : "default"} className={isHighRisk ? "text-xs" : "bg-warning hover:bg-warning/80 text-xs text-warning-foreground"}>
                                 {log.event_type.replace(/_/g, ' ')}
                               </Badge>
                               <span className="text-xs text-muted-foreground font-mono bg-background/80 px-2 py-1 rounded border border-border/50">
                                 {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                               </span>
                             </div>
                             <p className="text-sm font-semibold mb-4 text-foreground/90">{log.description}</p>
                             
                             {log.screenshot_url ? (
                               <div className="mt-4 bg-background/80 p-3 rounded-xl border border-border/50 shadow-inner">
                                 <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2 flex justify-between items-center">
                                   <span>Visual Evidence Captured</span>
                                   <span className="text-primary cursor-pointer hover:underline flex items-center gap-1" onClick={() => setSelectedLog(log)}>
                                     <Maximize2 className="h-3 w-3" /> View Full
                                   </span>
                                 </p>
                                 <img 
                                   src={log.screenshot_url.startsWith('http') ? log.screenshot_url : `${BACKEND_BASE_URL}${log.screenshot_url}`} 
                                   alt="Evidence" 
                                   className="w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                                   onClick={() => setSelectedLog(log)}
                                 />
                               </div>
                             ) : (
                               <div className="mt-4 bg-background/50 p-4 rounded-xl border border-border/50 border-dashed text-center">
                                 <p className="text-xs text-muted-foreground">No screenshot captured for this event.</p>
                               </div>
                             )}
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
                  <p className="text-muted-foreground">No evidence matches your current filters.</p>
                  <Button variant="link" onClick={() => { setFilterSeverity('all'); setFilterType('all'); }}>Clear Filters</Button>
                </div>
              )
            ) : (
              <div className="text-center py-12 bg-success/5 rounded-3xl border-2 border-dashed border-success/20">
                <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h4 className="text-xl font-bold text-success mb-2">Assessment Clean</h4>
                <p className="text-sm font-medium text-success/80 max-w-md mx-auto">No suspicious activities or malpractice detected during this candidate's session.</p>
              </div>
            )}
          </div>
        )}

        {/* Full-Screen Preview Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full p-0 flex flex-col md:flex-row overflow-hidden border-0 bg-background/95 backdrop-blur-md">
            {selectedLog && (
              <>
                {/* Close button for mobile */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 z-50 md:hidden bg-background/50 backdrop-blur"
                  onClick={() => setSelectedLog(null)}
                >
                  <X className="h-5 w-5" />
                </Button>

                {/* Left side: Image Viewer */}
                <div className="flex-1 bg-black/5 flex items-center justify-center relative p-4 md:p-8 min-h-[50vh]">
                  {selectedLog.screenshot_url ? (
                    <img 
                      src={selectedLog.screenshot_url.startsWith('http') ? selectedLog.screenshot_url : `${BACKEND_BASE_URL}${selectedLog.screenshot_url}`} 
                      alt="Full Evidence Preview" 
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-border/10"
                    />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center gap-4">
                      <AlertTriangle className="h-16 w-16 opacity-50" />
                      <p>No image captured for this event</p>
                    </div>
                  )}
                </div>

                {/* Right side: Evidence Details */}
                <div className="w-full md:w-[400px] lg:w-[450px] shrink-0 border-t md:border-t-0 md:border-l border-border/50 bg-background flex flex-col h-full overflow-y-auto">
                  <div className="p-6 space-y-8">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Badge 
                          variant={selectedLog.risk_level === 'high' || selectedLog.event_type === 'ai_violation' || selectedLog.event_type === 'mobile_phone' ? "destructive" : "default"} 
                          className={selectedLog.risk_level === 'high' || selectedLog.event_type === 'ai_violation' || selectedLog.event_type === 'mobile_phone' ? "text-sm px-3 py-1" : "bg-warning hover:bg-warning/80 text-warning-foreground text-sm px-3 py-1"}
                        >
                          {selectedLog.event_type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <h2 className="text-xl font-bold text-foreground mt-4 leading-tight">
                        {selectedLog.description}
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Timestamp</p>
                          <p className="font-mono text-sm">{format(new Date(selectedLog.timestamp), 'MMM dd, yyyy')}</p>
                          <p className="font-mono text-lg font-bold">{format(new Date(selectedLog.timestamp), 'HH:mm:ss')}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Severity Level</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={cn(
                              "w-3 h-3 rounded-full",
                              selectedLog.risk_level === 'high' || selectedLog.event_type === 'ai_violation' || selectedLog.event_type === 'mobile_phone' 
                                ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                                : "bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                            )} />
                            <span className="font-bold text-sm capitalize">
                              {selectedLog.risk_level === 'high' || selectedLog.event_type === 'ai_violation' || selectedLog.event_type === 'mobile_phone' ? 'High Risk' : 'Medium Risk'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 mt-6">
                        <h4 className="text-xs font-bold text-primary flex items-center gap-2 mb-2 uppercase tracking-wider">
                          <Bot className="h-4 w-4" />
                          AI Investigation Note
                        </h4>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          This event was automatically flagged by the AI Proctoring engine due to anomalous behavior matching the <strong>{selectedLog.event_type.replace(/_/g, ' ')}</strong> signature. 
                          {selectedLog.risk_level === 'high' || selectedLog.event_type === 'ai_violation' || selectedLog.event_type === 'mobile_phone'
                            ? " This is considered a severe violation of assessment integrity. Please review the visual evidence carefully."
                            : " This behavior may indicate an innocent mistake or a minor infraction. Manual review is suggested."}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-auto p-6 border-t border-border/50 bg-muted/10 hidden md:block">
                    <Button className="w-full" variant="outline" onClick={() => setSelectedLog(null)}>
                      Close Preview
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
