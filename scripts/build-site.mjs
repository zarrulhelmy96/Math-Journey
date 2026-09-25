import {mkdir,copyFile,cp,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
// Whitelist public assets. Never publish Functions, credentials, env files, rules or admin tools.
await mkdir(dist,{recursive:true});
const files=['index.html','mathday-account-wallet.js','mathday-member-id.js','mathday-payments.js','mathday-learning-sync-core.js','mathday-single-session.js','sekolah-menengah-kpm-2022.js'];
for(const file of files)await copyFile(path.join(root,file),path.join(dist,file));
await cp(path.join(root,'quiz-assets'),path.join(dist,'quiz-assets'),{recursive:true});
// Build directories are ephemeral on Netlify. Refuse unexpected existing files instead of deleting user data.
for(const entry of await readdir(dist))if(![...files,'quiz-assets'].includes(entry))throw Error('Unexpected file in dist; use a fresh build directory.');
console.log('Public MathDay site built; backend code and credentials are excluded.');
