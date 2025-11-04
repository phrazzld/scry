import { ConfigManagerPage } from './_components/config-manager-page';

/**
 * Config Management Route
 *
 * Full-page interface for creating and editing generation configurations.
 * Dev-only route - not accessible in production.
 */
export default function ConfigsPage() {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Not Available</h1>
          <p className="text-muted-foreground">
            Config management is only available in development mode.
          </p>
        </div>
      </div>
    );
  }

  return <ConfigManagerPage />;
}
