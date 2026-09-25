import {mkdir,mkdtemp,copyFile,cp,lstat,realpath,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
// Build into a fresh private staging directory. Never merge cached files into public output.
const files=['index.html','mathday-account-wallet.js','mathday-member-id.js','mathday-payments.js','mathday-learning-sync-core.js','mathday-single-session.js','sekolah-menengah-kpm-2022.js'];
const staging=await mkdtemp(path.join(root,'.mathday-build-'));
const publicDir=path.join(staging,'public');
await mkdir(publicDir);
for(const file of files)await copyFile(path.join(root,file),path.join(publicDir,file));
await cp(path.join(root,'quiz-assets'),path.join(publicDir,'quiz-assets'),{recursive:true});

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
