import { readFileSync } from 'node:fs';
// Read only supported settings. Never copy or log credential values.
export function loadProviderSettings(file=process.env.FLYLABS_ENV_FILE) {
  if(!file)return;
  const aliases={'TYPESAFE-AI-API-KEY':'JEV_API_KEY','TYPESAFE_API_KEY':'JEV_API_KEY','JEV_API_KEY':'JEV_API_KEY','GEMINI_API_KEY':'GEMINI_API_KEY','NVIDIA-NIM-API-Key':'NVIDIA_API_KEY','NVIDIA_API_KEY':'NVIDIA_API_KEY'};
  for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
    const match=line.match(/^\s*(?:export\s+)?([\w-]+)\s*=\s*(.*?)\s*$/);
    if(!match||!aliases[match[1]])continue;
    const name=aliases[match[1]],value=match[2].replace(/^(['"])(.*)\1$/,'$2');
    if(!process.env[name]&&value)process.env[name]=value;
  }
}
loadProviderSettings();
export const VERSION='4.0.0';
