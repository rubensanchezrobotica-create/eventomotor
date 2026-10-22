// Optional local PostgreSQL-WASM harness. No app dependency or network connection.
// Pass an externally installed PGlite ESM file. Full Supabase/pgTAP/concurrency stays in CI.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { commercialContentHash } = require('../lib/stories/story-commercial.server.ts');
const { commercialFixture } = require('../tests/stories/commercial-fixture.ts');
const { getPublicCollaboration, getPublicStory, listPublicStories } = require('../lib/stories/story-public.server.ts');
const { listHomeStories } = require('../lib/stories/story-home.server.ts');
const { buildStoriesSitemap } = require('../lib/stories/story-public-seo.ts');

const modulePath = process.argv[2];
if (!modulePath) throw new Error('Pass the local PGlite ESM module path; no package is installed automatically.');
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const db = new PGlite(); // Strictly in-memory; never reads a DB URL or environment file.
let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions++; };
const row = async () => (await db.query('select to_jsonb(s) value from public.stories s where id=$1', [id])).rows[0].value;
const reject = async (sql, code) => { await assert.rejects(db.exec(sql), (e) => e.code === code); assertions++; };
const f = commercialFixture(), id = f.story.id, mid = f.story.hero_media_id;
async function withPublicSqlTransport(run) {
  const oldFetch=globalThis.fetch, oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'; process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-ephemeral-only';
  globalThis.fetch=async(input)=>{
    const u=new URL(input instanceof Request?input.url:String(input)); assert.equal(u.origin,'http://127.0.0.1:54321');
    const table=u.pathname.split('/').at(-1);assert.ok(['stories','story_media','story_credits','story_events','editorial_people','events'].includes(table));
    const select=u.searchParams.get('select')??'*'; assert.match(select,/^[a-z_,*]+$/);
    const where=[],parameters=[];
    for(const [field,filter] of u.searchParams){
      if(!filter.startsWith('eq.')&&!filter.startsWith('in.('))continue;assert.match(field,/^[a-z_]+$/);
      parameters.push(filter.startsWith('eq.')?filter.slice(3):filter.slice(4,-1).split(','));
      where.push(filter.startsWith('eq.')?`"${field}"=$${parameters.length}`:`"${field}"::text=any($${parameters.length}::text[])`);
    }
    let sql=`select ${select} from public.${table}`+(where.length?' where '+where.join(' and '):'');
    const limit=u.searchParams.get('limit');if(limit){assert.match(limit,/^\d+$/);sql+=' limit '+limit;}
    try{return new Response(JSON.stringify((await db.query(sql,parameters)).rows),{headers:{'content-type':'application/json'}});}
    catch(e){return new Response(JSON.stringify({code:e.code,message:'Ephemeral SQL projection rejected'}),{status:400,headers:{'content-type':'application/json'}});}
  };
  try{return await run();}finally{globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
}
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage;
    create table public.events(id text primary key, title text not null, start_date date,slug text,venue text,city text,province text,visible boolean default true);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    grant usage on schema storage to service_role;
    grant select on storage.buckets,storage.objects to service_role;`);
  for (const migration of ['20260929120000_stories_foundation.sql','20261005120000_story_media_storage.sql',
    '20261013120000_story_transactional_publication.sql']) {
    await db.exec(await readFile(resolve('database/migrations', migration), 'utf8'));
  }
  const preId='c1000000-0000-4000-8000-000000000003',preMedia='c2000000-0000-4000-8000-000000000004',prePerson='c3000000-0000-4000-8000-000000000002';
  await db.query("insert into public.stories(id,type,collection,title,slug,dek,seo_title,seo_description,content_blocks) values($1,'REPORTAJE','DESDE_DENTRO','Synthetic pre-C1 story','synthetic-pre-c1','Synthetic dek','Synthetic SEO','Synthetic description',$2::jsonb)",[preId,JSON.stringify([{id:'p',type:'PARAGRAPH',content:[{type:'TEXT',text:'Synthetic legacy body'}]}])]);
  await db.query("insert into public.story_media(id,story_id,bucket_id,object_path,width,height,mime_type,byte_size,alt_text,rights_type) values($1,$2,'story-media',$3,1200,800,'image/webp',1000,'Synthetic legacy hero','OWN')",[preMedia,preId,`${preId}/${preMedia}/asset.webp`]);
  await db.query("insert into storage.objects(bucket_id,name) values('story-media',$1)",[`${preId}/${preMedia}/asset.webp`]);
  await db.query("insert into public.editorial_people(id,display_name) values($1,'Synthetic legacy author')",[prePerson]);
  await db.query("insert into public.story_credits(story_id,person_id,role) values($1,$2,'TEXT')",[preId,prePerson]);
  await db.query("update public.stories set status='READY',hero_media_id=$2 where id=$1",[preId,preMedia]);
  const preVersion=(await db.query('select updated_at::text v from public.stories where id=$1',[preId])).rows[0].v;
  await db.query('select public.publish_story($1,$2,$3)',[preId,preVersion,'c4000000-0000-4000-8000-000000000003']);
  check((await db.query("select count(*)::integer n from information_schema.columns where table_schema='public' and table_name='stories' and column_name='commercial_metadata'")).rows[0].n===0,'actual pre-C1 schema has no commercial column');
  await withPublicSqlTransport(async()=>{
    check((await getPublicStory('synthetic-pre-c1'))?.title==='Synthetic pre-C1 story','actual public detail loader runs on pre-C1 PostgreSQL schema');
    const editorial=await listPublicStories();check(editorial.some(s=>s.slug==='synthetic-pre-c1'),'actual public index loader works before C1');
    check((await listHomeStories()).some(s=>s.slug==='synthetic-pre-c1'),'actual Home loader works before C1');
    check(buildStoriesSitemap(editorial).some(s=>s.url.endsWith('/historias/synthetic-pre-c1')),'editorial sitemap projection works before C1');
  });
  await db.exec(await readFile(resolve('database/migrations/20261020120000_commercial_articles.sql'),'utf8'));
  check(true, 'all four unmodified migration files executed');
  await db.query('update public.editorial_people set active=false where id=$1',[prePerson]);
  await db.query('update public.stories set home_rank=1 where id=$1',[preId]);
  check((await db.query('select status from public.stories where id=$1',[preId])).rows[0].status==='PUBLISHED','new publication checks do not rewrite legacy publication or change unrelated Home-rank maintenance');
  await db.query('update public.editorial_people set active=true where id=$1',[prePerson]);
  await db.query(`insert into public.stories(id,type,collection,title,slug,dek,seo_title,seo_description,content_blocks,discipline_slugs)
    values($1,'ARTICULO','COLABORACIONES',$2,$3,$4,$5,$6,$7::jsonb,array['rutas'])`,
    [id,f.story.title,f.story.slug,f.story.dek,f.story.seo_title,f.story.seo_description,JSON.stringify(f.story.content_blocks)]);
  check((await row()).commercial_metadata.advertiserName === '', 'no advertiser guessed');
  await reject(`update public.stories set status='READY' where id='${id}'`, '23514');
  await reject(`update public.stories set collection='DESDE_DENTRO',type='REPORTAJE' where id='${id}'`, '23514');
  await db.query(`insert into public.story_media(id,story_id,bucket_id,object_path,width,height,mime_type,byte_size,alt_text,rights_type)
    values($1,$2,'story-media',$3,1200,800,'image/webp',1000,'Synthetic photograph','LICENSED')`, [mid,id,`${id}/${mid}/asset.webp`]);
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['story-media',`${id}/${mid}/asset.webp`]);
  await db.query('update public.stories set hero_media_id=$2 where id=$1', [id,mid]);
  const person = f.people[0];
  await db.query('insert into public.editorial_people(id,display_name) values($1,$2)', [person.id, person.display_name]);
  await db.query("insert into public.story_credits(story_id,person_id,role) values($1,$2,'TEXT')", [id,person.id]);
  const metadata = { ...f.story.commercial_metadata, advertiserName: 'Synthetic advertiser', advertiserConfirmed: true,
    factsVerified: true, editorialApprovalRef: 'SYNTHETIC_APPROVAL', imageAuthorizationRef: 'SYNTHETIC_IMAGE', commercialLinksChecked: true };
  await db.query('update public.stories set commercial_metadata=$2::jsonb where id=$1', [id,JSON.stringify(metadata)]);
  const current = await row(), hash = commercialContentHash(current);
  const sqlHash = (await db.query('select public.story_commercial_content_hash(s) hash from public.stories s where id=$1',[id])).rows[0].hash;
  check(hash === sqlHash, 'JS and PostgreSQL approval SHA-256 are identical');
  await db.query('update public.stories set commercial_metadata=$2::jsonb where id=$1',[id,JSON.stringify({ ...metadata, approvedContentHash: hash })]);
  await db.exec(`update public.stories set status='READY' where id='${id}'`); check((await row()).status === 'READY', 'approved version reaches READY');
  await reject(`update public.stories set title='unapproved changed text' where id='${id}'`, '23514');
  await reject(`update public.stories set commercial_metadata=commercial_metadata || '{"factsVerified":false}' where id='${id}'`, '23514');
  await reject(`update public.stories set home_rank=1 where id='${id}'`, '23514');
  check((await row()).title === f.story.title, 'failed edits leave text intact');
  async function reapprove() {
    const current = await row();
    const approval = commercialContentHash(current);
    const sql = (await db.query('select public.story_commercial_content_hash(s) hash from public.stories s where id=$1',[id])).rows[0].hash;
    check(approval === sql, 'JS/SQL SHA parity after dependency edit');
    await db.query("update public.stories set commercial_metadata=jsonb_set(commercial_metadata,'{approvedContentHash}',to_jsonb($2::text)), status='READY' where id=$1",[id,approval]);
  }
  for (const [field,value] of [['caption','Revised caption'],['alt_text','Revised ALT'],['credit','Revised credit'],['rights_type','OWN'],['rights_notes','Revised image authorization']]) {
    await db.query(`update public.story_media set ${field}=$2 where id=$1`,[mid,value]);
    const edited = await row();
    check(edited.status === 'DRAFT' && edited.commercial_metadata.approvedContentHash === null, field+' invalidates approval atomically');
    await reject(`update public.stories set status='READY' where id='${id}'`,'23514');
    await reapprove();
  }
  const technicalHash = (await row()).commercial_metadata.approvedContentHash;
  await db.query("update public.story_media set bucket_id='story-media-drafts',object_path=$2,width=1199 where id=$1",[mid,`${id}/${mid}/asset.webp`]);
  check((await row()).status === 'READY' && (await row()).commercial_metadata.approvedContentHash === technicalHash,'technical promotion fields do not invalidate approval');
  await db.query("update public.story_media set bucket_id='story-media',width=1200 where id=$1",[mid]);
  await db.query("insert into public.events(id,title,start_date) values('commercial-synthetic-event','Synthetic event','2030-01-01')");
  await db.query("select public.replace_story_events($1,$2,$3::jsonb)",[id,(await row()).updated_at,JSON.stringify([{event_id:'commercial-synthetic-event',relation_type:'RELATED',sort_order:0}])]);
  check((await row()).status === 'DRAFT' && (await row()).commercial_metadata.approvedContentHash === null,'event replacement invalidates approval'); await reapprove();
  await db.query("select public.replace_story_credits($1,$2,$3::jsonb)",[id,(await row()).updated_at,JSON.stringify([{person_id:person.id,role:'TEXT',sort_order:0},{person_id:person.id,role:'PHOTO',sort_order:1}])]);
  check((await row()).status === 'DRAFT' && (await row()).commercial_metadata.approvedContentHash === null,'credit replacement invalidates approval'); await reapprove();
  await db.query("update public.editorial_people set display_name='Revised synthetic author' where id=$1",[person.id]);
  check((await row()).status === 'DRAFT' && (await row()).commercial_metadata.approvedContentHash === null,'person edit cannot bypass approval invalidation'); await reapprove();
  await db.query("update public.stories set status='DRAFT',commercial_metadata=commercial_metadata || '{\"imageAuthorizationRef\":\"REVISED_AUTHORIZATION\"}'::jsonb where id=$1",[id]);
  check((await row()).commercial_metadata.approvedContentHash === null,'changed image authorization reference clears approval'); await reapprove();
  const secondMedia = 'c2000000-0000-4000-8000-000000000002';
  await db.query("insert into public.story_media(id,story_id,bucket_id,object_path,width,height,mime_type,byte_size,alt_text,rights_type) values($1,$2,'story-media',$3,1200,800,'image/webp',1000,'Synthetic second hero','OWN')",[secondMedia,id,`${id}/${secondMedia}/asset.webp`]);
  await reapprove();
  await reject(`update public.stories set hero_media_id='${secondMedia}' where id='${id}'`,'23514');
  await db.query("update public.stories set status='DRAFT',hero_media_id=$2 where id=$1",[id,secondMedia]);
  check((await row()).commercial_metadata.approvedContentHash === null,'changing hero requires reapproval');
  await db.query('update public.stories set hero_media_id=$2 where id=$1',[id,mid]); await reapprove();
  const beforeMissingAuthor = await row();
  await db.query("select public.replace_story_credits($1,$2,'[]'::jsonb)",[id,beforeMissingAuthor.updated_at]);
  check((await row()).status === 'DRAFT','removing author cannot remain READY');
  await reject(`update public.stories set commercial_metadata=jsonb_set(commercial_metadata,'{approvedContentHash}',to_jsonb(public.story_commercial_content_hash(stories))),status='READY' where id='${id}'`,'23514');
  await db.query("select public.replace_story_credits($1,$2,$3::jsonb)",[id,(await row()).updated_at,JSON.stringify([{person_id:person.id,role:'TEXT',sort_order:0}])]); await reapprove();
  for(let edit=0;edit<5;edit++){
    const blocks=structuredClone((await row()).content_blocks), commercialLink=structuredClone(blocks[0].content[1]), internalLink=structuredClone(blocks[0].content[3]);
    blocks[0].content[0].text=`Synthetic persisted edit ${edit} `;
    await db.query("update public.stories set status='DRAFT',content_blocks=$2::jsonb where id=$1",[id,JSON.stringify(blocks)]);
    const persisted=(await row()).content_blocks[0];
    assert.deepEqual(persisted.content[1],commercialLink);assert.deepEqual(persisted.content[3],internalLink);
    check((await row()).commercial_metadata.approvedContentHash===null,'repeated persisted LINK edit requires approval and preserves both links');
    await reapprove();
  }
  const version = (await row()).updated_at, requestId = 'c4000000-0000-4000-8000-000000000001';
  await db.exec('set role service_role');
  await reject(`update public.stories set status='PUBLISHED',published_at=clock_timestamp() where id='${id}'`, '42501');
  await reject(`select public.publish_story('${id}','2020-01-01','${requestId}')`, '40001');
  await db.query('select public.publish_story($1,$2,$3)',[id,version,requestId]);
  const published = await row(); check(published.status === 'PUBLISHED', 'existing A16D RPC publishes the approved synthetic article');
  await db.query('select public.publish_story($1,$2,$3)',[id,version,requestId]);
  check((await row()).published_at === published.published_at, 'idempotent retry preserves publication time');
  check(Number((await db.query('select count(*) count from public.story_publication_receipts where story_id=$1',[id])).rows[0].count) === 1, 'one receipt only');
  await reject(`update public.stories set title='changed published content' where id='${id}'`, '55000');
  await reject(`update public.story_media set caption='changed published caption' where id='${mid}'`, '55000');
  await reject(`update public.editorial_people set display_name='changed published author' where id='${person.id}'`, '55000');
  await db.exec('reset role');
  // Independent READY is intentionally allowed as a negative backend fixture;
  // the final transactional RPC must reject missing TEXT and roll its receipt back.
  const independentId='c1000000-0000-4000-8000-000000000002', independentMedia='c2000000-0000-4000-8000-000000000003';
  await db.query("insert into public.stories(id,type,collection,title,slug,dek,seo_title,seo_description,content_blocks) values($1,'REPORTAJE','DESDE_DENTRO','Synthetic independent','synthetic-independent','Synthetic dek','Synthetic SEO','Synthetic description',$2::jsonb)",[independentId,JSON.stringify([{id:'p',type:'PARAGRAPH',content:[{type:'TEXT',text:'Synthetic independent body'}]}])]);
  await db.query("insert into public.story_media(id,story_id,bucket_id,object_path,width,height,mime_type,byte_size,alt_text,rights_type) values($1,$2,'story-media',$3,1200,800,'image/webp',1000,'Synthetic editorial hero','OWN')",[independentMedia,independentId,`${independentId}/${independentMedia}/asset.webp`]);
  await db.query("insert into storage.objects(bucket_id,name) values('story-media',$1)",[`${independentId}/${independentMedia}/asset.webp`]);
  await db.query("update public.stories set hero_media_id=$2,status='READY' where id=$1",[independentId,independentMedia]);
  let independentVersion=(await db.query('select updated_at::text updated_at from public.stories where id=$1',[independentId])).rows[0].updated_at;
  const independentRequest='c4000000-0000-4000-8000-000000000002';
  await db.exec('set role service_role');
  await assert.rejects(db.query('select public.publish_story($1,$2,$3)',[independentId,independentVersion,independentRequest]),e=>e.code==='23514'); assertions++;
  check(Number((await db.query('select count(*) count from public.story_publication_receipts where story_id=$1',[independentId])).rows[0].count)===0,'missing TEXT never leaves a positive receipt');
  await assert.rejects(db.query('select public.replace_story_credits($1,$2,$3::jsonb)',[independentId,independentVersion,JSON.stringify([{person_id:'c3000000-0000-4000-8000-000000000099',role:'TEXT',sort_order:0}])]),e=>e.code==='23514'); assertions++;
  await db.query('select public.replace_story_credits($1,$2,$3::jsonb)',[independentId,independentVersion,JSON.stringify([{person_id:person.id,role:'TEXT',sort_order:0}])]);
  independentVersion=(await db.query('select updated_at::text updated_at from public.stories where id=$1',[independentId])).rows[0].updated_at;
  await db.query('select public.publish_story($1,$2,$3)',[independentId,independentVersion,independentRequest]);
  check((await db.query('select status from public.stories where id=$1',[independentId])).rows[0].status==='PUBLISHED','independent publication still works with complete attribution');
  await db.exec('reset role');
  // Real public loader, backed by actual ephemeral SQL rows. No production
  // URL/config is read; the transport accepts only this synthetic loopback host.
  await withPublicSqlTransport(async()=>{
    const publicArticle=await getPublicCollaboration(f.story.slug);
    check(publicArticle?.sponsor?.name==='Synthetic advertiser','published commercial article resolves through actual public loader');
    check((await getPublicStory(f.story.slug))?.collection==='COLABORACIONES' && (await listPublicStories()).filter(s=>s.slug===f.story.slug).length===1,'commercial article has one public Historias entry');
    check(Boolean(await getPublicStory('synthetic-pre-c1')),'preexisting independent story still resolves after C1');
  });
  for (const role of ['anon','authenticated']) {
    const r = await db.query(`select has_table_privilege($1,'public.stories','select') permitted`,[role]);
    check(r.rows[0].permitted === false, `${role} has no editorial table read`);
  }
  check(!(await db.query("select has_table_privilege('service_role','public.stories','truncate') permitted")).rows[0].permitted,'TRUNCATE remains denied');
  console.log(JSON.stringify({ status: 'PASS', engine: 'PostgreSQL in-memory WASM (PGlite)', assertions,
    postgres: (await db.query('select version() v')).rows[0].v, networkConnections: 0, productionWrites: 0,
    limitations: 'Minimal synthetic Storage catalog; full Supabase pgTAP and two-connection concurrency require the existing CI.' },null,2));
} finally { await db.close(); }
