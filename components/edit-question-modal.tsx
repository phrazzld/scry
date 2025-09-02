'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Doc } from '@/convex/_generated/dataModel'

interface EditQuestionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: Doc<"questions">
  onSave: (updates: {
    question: string
    options: string[]
    correctAnswer: string
  }) => Promise<void>
}

export function EditQuestionModal({ 
  open, 
  onOpenChange, 
  question, 
  onSave 
}: EditQuestionModalProps) {
  const [questionText, setQuestionText] = useState(question.question)
  const [options, setOptions] = useState<string[]>(question.options)
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  
  // Reset state when modal opens with new question
  useEffect(() => {
    if (open) {
      setQuestionText(question.question)
      setOptions([...question.options])
      setCorrectAnswer(question.correctAnswer)
      setErrors([])
    }
  }, [open, question])
  
  const validateForm = (): boolean => {
    const newErrors: string[] = []
    
    if (!questionText.trim()) {
      newErrors.push('Question text is required')
    }
    
    if (options.length < 2) {
      newErrors.push('At least 2 answer options are required')
    }
    
    if (options.length > 6) {
      newErrors.push('Maximum 6 answer options allowed')
    }
    
    const nonEmptyOptions = options.filter(opt => opt.trim())
    if (nonEmptyOptions.length !== options.length) {
      newErrors.push('All answer options must have text')
    }
    
    if (!options.includes(correctAnswer)) {
      newErrors.push('Correct answer must be one of the options')
    }
    
    setErrors(newErrors)
    return newErrors.length === 0
  }
  
  const handleSave = async () => {
    if (!validateForm()) {
      return
    }
    
    setIsSaving(true)
    
    try {
      await onSave({
        question: questionText.trim(),
        options: options.map(opt => opt.trim()),
        correctAnswer: correctAnswer.trim()
      })
      
      toast.success('Question updated successfully')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save question:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, ''])
    }
  }
  
  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index)
      setOptions(newOptions)
      
      // If we removed the correct answer, set it to the first option
      if (options[index] === correctAnswer) {
        setCorrectAnswer(newOptions[0])
      }
    }
  }
  
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    const oldValue = newOptions[index]
    newOptions[index] = value
    setOptions(newOptions)
    
    // Update correct answer if it was the changed option
    if (oldValue === correctAnswer) {
      setCorrectAnswer(value)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-700">{error}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <textarea
              id="question"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full min-h-[80px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your question..."
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Answer Options</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                disabled={options.length >= 6}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            </div>
            
            <RadioGroup value={correctAnswer} onValueChange={setCorrectAnswer}>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <RadioGroupItem 
                      value={option} 
                      id={`option-${index}`}
                      className="mt-3"
                    />
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                        disabled={options.length <= 2}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
            
            <p className="text-xs text-gray-500">
              Select the radio button next to the correct answer
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2">Preview</h4>
            <div className="space-y-2">
              <p className="font-medium">{questionText || 'Question will appear here...'}</p>
              <div className="space-y-1">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{idx + 1}.</span>
                    <span className={opt === correctAnswer ? 'font-medium text-green-600' : ''}>
                      {opt || `Option ${idx + 1}`}
                    </span>
                    {opt === correctAnswer && (
                      <span className="text-xs text-green-600">(correct)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}