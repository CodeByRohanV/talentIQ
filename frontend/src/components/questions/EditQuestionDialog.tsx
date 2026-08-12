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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { questionsAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Question {
    id: string;
    domain: string;
    domain_id: string;
    domain_name?: string;
    question_text: string;
    options: string[];
    correct_answer: number;
    difficulty: string;
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

export default function EditQuestionDialog({
    question,
    domains,
    open,
    onOpenChange,
    onSuccess
}: EditQuestionDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        questionText: '',
        domainId: '',
        difficulty: 'medium',
        correctAnswer: 0,
        options: ['', '', '', '']
    });

    useEffect(() => {
        if (question) {
            setFormData({
                questionText: question.question_text,
                domainId: question.domain_id || '',
                difficulty: question.difficulty,
                correctAnswer: question.correct_answer,
                options: [...question.options]
            });
        }
    }, [question]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question) return;

        setLoading(true);
        try {
            await questionsAPI.update(question.id, {
                questionText: formData.questionText,
                domainId: formData.domainId,
                difficulty: formData.difficulty,
                correctAnswer: formData.correctAnswer,
                options: formData.options
            });

            toast({ title: 'Question updated', description: 'Changes saved successfully.' });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update question', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const updateOption = (idx: number, val: string) => {
        const newOptions = [...formData.options];
        newOptions[idx] = val;
        setFormData({ ...formData, options: newOptions });
    };

    if (!question) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Question</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Domain</Label>
                            <Select
                                value={formData.domainId}
                                onValueChange={(val) => setFormData({ ...formData, domainId: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select domain" />
                                </SelectTrigger>
                                <SelectContent>
                                    {domains.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Difficulty</Label>
                            <Select
                                value={formData.difficulty}
                                onValueChange={(val) => setFormData({ ...formData, difficulty: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Question Text</Label>
                        <Textarea
                            value={formData.questionText}
                            onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                            rows={3}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Options (Mark correct answer)</Label>
                        {formData.options.map((opt, idx) => (
                            <div key={idx} className="flex gap-3 items-center">
                                <Input
                                    type="radio"
                                    name="correct"
                                    checked={formData.correctAnswer === idx}
                                    onChange={() => setFormData({ ...formData, correctAnswer: idx })}
                                    className="w-4 h-4 cursor-pointer"
                                />
                                <Input
                                    value={opt}
                                    onChange={(e) => updateOption(idx, e.target.value)}
                                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                    required
                                />
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
