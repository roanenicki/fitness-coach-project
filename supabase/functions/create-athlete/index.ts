import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}
Deno.serve(async (req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const auth=req.headers.get('Authorization'); if(!auth)throw new Error('Authentification requise.')
 const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const {data:{user:coach},error:ue}=await caller.auth.getUser(); if(ue||!coach)throw new Error('Session invalide.')
 const {data:cp}=await caller.from('profiles').select('role').eq('id',coach.id).single(); if(cp?.role!=='coach')throw new Error('Accès réservé au coach.')
 const body=await req.json(); const full_name=String(body.full_name||'').trim(), email=String(body.email||'').trim().toLowerCase(), password=String(body.password||'')
 if(!full_name||!email||password.length<8)throw new Error('Nom, email et mot de passe (8 caractères minimum) requis.')
 const admin=createClient(url,service)
 const {data:created,error:ce}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name}}); if(ce)throw ce
 const athlete=created.user!;
 const {error:pe}=await admin.from('profiles').insert({id:athlete.id,full_name,email,role:'athlete'}); if(pe){await admin.auth.admin.deleteUser(athlete.id);throw pe}
 const {error:ae}=await admin.from('coach_athletes').insert({coach_id:coach.id,athlete_id:athlete.id}); if(ae){await admin.from('profiles').delete().eq('id',athlete.id);await admin.auth.admin.deleteUser(athlete.id);throw ae}
 return new Response(JSON.stringify({ok:true,athlete_id:athlete.id}),{headers:{...cors,'Content-Type':'application/json'}})
}catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:400,headers:{...cors,'Content-Type':'application/json'}})}})
