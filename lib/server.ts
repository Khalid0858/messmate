import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {emptyLedger,type Ledger} from './ledger';
export class AppError extends Error {constructor(message:string,public status=400){super(message)}}
export function db(){if(!env.DB)throw new AppError('Database is unavailable. Please try again shortly.',503);return env.DB;}
export function bucket(){if(!env.BUCKET)throw new AppError('Receipt storage is unavailable. Please try again shortly.',503);return env.BUCKET;}
export async function context(){
 const user=await getChatGPTUser();if(!user)throw new AppError('Please sign in.',401);
 // Stable user ID owns a mess; emails are explicit manager invitations only.
 let row=await db().prepare('SELECT * FROM households WHERE owner = ?').bind(user.userId).first<{id:string;owner:string;data:string;version:number}>();
 if(!row)row=await db().prepare("SELECT h.* FROM households h WHERE EXISTS (SELECT 1 FROM json_each(h.data, '$.members') m WHERE lower(json_extract(m.value, '$.email')) = ?) ORDER BY h.id LIMIT 1").bind(user.email.toLowerCase()).first();
 if(!row){await db().prepare('INSERT OR IGNORE INTO households (id,owner,data,version) VALUES (?,?,?,0)').bind(crypto.randomUUID(),user.userId,JSON.stringify(emptyLedger())).run();row=await db().prepare('SELECT * FROM households WHERE owner = ?').bind(user.userId).first();}
 if(!row)throw new AppError('Could not create your workspace. Please retry.',503);
 const data=JSON.parse(row.data) as Ledger, manager=row.owner===user.userId,member=data.members.find(m=>m.email.toLowerCase()===user.email.toLowerCase());
 return {user,row,data,manager,member};
}
export function sameOrigin(request:Request){const origin=request.headers.get('Origin');if(origin!==new URL(request.url).origin)throw new AppError('This request must come from MessMate.',403);}
export function respondError(e:unknown){if(e instanceof AppError)return Response.json({error:e.message},{status:e.status});console.error('MessMate request failed',e);return Response.json({error:'Could not complete the request. Your changes were not saved. Please retry.'},{status:503});}
