import type { Metadata } from 'next';

import { TasksClient } from './_components/tasks-client';

export const metadata: Metadata = {
  title: 'Background Tasks | Scry',
  description: 'Manage AI question generation jobs',
};

export default function TasksPage() {
  return <TasksClient />;
}
