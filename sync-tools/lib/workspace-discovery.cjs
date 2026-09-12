const fs=require('node:fs'),path=require('node:path');
const IGNORES=new Set(['.git','.worktrees','.hg','.svn','node_modules','vendor','.pnpm-store','_archive','.cache','dist','build','.tmp','_kb-sync-staging','sync-artifacts','coverage','target']);
function discover(root,{all=false,registry=[]}={}) { if(!all) return registry.length?registry:[path.resolve(root)]; const out=[],seen=new Set(); function walk(d){let real;try{real=fs.realpathSync(d).toLowerCase()}catch{return}if(seen.has(real))return;seen.add(real);out.push(d);for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.isDirectory()&&!IGNORES.has(e.name.toLowerCase()))walk(path.join(d,e.name));}} walk(path.resolve(root)); return out; }
module.exports={IGNORES,discover};
