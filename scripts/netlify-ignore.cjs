const { execFileSync } = require('node:child_process');
// Deploy previews are built normally. Production requires a dated, deliberate
// release marker (today UTC) or a flagged Sunday release.
if (process.env.CONTEXT !== 'production') process.exit(1);
const msg = execFileSync('git', ['log', '-1', '--pretty=%B', process.env.COMMIT_REF || 'HEAD'], {encoding:'utf8'});
const today = new Date().toISOString().slice(0, 10);
const explicit = msg.includes('[manual-release:' + today + ']');
const weekly = new Date().getUTCDay() === 0 && msg.includes('[deploy]');
process.exit(explicit || weekly ? 1 : 0);
