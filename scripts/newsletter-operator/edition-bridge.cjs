// Executed from the edition worktree with its own tsx/Next module resolution.
const path = require("node:path");
const edition = Number(process.argv[2]);
const command = process.argv[3];
if (!Number.isSafeInteger(edition) || edition < 1 || edition > 99 || !["meta", "preview", "audit"].includes(command)) process.exit(2);
const root = process.cwd();
const get = (name) => require(path.join(root, "lib", "newsletter", `edition-${edition}-${name}.ts`));
const prefix = `NEWSLETTER_EDITION_${edition}_`;
const fn = (stem) => `${stem}Edition${edition}`;
const json = (value) => process.stdout.write(JSON.stringify(value) + "\n");

(async () => {
  const campaign = get("campaign");
  const identity = campaign[`newsletterEdition${edition}CampaignIdentity`]();
  const content = get("content");
  const source = get("source.server");
  content[`validateEdition${edition}SourceIntegrity`](await source[`loadNewsletterEdition${edition}Source`]());
  if (command === "meta") {
    const test = get("test-send");
    const render = get("render");
    const url = render[`${prefix}CANONICAL_UNSUBSCRIBE_URL`];
    const header = (await source[`loadNewsletterEdition${edition}Source`]()).assets["eventomotor-header.png"];
    const channels = (await require(require.resolve("sharp", { paths: [root] }))(header).stats()).channels;
    const headerOpaque = channels.length < 4 || channels[3].min === 255;
    const urls = new Set();
    for (const variant of ["national", "madrid"]) {
      const output = render[`renderEdition${edition}Sendable`](variant, url);
      for (const match of output.html.matchAll(/href="(https:\/\/[^"]+)"/g)) {
        const link = match[1].replaceAll("&amp;", "&");
        if (!link.includes("/newsletter/unsubscribe") && link.includes("utm_")) urls.add(link);
      }
    }
    json({
      edition, date: identity.editionKey.replace("agenda_motor_", "").replaceAll("_", "-"),
      campaignKey: identity.editionKey, subject: identity.subject, identity,
      assets: content[`${prefix}ASSET_MANIFEST`], urls: [...urls],
      testRecipient: test[`${prefix}TEST_RECIPIENT`],
      testConfirm: test[`${prefix}TEST_CONFIRM_PHRASE`],
      testArm: test[`${prefix}TEST_ARMED_VALUE`],
      campaignConfirm: campaign[`${prefix}CAMPAIGN_CONFIRM_PHRASE`],
      campaignArm: campaign[`${prefix}CAMPAIGN_ARMED_VALUE`],
      headerOpaque,
    });
  } else if (command === "preview") {
    const server = get("campaign.server");
    const result = await server[`executeNewsletterEdition${edition}Campaign`]({
      request: server[`parseNewsletterEdition${edition}CampaignArguments`]([]),
      environment: server[`newsletterEdition${edition}CampaignEnvironmentFromProcess`](false),
    });
    json({ identity: result.identity, summary: result.summary, status: result.status });
  } else {
    const repository = get("campaign-repository.server")[`createConfiguredNewsletterEdition${edition}CampaignRepository`]();
    if (!repository) throw new Error("supabase_connection_unavailable");
    json(await repository.auditFrozenCampaign(identity));
  }
})().catch(() => { process.stderr.write("edition_bridge_failed_safely\n"); process.exitCode = 1; });
