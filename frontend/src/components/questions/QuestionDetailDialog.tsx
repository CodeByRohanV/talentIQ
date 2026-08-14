import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';

interface Question {
  id: string;
  domain: string;
  domain_name?: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  difficulty: string;
  question_type?: string;
}

interface QuestionDetailDialogProps {
  question: Question | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuestionDetailDialog({ question, open, onOpenChange }: QuestionDetailDialogProps) {
  if (!question) return null;

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Question Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Domain & Difficulty */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {question.domain_name || question.domain}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {question.difficulty}
            </Badge>
          </div>

          {/* Question Text */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Question</p>
            <p className="text-sm leading-relaxed">{question.question_text}</p>
          </div>

          {/* Options */}
          {question.question_type === 'SUBJECTIVE' ? (
            <div className="mt-4">
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Subjective Question
              </Badge>
            </div>
          ) : (
            question.options && question.options.some(opt => opt.trim() !== '') && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Options</p>
                {question.options.map((option, idx) => {
                  const isCorrect = idx === question.correct_answer;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${isCorrect
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-border'
                        }`}
                    >
                      <span className={`font-semibold shrink-0 ${isCorrect ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {optionLetters[idx]}.
                      </span>
                      <span className="flex-1">{option}</span>
                      {isCorrect && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
