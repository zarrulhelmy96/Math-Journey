import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
export const questionBankFiles=['renderers.js','legacy.js','registry.js','paper1.js','paper2.js'].map(name=>'question-bank/'+name);
export async function validateQuestionBank(root){
  const context=vm.createContext({});
  for(const name of questionBankFiles){
    const code=await readFile(path.join(root,name),'utf8');
    vm.runInContext(code,context,{filename:name,timeout:30000});
  }
  if(!vm.runInContext('MathDayQuestionBank.ready',context))throw Error('Question packs are incomplete.');
  return vm.runInContext('freshQuizBank.length',context);
}
