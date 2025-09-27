import Link from 'next/link';
import { BookOpen, Home, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <SearchX className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-3xl font-mono font-bold text-ink">404</h1>
          <h2 className="text-xl font-mono font-medium text-ink">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1">
            <Link href="/">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/quizzes">
              <BookOpen className="h-4 w-4" />
              My Quizzes
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
