export type Member = {id:string; name:string; email:string; joined:string};
export type Meal = {id:string; memberId:string; date:string; breakfast:number; lunch:number; dinner:number};
export type Expense = {id:string; date:string; title:string; category:'food'|'rent'|'utilities'; amount:number; paidBy:string; source:'fund'|'personal'; status:'pending'|'approved'|'rejected'; receipt?:string; question?:string; resolution?:string};
export type Deposit = {id:string; memberId:string; date:string; amount:number; note:string};
export type SettlementRow=Member & {meals:number;food:number;shared:number;deposit:number;personal:number;due:number};
export type Ledger = {name:string; members:Member[]; meals:Meal[]; expenses:Expense[]; deposits:Deposit[]; closed:Record<string,{at:string; rows:SettlementRow[]}>; history:{at:string; actor:string; action:string}[]};
export function emptyLedger():Ledger { return {name:'My mess',members:[],meals:[],expenses:[],deposits:[],closed:{},history:[]}; }
export const bdToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function allocate(total:number, weights:number[]) {
 const sum=weights.reduce((a,b)=>a+b,0); if(!sum)return weights.map(()=>0);
 const raw=weights.map(w=>total*w/sum), out=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,r:v-out[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);
 const remainder=total-out.reduce((a,b)=>a+b,0); for(let i=0;i<remainder;i++)out[order[i].i]++;
 return out;
}
export function reconcile(data:Ledger,month:string){
 const members=data.members.filter(m=>m.joined.slice(0,7)<=month);
 const expenses=data.expenses.filter(e=>e.date.startsWith(month)&&e.status==='approved');
 const food=expenses.filter(e=>e.category==='food').reduce((s,e)=>s+e.amount,0);
 const shared=expenses.filter(e=>e.category!=='food').reduce((s,e)=>s+e.amount,0);
 const counts=members.map(m=>data.meals.filter(e=>e.memberId===m.id&&e.date.startsWith(month)).reduce((s,e)=>s+e.breakfast+e.lunch+e.dinner,0));
 const foodShares=allocate(food,counts),sharedShares=allocate(shared,members.map(()=>1));
 const rows=members.map((m,i)=>{ const deposit=data.deposits.filter(d=>d.memberId===m.id&&d.date.startsWith(month)).reduce((s,d)=>s+d.amount,0); const personal=expenses.filter(e=>e.paidBy===m.id&&e.source==='personal').reduce((s,e)=>s+e.amount,0);return {...m,meals:counts[i],food:foodShares[i],shared:sharedShares[i],deposit,personal,due:foodShares[i]+sharedShares[i]-deposit-personal}; });
 const totalMeals=counts.reduce((a,b)=>a+b,0),deposits=rows.reduce((s,r)=>s+r.deposit,0);
 return {rows,food,shared,totalMeals,rate:totalMeals?food/totalMeals:0,deposits,cash:deposits-expenses.filter(e=>e.source==='fund').reduce((s,e)=>s+e.amount,0)};
}
export function demoLedger():Ledger {
 const data=emptyLedger(),month=bdToday().slice(0,7);data.name='Green House Mess';
 data.members=['Khalid Hasan','Arif Rahman','Tanvir Ahmed','Sabbir Hossain','Mehedi Islam','Rafi Chowdhury'].map((name,i)=>({id:`m${i}`,name,email:`member${i+1}@example.com`,joined:`${month}-01`}));
 for(let d=1;d<=Math.min(20,Number(bdToday().slice(-2)));d++)for(let i=0;i<6;i++)data.meals.push({id:`m${i}-${month}-${String(d).padStart(2,'0')}`,memberId:`m${i}`,date:`${month}-${String(d).padStart(2,'0')}`,breakfast:(d+i)%3?1:0,lunch:1,dinner:(d+i)%5?1:0});
 data.expenses=[{id:'e1',title:'Weekly groceries',date:`${month}-03`,category:'food',amount:425000,paidBy:'m0',source:'fund',status:'approved'},{id:'e2',title:'Vegetables & fresh fish',date:`${month}-10`,category:'food',amount:318000,paidBy:'m1',source:'personal',status:'approved'},{id:'e3',title:'Rice, lentils & cooking oil',date:`${month}-15`,category:'food',amount:540000,paidBy:'m2',source:'fund',status:'approved'},{id:'e4',title:'Electricity & internet',date:`${month}-18`,category:'utilities',amount:285000,paidBy:'m0',source:'fund',status:'approved'},{id:'e5',title:'Kitchen supplies',date:`${month}-20`,category:'utilities',amount:68000,paidBy:'m1',source:'personal',status:'pending'}];
 data.deposits=data.members.map(m=>({id:`d${m.id}`,memberId:m.id,date:`${month}-01`,amount:400000,note:'Monthly contribution'}));return data;
}
