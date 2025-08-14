const noop = () => {};
if (process.env.NODE_ENV === 'test') {
  // Only silence error logs from init to avoid the “Cannot log after tests” warning
  const originalError = console.error;
  console.error = (...args) => {
    if (String(args?.[0] ?? '').startsWith('Seed failed')) return;
    originalError(...args);
  };
}
