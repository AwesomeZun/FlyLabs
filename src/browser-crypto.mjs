import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
export const randomUUID=()=>globalThis.crypto.randomUUID();
export function createHash(algorithm){
 if(algorithm!=='sha256')throw new Error('Unsupported digest');
 const h=sha256.create();
 const wrapper={update(value){h.update(typeof value==='string'?new TextEncoder().encode(value):value);return wrapper;},digest(format){if(format!=='hex')throw new Error('Unsupported digest encoding');return bytesToHex(h.digest());}};
 return wrapper;
}
