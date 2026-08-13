import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { testAPI, candidatesAPI, resolveApiUrl } from '@/lib/api';
import { Clock, FileQuestion, Loader2, AlertCircle, UserPlus, Info, CheckCircle2, Camera } from 'lucide-react';
import Webcam from 'react-webcam';
import { z } from 'zod';
import { cn } from '@/lib/utils';

interface Assessment {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  questionCount?: number;
  instructions?: string | null;
  availableUntil?: string | null;
  requiresPhotoId?: boolean;
}

const candidateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email'),
});

export default function TestLanding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [tempId, setTempId] = useState<number | null>(null);

  const [view, setView] = useState<'details' | 'instructions' | 'photo-id'>('details');
  const [candidateToken, setCandidateToken] = useState<string | null>(null);

  // Photo ID state
  const [photoCaptured, setPhotoCaptured] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAssessment();
    }
  }, [token]);

  const fetchAssessment = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await testAPI.getTest(token!) as any;

      if (response.requiresRegistration) {
        setAssessment({
          id: response.data.assessment.id,
          title: response.data.assessment.title,
          description: response.data.assessment.description,
          durationMinutes: response.data.assessment.durationMinutes,
          questionCount: response.data.assessment.questionCount || 0,
          instructions: response.data.assessment.instructions,
          availableFrom: response.data.assessment.availableFrom,
          availableUntil: response.data.assessment.availableUntil,
          requiresPhotoId: response.data.assessment.requiresPhotoId
        });
      } else {
        if (response.data.assessment.requiresPhotoId && !response.data.candidate.photoIdCaptured) {
          setAssessment({
            id: response.data.assessment.id,
            title: response.data.assessment.title,
            description: response.data.assessment.description,
            durationMinutes: response.data.assessment.durationMinutes,
            questionCount: response.data.assessment.questionCount || 0,
            instructions: response.data.assessment.instructions,
            availableFrom: response.data.assessment.availableFrom,
            availableUntil: response.data.assessment.availableUntil,
            requiresPhotoId: response.data.assessment.requiresPhotoId
          });
          setCandidateToken(token!);
          setView('photo-id');
        } else {
          // If it's already a candidate token and photo is not missing, redirect straight to taking the test
          navigate(`/test/${token}/take`, { replace: true });
          return;
        }
      }
    } catch (err: any) {
      console.error('Error loading assessment:', err);
      if (err.response?.status === 403) {
        setError('not-started');
        setAssessment(prev => ({ ...prev, availableFrom: err.response.data.availableFrom } as any));
      } else if (err.response?.status === 410 || err.response?.data?.expired) {
        setError('expired');
      } else if (err.response?.status === 400 && err.response?.data?.completed) {
        setError('completed');
      } else {
        setError(err.response?.data?.message || err.message || 'This assessment is not available or has been deactivated.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = candidateSchema.safeParse({ name, email });
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'name') fieldErrors.name = err.message;
        if (err.path[0] === 'email') fieldErrors.email = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await candidatesAPI.register({
        assessmentId: assessment!.id,
        name: name.trim(),
        email: email.trim(),
      });

      if (response && response.requiresOtp) {
        setTempId(response.tempId);
        setShowOtpInput(true);
        setSubmitting(false);
        return;
      }

      // Save token and show instructions
      const newToken = response.data?.shareToken || response.data?.share_token || response.shareToken;
      if (newToken) {
        setCandidateToken(newToken);
        
        // Initialize the test attempt in the backend so it exists for photo upload
        try {
          await testAPI.getTest(newToken);
        } catch (e) {
          console.error("Failed to initialize test attempt", e);
        }

        if (assessment?.requiresPhotoId) {
          setView('photo-id');
        } else {
          setView('instructions');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('No access token received.');
      }
    } catch (err: any) {
      console.error('Error creating candidate:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to register for assessment.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !tempId) return;
    setSubmitting(true);
    try {
      const response = await candidatesAPI.verifyOtp({ tempId, otp: otpCode });
      const newToken = response.data?.shareToken || response.data?.share_token || response.shareToken;
      
      if (newToken) {
        setCandidateToken(newToken);
        try {
          await testAPI.getTest(newToken);
        } catch (e) {
          console.error("Failed to initialize test attempt", e);
        }
        if (assessment?.requiresPhotoId) {
          setView('photo-id');
        } else {
          setView('instructions');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('No access token received after verification.');
      }
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      toast({
        title: 'Verification Failed',
        description: err.response?.data?.message || 'Invalid OTP.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startTest = () => {
    if (candidateToken) {
      navigate(`/test/${candidateToken}/take`, { replace: true });
    }
  };

  const capturePhoto = (getScreenshot: () => string | null) => {
    const imageSrc = getScreenshot();
    setPhotoCaptured(imageSrc);
  };

  const uploadPhoto = async () => {
    if (!photoCaptured || !candidateToken) return;
    setUploadingPhoto(true);
    try {
      // Convert base64 to Blob
      const res = await fetch(photoCaptured);
      const blob = await res.blob();
      
      const formData = new FormData();
      formData.append('photo', blob, 'photo-id.jpg');

      let response;
      try {
        response = await testAPI.uploadPhotoId(candidateToken!, formData);
      } catch (err: any) {
        // If the attempt wasn't created yet (e.g. from an old session without getTest called)
        if (err.response?.data?.message === 'No active test attempt found') {
          try {
            await testAPI.getTest(candidateToken!);
            // Retry upload
            response = await testAPI.uploadPhotoId(candidateToken!, formData);
          } catch (retryErr: any) {
            console.error('Failed to initialize attempt for retry', retryErr);
            throw retryErr;
          }
        } else {
          throw err;
        }
      }

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to upload photo');
      }

      // Success, move to instructions
      setView('instructions');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.response?.data?.message || err.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    const isNotStarted = error === 'not-started';
    const isExpired = error === 'expired';
    const isCompleted = error === 'completed';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
              isNotStarted ? "bg-amber-100 text-amber-600" : 
              isCompleted ? "bg-success/10 text-success" :
              "bg-destructive/10 text-destructive"
            )}>
              {isNotStarted ? <Clock className="h-8 w-8" /> : 
               isCompleted ? <CheckCircle2 className="h-8 w-8" /> :
               <AlertCircle className="h-8 w-8" />}
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {isNotStarted ? 'Test Not Started' : 
               isExpired ? 'Test Expired' : 
               isCompleted ? 'Assessment Completed' :
               'Assessment Unavailable'}
            </h2>
            <p className="text-muted-foreground">
              {isNotStarted ? (
                <>
                  This test is scheduled to start on {assessment?.availableFrom ? new Date(assessment.availableFrom).toLocaleString() : ''}. 
                  <br />Please return at the scheduled time.
                </>
              ) : isExpired ? (
                'The window for taking this test has closed.'
              ) : isCompleted ? (
                'You have already submitted this assessment. Thank you!'
              ) : error}
            </p>
            {!isNotStarted && !isExpired && !isCompleted && (
               <Button onClick={() => window.location.reload()} variant="outline" className="mt-6">Try Again</Button>
            )}
            {isCompleted && (
              <div className="mt-6 p-4 bg-success/5 rounded-xl border border-success/20">
                <p className="text-xs text-success font-medium">Your response has been successfully recorded and is under review.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-slate-100">
            <img src="/logo.png" alt="Xevyte" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold">{assessment?.title}</h1>
        </div>

        {view === 'details' ? (
          <>
            {/* Assessment Info */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-semibold">{assessment?.durationMinutes} minutes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                      <FileQuestion className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Questions</p>
                      <p className="font-semibold">{assessment?.questionCount || 'Varies'} questions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Registration / OTP Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  {showOtpInput ? 'Verify Email Address' : 'Enter Your Details'}
                </CardTitle>
                <CardDescription>
                  {showOtpInput ? 'We sent a 6-digit code to your email. Please enter it below to proceed.' : 'Please provide your information to begin the assessment'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showOtpInput ? (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp">Verification Code</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="text-center text-2xl tracking-widest"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting || otpCode.length !== 6}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify & Continue'
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={errors.name ? 'border-destructive' : ''}
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Continue to Instructions'
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <p className="text-center text-sm text-muted-foreground mt-6">
              By starting, you agree to complete the assessment honestly and independently.
            </p>
          </>
        ) : view === 'photo-id' ? (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Identity Verification
              </CardTitle>
              <CardDescription>
                This assessment requires a photo ID verification. Please position your face clearly in the frame.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="rounded-xl overflow-hidden bg-black/10 border-2 border-dashed border-border mx-auto max-w-sm relative aspect-video flex items-center justify-center">
                {!photoCaptured ? (
                  <Webcam
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="w-full h-full object-cover"
                  >
                    {({ getScreenshot }) => (
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <Button type="button" onClick={() => capturePhoto(getScreenshot)} className="rounded-full shadow-lg h-12 px-6">
                          Capture Photo
                        </Button>
                      </div>
                    )}
                  </Webcam>
                ) : (
                  <div className="relative w-full h-full">
                    <img src={photoCaptured} alt="Captured" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 opacity-0 hover:opacity-100 transition-opacity">
                      <Button type="button" variant="secondary" onClick={() => setPhotoCaptured(null)}>
                        Retake
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t">
                <Button 
                  onClick={uploadPhoto} 
                  disabled={!photoCaptured || uploadingPhoto} 
                  className="w-full h-11 font-bold text-base shadow-lg shadow-primary/20"
                >
                  {uploadingPhoto ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                  ) : (
                    'Confirm and Continue'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Test Instructions
              </CardTitle>
              <CardDescription>
                Please read the following rules carefully before starting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {assessment?.instructions && (
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    General Instructions
                  </h4>
                  <div className="text-sm text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                    {assessment.instructions}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg flex gap-3">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">01</span>
                  </div>
                  <div className="text-sm">
                    <strong className="block mb-0.5">Environment & Connectivity</strong>
                    <span className="text-muted-foreground">Ensure you are in a quiet room with stable internet. Use a laptop/desktop for the best experience.</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg flex gap-3">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">02</span>
                  </div>
                  <div className="text-sm">
                    <strong className="block mb-0.5">Fullscreen Mandatory</strong>
                    <span className="text-muted-foreground">The test will run in fullscreen mode. Exiting fullscreen will trigger a security violation.</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg flex gap-3">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">03</span>
                  </div>
                  <div className="text-sm">
                    <strong className="block mb-0.5">Zero-Tolerance for Switching</strong>
                    <span className="text-muted-foreground">Switching tabs, windows, or opening external applications is strictly monitored and can lead to disqualification.</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg flex gap-3">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">04</span>
                  </div>
                  <div className="text-sm">
                    <strong className="block mb-0.5">Continuous Monitoring</strong>
                    <span className="text-muted-foreground">Copy-pasting, right-clicking, and screenshots are disabled. Your session is logged for integrity audits.</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={startTest} className="w-full h-11 font-bold text-base shadow-lg shadow-primary/20">
                  I Understand, Start Test
                </Button>
                <p className="text-center text-[10px] text-muted-foreground mt-4 uppercase tracking-widest font-semibold italic">
                  The clock starts the moment you click "Start Test"
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
