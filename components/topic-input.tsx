'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const topicFormSchema = z.object({
  topic: z
    .string()
    .min(3, 'Topic must be at least 3 characters long')
    .max(200, 'Topic must be less than 200 characters')
    .trim(),
});

type TopicFormValues = z.infer<typeof topicFormSchema>;

export function TopicInput() {
  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      topic: '',
    },
  });

  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (values: TopicFormValues) => {
    setIsLoading(true);

    try {
      const searchParams = new URLSearchParams({
        topic: values.topic,
      });

      router.push(`/create?${searchParams}`);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to navigate:', error);
      }
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full max-w-lg">
        <FormField
          control={form.control}
          name="topic"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="What do you want to learn?"
                    {...field}
                    disabled={isLoading}
                    className="text-lg h-14 px-4 pr-28 border-border rounded-lg"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isLoading || !field.value}
                    className="absolute right-2 top-2 h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Start'}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
