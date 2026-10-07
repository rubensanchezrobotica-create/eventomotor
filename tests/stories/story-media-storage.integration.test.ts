import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createSupabaseStoryMediaService } from "@/lib/stories/story-media.server";
import { updateStoryMediaMetadata } from "@/lib/stories/story-admin.server";
import {
  STORY_MEDIA_DRAFT_BUCKET,
  STORY_MEDIA_PUBLIC_BUCKET,
} from "@/lib/stories/story-media-validation";
import type { Database } from "@/lib/supabase";

const enabled = process.env.STORIES_STORAGE_INTEGRATION === "1";

function requiredLocalEnvironment(name: string, aliases: readonly string[] = []) {
  for (const candidate of [name, ...aliases]) {
    const value = process.env[candidate]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing isolated Stories integration environment: ${name}.`);
}

test(
  "ephemeral Storage supports signed upload, finalize, preview, promotion, sanitation and readiness",
  { skip: !enabled },
  async (t) => {
    const url = requiredLocalEnvironment("NEXT_PUBLIC_SUPABASE_URL", ["API_URL", "SUPABASE_URL"]);
    const serviceRoleKey = requiredLocalEnvironment("SUPABASE_SERVICE_ROLE_KEY", [
      "SERVICE_ROLE_KEY",
    ]);
    const anonKey = requiredLocalEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY", ["ANON_KEY"]);
    const parsedUrl = new URL(url);
    assert.ok(
      parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost",
      "integration test refuses non-loopback Supabase",
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
    const serviceClient = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonClient = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const service = createSupabaseStoryMediaService(serviceClient);
    const storyId = randomUUID();
    const operationId = randomUUID();
    const createdObjects: Array<{ bucketId: string; objectPath: string }> = [];

    t.after(async () => {
      await serviceClient.from("stories").update({ status: "DRAFT" }).eq("id", storyId);
      await serviceClient.from("stories").delete().eq("id", storyId);
      for (const item of createdObjects) {
        await serviceClient.storage.from(item.bucketId).remove([item.objectPath]);
      }
    });

    const { error: storyError } = await serviceClient.from("stories").insert({
      id: storyId,
      type: "CRONICA",
      collection: "DESDE_DENTRO",
    });
    assert.equal(storyError, null);

    const original = new Uint8Array(
      await sharp({
        create: {
          width: 4_000,
          height: 2_000,
          channels: 3,
          background: { r: 20, g: 100, b: 180 },
        },
      })
        .jpeg({ progressive: false })
        .withMetadata({
          orientation: 6,
          exif: { IFD0: { Artist: "Private photographer" } },
        })
        .withXmp("<x:xmpmeta><GPSLatitude>40.0</GPSLatitude></x:xmpmeta>")
        .toBuffer(),
    );
    const intent = await service.createUploadIntent({
      storyId,
      operationId,
      mimeType: "image/jpeg",
      byteSize: original.byteLength,
    });
    assert.equal(intent.mediaId, operationId);
    assert.equal(intent.bucketId, STORY_MEDIA_DRAFT_BUCKET);

    const beforeFinalize = await serviceClient
      .from("story_media")
      .select("id")
      .eq("id", intent.mediaId)
      .maybeSingle();
    assert.equal(beforeFinalize.error, null);
    assert.equal(beforeFinalize.data, null, "upload intent must not create story_media");

    assert.ok(intent.signedToken);
    const upload = await serviceClient.storage
      .from(STORY_MEDIA_DRAFT_BUCKET)
      .uploadToSignedUrl(intent.objectPath, intent.signedToken, original, {
        contentType: "image/jpeg",
      });
    assert.equal(upload.error, null);
    createdObjects.push({ bucketId: STORY_MEDIA_DRAFT_BUCKET, objectPath: intent.objectPath });

    const finalized = await service.finalizeUpload({
      storyId,
      mediaId: intent.mediaId,
      mimeType: "image/jpeg",
      byteSize: original.byteLength,
    });
    assert.equal(finalized.created, true);
    const finalizeRetry = await service.finalizeUpload({
      storyId,
      mediaId: intent.mediaId,
      mimeType: "image/jpeg",
      byteSize: original.byteLength,
    });
    assert.equal(finalizeRetry.created, false);

    const preview = await service.createPreviewUrl({
      storyId,
      mediaId: intent.mediaId,
    });
    const previewResponse = await fetch(preview.signedUrl);
    assert.equal(previewResponse.ok, true);

    const privatePublicUrl = anonClient.storage
      .from(STORY_MEDIA_DRAFT_BUCKET)
      .getPublicUrl(intent.objectPath).data.publicUrl;
    const privateResponse = await fetch(privatePublicUrl);
    assert.equal(privateResponse.ok, false, "private original must not be publicly readable");

    const editorial = await updateStoryMediaMetadata({
      storyId,
      mediaId: intent.mediaId,
      expectedUpdatedAt: finalized.media.updated_at,
      altText: "Vehículo de competición en pista",
      caption: "",
      credit: "EventoMotor",
      rightsType: "OWN",
      rightsNotes: "Fixture sintético efímero",
    });

    const { error: readyError } = await serviceClient
      .from("stories")
      .update({
        slug: `integration-${storyId}`,
        status: "READY",
        title: "Historia de integración",
        dek: "Entradilla de integración",
        content_blocks: [
          {
            id: "paragraph-1",
            type: "PARAGRAPH",
            content: [{ type: "TEXT", text: "Contenido editorial de integración." }],
          },
        ],
        hero_media_id: intent.mediaId,
        seo_title: "Historia de integración",
        seo_description: "Descripción SEO de integración para validar Storage.",
      })
      .eq("id", storyId);
    assert.equal(readyError, null);

    const beforePromotion = await service.publicationReadiness(storyId);
    assert.equal(beforePromotion.ready, false);
    assert.deepEqual(beforePromotion.storageIssues, [
      { code: "MEDIA_NOT_PUBLIC", mediaId: intent.mediaId },
    ]);

    const promotion = await service.promote({
      storyId,
      mediaId: intent.mediaId,
      expectedUpdatedAt: editorial.updated_at,
      requirePublicationMetadata: true,
    });
    assert.equal(promotion.promoted, true);
    createdObjects.push({ bucketId: STORY_MEDIA_PUBLIC_BUCKET, objectPath: intent.objectPath });
    const promotionRetry = await service.promote({ storyId, mediaId: intent.mediaId });
    assert.equal(promotionRetry.promoted, false);

    const readServiceObjectEntry = async (bucketId: string, objectPath: string) => {
      const separator = objectPath.lastIndexOf("/");
      assert.notEqual(separator, -1, "Storage object paths must include a directory");
      const directory = objectPath.slice(0, separator);
      const objectName = objectPath.slice(separator + 1);
      const result = await serviceClient.storage
        .from(bucketId)
        .list(directory, { limit: 100, search: objectName });
      assert.equal(result.error, null, `service role must list ${bucketId}`);
      return result.data?.find((item) => item.name === objectName) ?? null;
    };

    const readServiceObjectState = async (bucketId: string, objectPath: string) => {
      const [download, entry] = await Promise.all([
        serviceClient.storage.from(bucketId).download(objectPath),
        readServiceObjectEntry(bucketId, objectPath),
      ]);
      assert.equal(download.error, null, `service role must download from ${bucketId}`);
      assert.ok(download.data, `service role must receive object bytes from ${bucketId}`);
      assert.ok(entry, `service role must find the object metadata in ${bucketId}`);
      return {
        bytes: new Uint8Array(await download.data.arrayBuffer()),
        metadata: entry,
      };
    };

    const intentSeparator = intent.objectPath.lastIndexOf("/");
    assert.notEqual(intentSeparator, -1);
    const intentDirectory = intent.objectPath.slice(0, intentSeparator);
    const intentObjectName = intent.objectPath.slice(intentSeparator + 1);
    for (const bucketId of [STORY_MEDIA_DRAFT_BUCKET, STORY_MEDIA_PUBLIC_BUCKET]) {
      const anonymousList = await anonClient.storage
        .from(bucketId)
        .list(intentDirectory, { limit: 100, search: intentObjectName });
      assert.equal(
        anonymousList.data?.some((item) => item.name === intentObjectName) ?? false,
        false,
        `anonymous callers must not enumerate known objects in ${bucketId}`,
      );
    }

    const anonymousBytes = new Uint8Array(await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } },
    }).jpeg().toBuffer());
    for (const bucketId of [STORY_MEDIA_DRAFT_BUCKET, STORY_MEDIA_PUBLIC_BUCKET]) {
      const beforeMutation = await readServiceObjectState(bucketId, intent.objectPath);
      const unauthorizedPath = `${storyId}/${randomUUID()}/asset.jpg`;
      await anonClient.storage
        .from(bucketId)
        .upload(unauthorizedPath, anonymousBytes, {
          contentType: "image/jpeg",
          upsert: false,
        });
      assert.equal(
        await readServiceObjectEntry(bucketId, unauthorizedPath),
        null,
        `anonymous upload must not create an object in ${bucketId}`,
      );

      await anonClient.storage
        .from(bucketId)
        .update(intent.objectPath, anonymousBytes, { contentType: "image/jpeg" });
      const afterUpdate = await readServiceObjectState(bucketId, intent.objectPath);
      assert.deepEqual(
        afterUpdate,
        beforeMutation,
        `anonymous update must not change object bytes or metadata in ${bucketId}`,
      );

      await anonClient.storage.from(bucketId).remove([intent.objectPath]);
      const afterDelete = await readServiceObjectState(bucketId, intent.objectPath);
      assert.deepEqual(
        afterDelete,
        beforeMutation,
        `anonymous delete must leave the object intact in ${bucketId}`,
      );
    }

    const publicResponse = await fetch(promotion.publicUrl);
    assert.equal(publicResponse.ok, true);
    const publicBytes = new Uint8Array(await publicResponse.arrayBuffer());
    const publicMetadata = await sharp(publicBytes).metadata();
    assert.equal(Math.max(publicMetadata.width ?? 0, publicMetadata.height ?? 0), 3_200);
    assert.equal(publicMetadata.orientation, undefined);
    assert.equal(publicMetadata.exif, undefined);
    assert.equal(publicMetadata.xmp, undefined);

    const originalAfterPromotion = await serviceClient.storage
      .from(STORY_MEDIA_DRAFT_BUCKET)
      .download(intent.objectPath);
    assert.equal(originalAfterPromotion.error, null);
    assert.equal(
      (await originalAfterPromotion.data!.arrayBuffer()).byteLength,
      original.byteLength,
      "private original must be preserved",
    );

    const afterPromotion = await service.publicationReadiness(storyId);
    assert.equal(afterPromotion.ready, true);
    assert.deepEqual(afterPromotion.publicationErrors, []);
    assert.deepEqual(afterPromotion.storageIssues, []);
  },
);
