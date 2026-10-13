import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const exec = promisify(execFile);
const container = "supabase_db_eventomotor-stories-ci";
const { stdout } = await exec("docker", ["ps", "--filter", "name=^/" + container + "$", "--format", "{{.Names}}"], { timeout: 10000, windowsHide: true });
assert.equal(stdout.trim(), container, "only the isolated Stories CI container is allowed");
// No DSN, dotenv, production project ref, HTTP or secret is accepted.
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
let serial = 0;

class Connection {
  constructor() {
    this.name = "stories-a16d-" + (++serial);
    this.buffer = "";
    this.stderr = "";
    this.pending = null;
    this.closed = false;
    this.child = spawn("docker", ["exec", "-i", container, "psql", "-X", "--no-psqlrc", "-qAt",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (data) => {
      this.buffer += data;
      if (this.pending && this.buffer.includes(this.pending.marker + "\n")) {
        const pending = this.pending;
        const index = this.buffer.indexOf(pending.marker + "\n");
        const output = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + pending.marker.length + 1);
        this.pending = null;
        clearTimeout(pending.timer);
        pending.resolve(output);
      }
    });
    this.child.stderr.on("data", (data) => { this.stderr += data; });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("close", (code) => {
      this.closed = true;
      if (this.pending) this.fail(new Error("Ephemeral psql exit " + code + ": " + this.stderr));
    });
    this.child.stdin.on("error", (error) => this.fail(error));
  }
  fail(error) {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }
  query(sql) {
    assert.ok(!this.pending && !this.closed, "connection must be idle and open");
    const marker = "A16D_DONE_" + (++serial);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.child.kill(); this.fail(new Error("Ephemeral query timed out")); }, 12000);
      this.pending = { marker, resolve, reject, timer };
      this.child.stdin.write(sql + "\nselect " + quote(marker) + ";\n");
    });
  }
  async init() {
    await this.query("\\set VERBOSITY verbose\nset statement_timeout='8s'; set lock_timeout='6s'; set application_name=" + quote(this.name) + ";");
    return this;
  }
  close() { this.child.stdin.end("\\q\n"); }
}

async function connection() { return new Connection().init(); }
async function waitUntilBlocked(holder, waiter) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const value = await holder.query("select exists(select 1 from pg_catalog.pg_stat_activity where application_name=" +
      quote(waiter.name) + " and pg_catalog.pg_backend_pid() = any(pg_catalog.pg_blocking_pids(pid)));");
    if (value === "t") return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.fail("second PostgreSQL connection did not demonstrably wait on the first");
}

async function fixture(db) {
  const id = randomUUID(), media = randomUUID(), person = randomUUID(), request = randomUUID();
  const event = "story-concurrency-" + id;
  const path = id + "/" + media + "/asset.webp";
  await db.query("insert into public.stories(id,type,collection,title,slug,dek,seo_title,seo_description,content_blocks) values (" +
    quote(id) + ",'REPORTAJE','DESDE_DENTRO','Synthetic concurrency','synthetic-" + id + "','Synthetic dek','Synthetic SEO','Synthetic description'," +
    quote(JSON.stringify([{ id: "p-1", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Synthetic concurrency body." }] },
      { id: "e-1", type: "EVENT_REFERENCE", eventId: event }])) + "::jsonb);" +
    "insert into public.story_media(id,story_id,bucket_id,object_path,width,height,mime_type,byte_size,alt_text,rights_type) values (" +
    quote(media) + "," + quote(id) + ",'story-media'," + quote(path) + ",1200,800,'image/webp',1000,'Synthetic alt','OWN');" +
    "insert into storage.objects(bucket_id,name) values ('story-media'," + quote(path) + ");" +
    "insert into public.editorial_people(id,display_name) values (" + quote(person) + ",'Synthetic concurrency editor');" +
    "insert into public.events(id,slug,title,start_date) values (" + quote(event) + "," + quote(event) + ",'Synthetic concurrency event','2030-01-01');" +
    "insert into public.story_credits(story_id,person_id,role,sort_order) values (" + quote(id) + "," + quote(person) + ",'TEXT',0),(" + quote(id) + "," + quote(person) + ",'PHOTO',1);" +
    "insert into public.story_events(story_id,event_id,relation_type) values (" + quote(id) + "," + quote(event) + ",'PRIMARY');" +
    "update public.stories set status='READY',hero_media_id=" + quote(media) + " where id=" + quote(id) + ";");
  const version = await db.query("select updated_at::text from public.stories where id=" + quote(id) + ";");
  return {
    id, media, person, event, version, request,
    publish: "select (public.publish_story(" + quote(id) + "," + quote(version) + "," + quote(request) + ")).status;",
    credits: "select (public.replace_story_credits(" + quote(id) + "," + quote(version) + "," +
      quote(JSON.stringify([{ person_id: person, role: "TEXT", sort_order: 0 }])) + "::jsonb)).id;",
    events: "select (public.replace_story_events(" + quote(id) + "," + quote(version) + "," +
      quote(JSON.stringify([{ event_id: event, relation_type: "RELATED", sort_order: 0 }])) + "::jsonb)).id;",
  };
}

let passed = 0;
async function scenario(name, run) {
  const a = await connection(), b = await connection();
  try {
    const f = await fixture(a);
    await run(a, b, f);
    console.log("PASS " + name);
    passed++;
  } finally { a.close(); b.close(); }
}

for (const kind of ["credits", "events", "media"]) {
  await scenario(kind + " first: publication waits then rejects stale version", async (a, b, f) => {
    await a.query("begin; set local role service_role;" +
      (kind === "media" ? "update public.story_media set caption='Synthetic concurrent change' where id=" + quote(f.media) + ";" : f[kind]));
    const outcome = b.query("set role service_role; " + f.publish).then(() => "unexpected-success", (e) => e.message);
    await waitUntilBlocked(a, b);
    await a.query("commit;");
    assert.match(await outcome, /40001/);
    assert.equal(await a.query("select status from public.stories where id=" + quote(f.id) + ";"), "READY");
    assert.equal(await a.query("select count(*) from public.story_publication_receipts where story_id=" + quote(f.id) + ";"), "0");
  });
}
for (const kind of ["credits", "events"]) {
  await scenario("publication first: " + kind + " wait and cannot edit after commit", async (a, b, f) => {
    await a.query("begin; set local role service_role; " + f.publish);
    const outcome = b.query("set role service_role; " + f[kind]).then(() => "unexpected-success", (e) => e.message);
    await waitUntilBlocked(a, b);
    await a.query("commit;");
    assert.match(await outcome, /55000/);
    assert.equal(await a.query("select count(*) from public.story_credits where story_id=" + quote(f.id) + ";"), "2");
    assert.equal(await a.query("select relation_type from public.story_events where story_id=" + quote(f.id) + ";"), "PRIMARY");
  });
}
await scenario("publication first: direct media lock inversion fails NOWAIT without deadlock", async (a, b, f) => {
  await a.query("begin; set local role service_role; " + f.publish);
  const start = Date.now();
  await assert.rejects(b.query("set role service_role; update public.story_media set rights_type='UNKNOWN' where id=" + quote(f.media) + ";"), /55P03/);
  assert.ok(Date.now() - start < 4000, "media writer must not wait for parent or deadlock");
  await a.query("commit;");
  assert.equal(await a.query("select rights_type from public.story_media where id=" + quote(f.media) + ";"), "OWN");
});
await scenario("two publishers with identical request get one immutable receipt/timestamp", async (a, b, f) => {
  await a.query("begin; set local role service_role; " + f.publish);
  const before = await a.query("select updated_at::text || '|' || published_at::text from public.stories where id=" + quote(f.id) + ";");
  const outcome = b.query("set role service_role; " + f.publish);
  await waitUntilBlocked(a, b);
  await a.query("commit;");
  assert.equal(await outcome, "PUBLISHED");
  assert.equal(await a.query("select count(*) from public.story_publication_receipts where story_id=" + quote(f.id) + ";"), "1");
  assert.equal(await a.query("select updated_at::text || '|' || published_at::text from public.stories where id=" + quote(f.id) + ";"), before);
});
await scenario("two different publication requests conflict instead of republishing", async (a, b, f) => {
  await a.query("begin; set local role service_role; " + f.publish);
  const sql = f.publish.replace(f.request, randomUUID());
  const outcome = b.query("set role service_role; " + sql).then(() => "unexpected-success", (e) => e.message);
  await waitUntilBlocked(a, b);
  await a.query("commit;");
  assert.match(await outcome, /40001/);
});
await scenario("credit transaction rollback restores old version and whole relation set", async (a, b, f) => {
  await a.query("begin; set local role service_role; " + f.credits);
  const outcome = b.query("set role service_role; " + f.publish);
  await waitUntilBlocked(a, b);
  await a.query("rollback;");
  assert.equal(await outcome, "PUBLISHED");
  assert.equal(await a.query("select count(*) from public.story_credits where story_id=" + quote(f.id) + ";"), "2");
});
await scenario("two competing replacements cannot both consume the same version", async (a, b, f) => {
  await a.query("begin; set local role service_role; " + f.credits);
  const outcome = b.query("set role service_role; " + f.events).then(() => "unexpected-success", (e) => e.message);
  await waitUntilBlocked(a, b);
  await a.query("commit;");
  assert.match(await outcome, /40001/);
  assert.equal(await a.query("select relation_type from public.story_events where story_id=" + quote(f.id) + ";"), "PRIMARY");
});
await scenario("late credit constraint failure rolls back preceding DELETE and version", async (a, b, f) => {
  const before = await a.query("select updated_at::text from public.stories where id=" + quote(f.id) + ";");
  await a.query("create function public.a16d_test_credit_failure() returns trigger language plpgsql as " +
    quote("begin if new.story_id=" + quote(f.id) + "::uuid then raise exception 'synthetic insert failure'; end if; return new; end;") +
    "; create trigger a16d_test_credit_failure before insert on public.story_credits for each row execute function public.a16d_test_credit_failure();");
  try {
    await assert.rejects(b.query("set role service_role; " + f.credits), /synthetic insert failure/);
    assert.equal(await a.query("select count(*) from public.story_credits where story_id=" + quote(f.id) + ";"), "2");
    assert.equal(await a.query("select updated_at::text from public.stories where id=" + quote(f.id) + ";"), before);
  } finally {
    await a.query("drop trigger a16d_test_credit_failure on public.story_credits; drop function public.a16d_test_credit_failure();");
  }
});
console.log("STORY_POSTGRES_CONCURRENCY_SCENARIOS=" + passed + "/" + passed);
