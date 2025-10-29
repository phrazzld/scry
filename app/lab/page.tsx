import { LabClient } from './_components/lab-client';

/**
 * Genesis Laboratory Route
 *
 * Dev-only route for testing generation infrastructure configurations.
 * Accessible at /lab in development mode only.
 */
export default function LabPage() {
  // Dev-only guard - prevent access in production
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Not Available</h1>
          <p className="text-muted-foreground">
            Genesis Laboratory is only available in development mode.
          </p>
        </div>
      </div>
    );
  }

  return <LabClient />;
}
