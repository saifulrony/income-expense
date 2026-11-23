const { spawn } = require('child_process');
const child = spawn('./node_modules/.bin/next', ['dev', '-H', '0.0.0.0', '-p', '18000'], {
  cwd: __dirname,
  stdio: ['pipe', 'inherit', 'inherit']
});
child.on('exit', (code, sig) => {
  console.log(`[serve-dev] Next.js exited with code ${code}, signal ${sig}`);
  process.exit(code || 0);
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
setInterval(() => {}, 60000);
