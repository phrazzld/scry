import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PlaygroundClient } from './_components/playground-client';

export const metadata: Metadata = {
  title: 'Playground | Genesis Lab',
  description: 'Fast iteration testing for generation infrastructure',
};

export default function PlaygroundPage() {
  // Guard: Only available in development
  if (process.env.NODE_ENV !== 'development') {
    redirect('/');
  }

  return <PlaygroundClient />;
}
