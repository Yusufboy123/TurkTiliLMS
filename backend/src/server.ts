import { app } from './app.js';
import { environment } from './config/environment.js';

const server = app.listen(environment.PORT, () => {
  console.log(`Turk Tili LMS API listening on http://localhost:${environment.PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received. Shutting down gracefully.`);

  server.close((error) => {
    if (error) {
      console.error('Failed to close the HTTP server cleanly.', error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
