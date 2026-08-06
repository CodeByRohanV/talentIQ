import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';

export default function TestComplete() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-10 pb-8 text-center">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Assessment Complete!</h1>
          <p className="text-muted-foreground mb-8">
            Thank you for completing the assessment. Your responses have been recorded
            and will be reviewed by the recruiter.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>You can safely close this window now.</p>
          </div>

          <div className="flex items-center justify-center gap-2 mt-8 text-muted-foreground">
            <ClipboardCheck className="h-4 w-4" />
            <span className="text-sm">Powered by AssessHub</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
