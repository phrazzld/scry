'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { Doc } from '@/convex/_generated/dataModel';

interface EditQuestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Doc<'questions'>;
  onSave: (updates: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }) => Promise<void>;
}

export function EditQuestionModal({
  open,
  onOpenChange,
  question,
  onSave,
}: EditQuestionModalProps) {
  const [questionText, setQuestionText] = useState(question.question);
  const [options, setOptions] = useState<string[]>(question.options);
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer);
  const [explanation, setExplanation] = useState(question.explanation ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset state when modal opens with new question
  useEffect(() => {
    if (open) {
      setQuestionText(question.question);
      setOptions([...question.options]);
      setCorrectAnswer(question.correctAnswer);
      setExplanation(question.explanation ?? '');
      setErrors([]);
    }
  }, [open, question]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!questionText.trim()) {
      newErrors.push('Question text is required');
    }

    if (options.length < 2) {
      newErrors.push('At least 2 answer options are required');
    }

    if (options.length > 6) {
      newErrors.push('Maximum 6 answer options allowed');
    }

    const nonEmptyOptions = options.filter((opt) => opt.trim());
    if (nonEmptyOptions.length !== options.length) {
      newErrors.push('All answer options must have text');
    }

    if (!options.includes(correctAnswer)) {
      newErrors.push('Correct answer must be one of the options');
    }

    if (explanation.trim().length > 1200) {
      newErrors.push('Explanation must be 1200 characters or fewer');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const sanitizedQuestion = questionText.trim();
      const sanitizedOptions = options.map((opt) => opt.trim());
      const sanitizedCorrectAnswer = correctAnswer.trim();
      const sanitizedExplanation = explanation.trim();

      await onSave({
        question: sanitizedQuestion,
        options: sanitizedOptions,
        correctAnswer: sanitizedCorrectAnswer,
        explanation: sanitizedExplanation,
      });

      toast.success('Question updated successfully');
      onOpenChange(false);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to save question:', error);
      }
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);

      // If we removed the correct answer, set it to the first option
      if (options[index] === correctAnswer) {
        setCorrectAnswer(newOptions[0]);
      }
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    const oldValue = newOptions[index];
    newOptions[index] = value;
    setOptions(newOptions);

    // Update correct answer if it was the changed option
    if (oldValue === correctAnswer) {
      setCorrectAnswer(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-none md:max-w-[960px] w-[95vw] max-h-[92vh] h-[92vh] overflow-hidden p-0">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="px-6 pt-6">
            <DialogHeader className="text-left">
              <DialogTitle>Edit question content</DialogTitle>
              <DialogDescription>
                Tune the prompt, explanation, and answer options. Changes apply immediately to
                future reviews.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6 py-6">
              {errors.length > 0 && (
                <div className="bg-error-background border border-error-border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {errors.map((error, index) => (
                        <p key={index} className="text-sm text-error">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="question" className="text-sm font-medium text-foreground">
                  Question
                </Label>
                <Textarea
                  id="question"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Write the full prompt learners should see."
                  className="min-h-[120px] resize-y"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="explanation" className="text-sm font-medium text-foreground">
                  Explanation
                </Label>
                <Textarea
                  id="explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Optional: offer context or reasoning to reinforce the concept."
                  className="min-h-[100px] resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to skip—add detail when it helps learners recover.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">Answer Options</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    disabled={options.length >= 6}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add option
                  </Button>
                </div>

                <RadioGroup
                  value={correctAnswer}
                  onValueChange={setCorrectAnswer}
                  className="space-y-3"
                >
                  {options.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4"
                    >
                      <RadioGroupItem
                        value={option}
                        id={`option-${index}`}
                        className="mt-2"
                        aria-label={`Mark option ${index + 1} as correct`}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor={`option-${index}-textarea`}
                            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            Option {index + 1}
                          </Label>
                        </div>
                        <Textarea
                          id={`option-${index}-textarea`}
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`Write the answer text for option ${index + 1}`}
                          className="min-h-[90px] resize-y"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            {option === correctAnswer
                              ? 'Currently marked as correct'
                              : 'Select to mark as correct'}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCorrectAnswer(option)}
                              disabled={!option.trim()}
                              className="h-7 px-3 text-xs"
                            >
                              Set correct
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveOption(index)}
                              disabled={options.length <= 2}
                              className="text-error hover:text-error/90"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                <p className="text-xs text-muted-foreground">
                  Use the radio button or “Set correct” to choose the right answer. Each question
                  needs 2–6 options.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <h4 className="text-sm font-semibold text-foreground">Preview</h4>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Question
                    </p>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-line">
                      {questionText || 'Question will appear here...'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Options
                    </p>
                    <div className="mt-1 space-y-1">
                      {options.map((opt, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground font-medium">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          <span
                            className={`flex-1 ${opt === correctAnswer ? 'font-semibold text-success' : 'text-foreground'}`}
                          >
                            {opt || `Option ${idx + 1}`}
                          </span>
                          {opt === correctAnswer && (
                            <span className="text-xs font-medium text-success">Correct</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {explanation.trim().length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Explanation
                      </p>
                      <p className="mt-1 text-sm text-foreground whitespace-pre-line">
                        {explanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-background/95 py-4 px-6">
            <DialogFooter className="px-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
