import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

/**
 * Standard page container with full viewport width and consistent horizontal padding.
 *
 * Maintains horizontal alignment with navbar/footer across all breakpoints.
 * Content expands to full viewport width with responsive padding.
 *
 * @example
 * ```tsx
 * <PageContainer className="py-8">
 *   <h1>Page Title</h1>
 *   {content}
 * </PageContainer>
 * ```
 */
export function PageContainer({ children, className, as: Component = 'div' }: PageContainerProps) {
  return <Component className={cn('w-full px-4 md:px-8', className)}>{children}</Component>;
}
