import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { questionsAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Question {
    id: string;
    domain: string;
    domain_id: string;
    domain_name?: string;
    question_text: string;
    question_type?: string;
    options: string[];
    correct_answer: number;
    difficulty: string;
    max_score?: number;
}

interface Domain {
    id: string;
    name: string;
    slug: string;
}

interface EditQuestionDialogProps {
    question: Question | null;
    domains: Domain[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface QuestionForm {
    id: string;
    questionText: string;
    questionType: string;
    domainId: string;
    difficulty: string;
    correctAnswer: number;
    options: string[];
    maxScore: number | '';
}

export default function EditQuestionDialog({
    question,
    domains,
    open,
    onOpenChange,
    onSuccess
}: EditQuestionDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const createEmptyForm = (domainId: string): QuestionForm => ({
        id: Math.random().toString(36).substring(7),
        questionText: '',
        questionType: 'MULTIPLE_CHOICE',
        domainId: domainId,
        difficulty: 'medium',
        correctAnswer: 0,
        options: ['', '', '', ''],
        maxScore: 1
    });

    const [forms, setForms] = useState<QuestionForm[]>([]);

    useEffect(() => {
        if (question) {
            setForms([{
                id: question.id,
                questionText: question.question_text,
                questionType: question.question_type || 'MULTIPLE_CHOICE',
                domainId: question.domain_id || '',
                difficulty: question.difficulty,
                correctAnswer: question.correct_answer,
                options: [...question.options],
                maxScore: question.max_score || (question.question_type === 'SUBJECTIVE' ? 10 : 1)
            }]);
        } else {
            setForms([createEmptyForm(domains.length > 0 ? domains[0].id : '')]);
        }
    }, [question, domains, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        for (let i = 0; i < forms.length; i++) {
            if (!forms[i].questionText.trim()) {
                toast({ title: 'Validation Error', description: `Question text is required for question ${i + 1}`, variant: 'destructive' });
                return;
            }
        }

        setLoading(true);
        try {
            if (question) {
                const form = forms[0];
                const payload = {
                    questionText: form.questionText,
                    question_type: form.questionType,
                    domainId: form.domainId,
                    difficulty: form.difficulty,
                    correctAnswer: form.correctAnswer,
                    options: form.options,
                    max_score: typeof form.maxScore === 'number' ? form.maxScore : 1
                };
                await questionsAPI.update(question.id, payload);
                toast({ title: 'Question updated', description: 'Changes saved successfully.' });
            } else {
                await Promise.all(forms.map(form => questionsAPI.create({
                    questionText: form.questionText,
                    question_type: form.questionType,
                    domainId: form.domainId,
                    difficulty: form.difficulty,
                    correctAnswer: form.correctAnswer,
                    options: form.options,
                    max_score: typeof form.maxScore === 'number' ? form.maxScore : 1
                })));
                toast({ title: 'Questions created', description: `${forms.length} new question(s) added successfully.` });
            }

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save question(s)', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const updateForm = (index: number, updates: Partial<QuestionForm>) => {
        const newForms = [...forms];
        newForms[index] = { ...newForms[index], ...updates };
        setForms(newForms);
    };

    const updateOption = (formIndex: number, optIndex: number, val: string) => {
        const newForms = [...forms];
        const newOptions = [...newForms[formIndex].options];
        newOptions[optIndex] = val;
        newForms[formIndex] = { ...newForms[formIndex], options: newOptions };
        setForms(newForms);
    };

    const addQuestion = () => {
        const lastForm = forms[forms.length - 1];
        const newForm = createEmptyForm(lastForm?.domainId || (domains.length > 0 ? domains[0].id : ''));
        newForm.questionType = lastForm?.questionType || 'MULTIPLE_CHOICE';
        newForm.maxScore = lastForm?.maxScore || (newForm.questionType === 'SUBJECTIVE' ? 10 : 1);
        setForms([...forms, newForm]);
    };

    const removeQuestion = (index: number) => {
        setForms(forms.filter((_, i) => i !== index));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
                    <DialogTitle className="text-xl">{question ? 'Edit Question' : 'Create Questions'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="px-6 py-4 space-y-5 bg-slate-50/50 dark:bg-slate-900/20">
                        {forms.map((formData, formIndex) => (
                            <div key={formData.id} className="relative bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                                            {formIndex + 1}
                                        </div>
                                        {question ? 'Edit Question' : 'New Question'}
                                    </h3>
                                    {!question && forms.length > 1 && (
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold text-xs rounded-lg"
                                            onClick={() => removeQuestion(formIndex)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                            Remove
                                        </Button>
                                    )}
                                </div>

                                <div className="p-5 space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div className="space-y-2.5">
                                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Domain</Label>
                                            <Select
                                                value={formData.domainId}
                                                onValueChange={(val) => updateForm(formIndex, { domainId: val })}
                                            >
                                                <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                                                    <SelectValue placeholder="Select domain" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {domains.map(d => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Difficulty</Label>
                                            <Select
                                                value={formData.difficulty}
                                                onValueChange={(val) => updateForm(formIndex, { difficulty: val })}
                                            >
                                                <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="easy">Easy</SelectItem>
                                                    <SelectItem value="medium">Medium</SelectItem>
                                                    <SelectItem value="hard">Hard</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Question Type</Label>
                                            <Select
                                                value={formData.questionType}
                                                onValueChange={(val) => updateForm(formIndex, { 
                                                    questionType: val, 
                                                    maxScore: val === 'SUBJECTIVE' ? 10 : 1 
                                                })}
                                            >
                                                <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary/20">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                                                    <SelectItem value="SUBJECTIVE">Subjective (Text Input)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Question Text</Label>
                                        <Textarea
                                            value={formData.questionText}
                                            onChange={(e) => updateForm(formIndex, { questionText: e.target.value })}
                                            rows={2}
                                            className="resize-none leading-relaxed focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[60px]"
                                            placeholder="Type your question here..."
                                            required
                                        />
                                    </div>

                                    <AnimatePresence mode="popLayout">
                                        {formData.questionType === 'SUBJECTIVE' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-2.5 pt-1 pb-3"
                                            >
                                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Max Score / Marks</Label>
                                                <Input 
                                                    type="number"
                                                    min="1"
                                                    className="h-10 w-32 focus-visible:ring-2 focus-visible:ring-primary/20"
                                                    value={formData.maxScore}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        updateForm(formIndex, { maxScore: val === '' ? '' : parseInt(val) });
                                                    }}
                                                    required
                                                />
                                            </motion.div>
                                        )}
                                        {formData.questionType === 'MULTIPLE_CHOICE' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-4 bg-slate-50/50 dark:bg-slate-800/30 p-5 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                                            >
                                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                    Options 
                                                    <span className="normal-case font-normal text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                                                        Select the correct answer
                                                    </span>
                                                </Label>
                                                <div className="grid gap-3 pt-1">
                                                    {formData.options.map((opt, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className={cn(
                                                                "flex gap-3 items-center p-2.5 rounded-xl transition-all border shadow-sm",
                                                                formData.correctAnswer === idx 
                                                                    ? "bg-green-50/80 border-green-200 dark:bg-green-950/20 dark:border-green-900 ring-1 ring-green-200" 
                                                                    : "bg-white border-slate-200 dark:border-slate-800 dark:bg-slate-900"
                                                            )}
                                                        >
                                                            <div className="relative flex items-center justify-center pl-2">
                                                                <Input
                                                                    type="radio"
                                                                    name={`correct-${formData.id}-${idx}`}
                                                                    checked={formData.correctAnswer === idx}
                                                                    onChange={() => updateForm(formIndex, { correctAnswer: idx })}
                                                                    className="w-5 h-5 cursor-pointer shrink-0 accent-green-600 transition-transform hover:scale-110"
                                                                />
                                                            </div>
                                                            <Input
                                                                value={opt}
                                                                onChange={(e) => updateOption(formIndex, idx, e.target.value)}
                                                                placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                                                className={cn(
                                                                    "h-11 focus-visible:ring-2 focus-visible:ring-primary/20",
                                                                    formData.correctAnswer === idx && "border-green-300 bg-white"
                                                                )}
                                                                required
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ))}

                        {!question && (
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={addQuestion}
                                className="w-full h-14 border-dashed border-2 rounded-2xl font-bold text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all"
                            >
                                <Plus className="mr-2 h-5 w-5" /> Add Another Question
                            </Button>
                        )}
                    </div>

                    <DialogFooter className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900/50 sticky bottom-0 z-10">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="px-6">Cancel</Button>
                        <Button type="submit" disabled={loading} className="px-8 shadow-sm hover:shadow-md transition-all font-semibold">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {question ? 'Save Changes' : `Save ${forms.length > 1 ? forms.length + ' Questions' : 'Question'}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
