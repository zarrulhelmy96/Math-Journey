import {mkdir,mkdtemp,copyFile,cp,lstat,realpath,rename,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {questionBankFiles,validateQuestionBank} from './question-bank-files.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
// Build into a fresh private staging directory. Never merge cached files into public output.
const files=['index.html','mathday-account-wallet.js','mathday-member-id.js','mathday-payments.js','mathday-learning-sync-core.js','mathday-single-session.js','sekolah-menengah-kpm-2022.js','manifest.webmanifest','mathday-pwa.js','mathday-pwa.css','mathday-update-loader.js','offline.html','sw.js',...questionBankFiles];
console.log('Validated question bank: '+await validateQuestionBank(root)+' existing records.');
const staging=await mkdtemp(path.join(root,'.mathday-build-'));
const publicDir=path.join(staging,'public');
await mkdir(publicDir);
for(const file of files){await mkdir(path.dirname(path.join(publicDir,file)),{recursive:true});await copyFile(path.join(root,file),path.join(publicDir,file));}
await cp(path.join(root,'quiz-assets'),path.join(publicDir,'quiz-assets'),{recursive:true});
await cp(path.join(root,'pwa-icons'),path.join(publicDir,'pwa-icons'),{recursive:true});
// Changing app code changes the worker bytes, so installed users can opt into the update.
const versionHash=createHash('sha256');
for(const file of [...files,'pwa-icons/icon-192.png','pwa-icons/icon-512.png','pwa-icons/maskable-512.png','pwa-icons/apple-touch-icon.png']){
  versionHash.update(file).update(await readFile(path.join(root,file)));
}
const worker=await readFile(path.join(publicDir,'sw.js'),'utf8');
const marker="const VERSION = 'mathday-pwa-v1';";
if(!worker.includes(marker))throw Error('Missing PWA worker version marker; previous output is untouched.');
await writeFile(path.join(publicDir,'sw.js'),worker.replace(marker,"const VERSION = '"+versionHash.digest('hex').slice(0,20)+"';"));

// Preserve existing output outside the publish directory instead of deleting user files.
// Validate the exact target before moving it; refuse symlinks or unexpected paths.
let previous;
try{previous=await lstat(dist);}catch(error){if(error.code!=='ENOENT')throw error;}
if(previous){
  const resolvedRoot=await realpath(root);
  if(previous.isSymbolicLink()||!previous.isDirectory()||await realpath(dist)!==path.join(resolvedRoot,'dist')){
    throw Error('Unsafe dist directory; existing files were not moved.');
  }
  await rename(dist,path.join(staging,'previous-dist'));
}
try{
  await rename(publicDir,dist);
}catch(error){
  if(previous)await rename(path.join(staging,'previous-dist'),dist);
  throw error;
}
if(previous)console.log('Previous build preserved outside dist in '+path.relative(root,path.join(staging,'previous-dist')));
console.log('Public MathDay site built; backend code and credentials are excluded.');
