const os=require('node:os'),path=require('node:path'); const {BaseAgentAdapter}=require('../lib/base-adapter.cjs');
function encodeWorkspaceKey(targetPath){return path.resolve(targetPath).replace(/^([a-zA-Z]):/,(_,d)=>`${d.toUpperCase()}-`).replace(/^\\\\/,'UNC--').replace(/[^a-zA-Z0-9]/g,'-');}
class ClaudeCodeAdapter extends BaseAgentAdapter { constructor(){super('claude-code')} target(workspace){return path.join(os.homedir(),'.claude','projects',encodeWorkspaceKey(workspace),'memory','MEMORY.md')} }
module.exports=ClaudeCodeAdapter; module.exports.encodeWorkspaceKey=encodeWorkspaceKey;
