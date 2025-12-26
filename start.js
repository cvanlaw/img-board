const { spawn } = require('child_process');

console.log('Starting image slideshow services...');

// Start preprocessor
const preprocessor = spawn('node', ['preprocessor.js'], {
  stdio: 'inherit',
  env: { ...process.env, PROCESS_NAME: 'preprocessor' }
});

preprocessor.on('error', (err) => {
  console.error('Preprocessor failed to start:', err);
});

preprocessor.on('exit', (code) => {
  console.error('Preprocessor exited with code:', code);
});

// Start server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PROCESS_NAME: 'server' }
});

server.on('error', (err) => {
  console.error('Server failed to start:', err);
});

server.on('exit', (code) => {
  console.error('Server exited with code:', code);
});

// Handle container shutdown signals
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  preprocessor.kill('SIGTERM');
  server.kill('SIGTERM');

  // Force kill after timeout
  setTimeout(() => {
    preprocessor.kill('SIGKILL');
    server.kill('SIGKILL');
    process.exit(0);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep process running
process.stdin.resume();
