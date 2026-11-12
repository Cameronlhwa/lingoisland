import {createHmac,randomBytes,scrypt as scryptCallback,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "lingo_testing_session";
export const SESSION_SECONDS = 8 * 60 * 60;
export async function passwordMatches(password:string,encoded:string):Promise<boolean> {
  const [salt,hash] = encoded.split(":");
  if(!/^[a-f0-9]{32}$/.test(salt??"")||!/^[a-f0-9]{128}$/.test(hash??""))return false;
  const derived=await scrypt(password,salt,64) as Buffer;
  return timingSafeEqual(derived,Buffer.from(hash,"hex"));
}
export function createTestingSession(secret:string,now=Date.now()):string {
  const payload=Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+SESSION_SECONDS,nonce:randomBytes(16).toString("hex")})).toString("base64url");
  return payload+"."+createHmac("sha256",secret).update(payload).digest("base64url");
}
export function validTestingSession(token:string|undefined,secret:string|undefined,now=Date.now()):boolean {
  if(!token||!secret||secret.length<32||token.length>1000)return false;
  const parts=token.split(".");if(parts.length!==2)return false;
  const expected=createHmac("sha256",secret).update(parts[0]).digest();
  const actual=Buffer.from(parts[1],"base64url");
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
  try{const value=JSON.parse(Buffer.from(parts[0],"base64url").toString());return typeof value.exp==="number"&&value.exp>Math.floor(now/1000)&&value.exp<=Math.floor(now/1000)+SESSION_SECONDS;}catch{return false;}
}
