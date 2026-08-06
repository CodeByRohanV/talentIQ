import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your email...');
    const token = searchParams.get('token');
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Missing verification token. Please check your link.');
            return;
        }

        const verify = async () => {
            try {
                const response = await authAPI.verifyEmail(token) as any;
                setStatus('success');
                setMessage(response.message || 'Your email has been verified successfully!');
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Verification failed. The link may be invalid or expired.');
            }
        };

        verify();
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 px-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.png" alt="skillz" className="w-14 h-14 rounded-xl mb-4 shadow-lg shadow-primary/25" />
                    <h1 className="text-2xl font-bold text-gradient">skillz</h1>
                </div>

                <Card className="border-border/50 shadow-xl overflow-hidden">
                    <div className={`h-2 w-full ${status === 'success' ? 'bg-success' : status === 'error' ? 'bg-destructive' : 'bg-primary'
                        }`} />

                    <CardHeader className="text-center pt-8">
                        <div className="mx-auto mb-4">
                            {status === 'loading' && <Loader2 className="w-12 h-12 text-primary animate-spin" />}
                            {status === 'success' && <CheckCircle2 className="w-12 h-12 text-success" />}
                            {status === 'error' && <XCircle className="w-12 h-12 text-destructive" />}
                        </div>
                        <CardTitle className="text-2xl font-bold">
                            {status === 'loading' && 'Verifying...'}
                            {status === 'success' && 'Email Verified!'}
                            {status === 'error' && 'Verification Failed'}
                        </CardTitle>
                        <CardDescription className="text-base mt-2">
                            {message}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pb-8">
                        {status === 'success' ? (
                            <Button asChild className="w-full h-11 text-base font-bold">
                                <Link to="/auth">Sign In Now</Link>
                            </Button>
                        ) : status === 'error' ? (
                            <div className="space-y-3">
                                <Button asChild variant="outline" className="w-full h-11 text-base font-bold">
                                    <Link to="/auth">Back to Login</Link>
                                </Button>
                                <p className="text-center text-xs text-muted-foreground mt-4">
                                    Still having trouble? <button className="text-primary hover:underline font-bold">Contact Support</button>
                                </p>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
