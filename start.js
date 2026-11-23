// start.js
const { exec } = require('child_process');

// Start your server
const server = exec('node server/index.js');

// Pipe server output to console
server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

// Wait for the server to boot, then open Chrome
setTimeout(async () => {
  try {
    // Dynamic import works with ESM-only packages from CommonJS
    const openModule = await import('open');
    const open = openModule.default;

    await open('http://localhost:3000', { app: { name: 'chrome' } });
    console.log('✅ Opened in Chrome');
  } catch (err) {
    console.error('Could not open Chrome automatically:', err.message);
    console.log('Server is still running at http://localhost:3000');
  }
}, 1500);