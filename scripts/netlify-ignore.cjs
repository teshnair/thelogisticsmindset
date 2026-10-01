const { execFileSync } = require('node:child_process');
if(process.env.CONTEXT !== 'production') process.exit(1);
const msg=execFileSync('git',['log','-1','--pretty=%B',process.env.COMMIT_REF||'HEAD'],{encoding:'utf8'});
const now=new Date();
const explicit=now.toISOString().slice(0,10)==='2026-10-01' && msg.includes('[manual-release:2026-10-01]');
const weekly=now.getUTCDay()===0 && msg.includes('[deploy]');
process.exit(explicit||weekly ? 1 : 0);
