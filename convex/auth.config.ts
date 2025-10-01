const authConfig = {
  providers: [
    // Development domain
    { domain: 'https://rapid-jawfish-0.clerk.accounts.dev', applicationID: 'convex' },
    // Production domain
    { domain: 'https://clerk.scry.study', applicationID: 'convex' },
  ],
};

export default authConfig;
