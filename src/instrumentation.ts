export async function register() {
  // Only run on the Node.js runtime (not edge), and only on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler');
    await startScheduler();
  }
}
