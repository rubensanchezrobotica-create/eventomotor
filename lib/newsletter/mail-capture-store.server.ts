import "server-only";

import { link, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { NewsletterEmailKind } from "@/emails/newsletter/email-types";

const CAPTURE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METADATA_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/;

export const NEWSLETTER_MAIL_CAPTURE_DIRECTORY = ".tmp/newsletter-mail-capture";

export type NewsletterMailCaptureLimits = {
  maxRecords: number;
  maxRecipientCharacters: number;
  maxSubjectCharacters: number;
  maxHtmlBytes: number;
  maxTextBytes: number;
  maxMetadataEntries: number;
  maxMetadataValueCharacters: number;
  retentionMs: number;
};

export const DEFAULT_NEWSLETTER_MAIL_CAPTURE_LIMITS: NewsletterMailCaptureLimits = Object.freeze({
  maxRecords: 100,
  maxRecipientCharacters: 320,
  maxSubjectCharacters: 200,
  maxHtmlBytes: 512 * 1024,
  maxTextBytes: 128 * 1024,
  maxMetadataEntries: 8,
  maxMetadataValueCharacters: 200,
  retentionMs: 7 * 24 * 60 * 60 * 1000,
});

export type NewsletterMailCapture = {
  schemaVersion: 1;
  id: string;
  mailType: NewsletterEmailKind;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  capturedAt: string;
  status: "captured";
  metadata: Readonly<Record<string, string>>;
};

export type NewsletterMailCaptureSummary = Pick<
  NewsletterMailCapture,
  "id" | "mailType" | "subject" | "capturedAt" | "status"
> & {
  maskedRecipient: string;
};

export interface NewsletterMailCaptureStore {
  save(capture: NewsletterMailCapture): Promise<void>;
  list(): Promise<NewsletterMailCaptureSummary[]>;
  get(id: string): Promise<NewsletterMailCapture | null>;
}

export type NewsletterMailCaptureStoreErrorCode =
  | "unsafe_root"
  | "invalid_capture"
  | "capture_too_large"
  | "record_limit"
  | "storage_failure";

export class NewsletterMailCaptureStoreError extends Error {
  readonly code: NewsletterMailCaptureStoreErrorCode;

  constructor(code: NewsletterMailCaptureStoreErrorCode) {
    super(`Newsletter mail capture store failed: ${code}.`);
    this.name = "NewsletterMailCaptureStoreError";
    this.code = code;
  }
}

type FileStoreDependencies = {
  now?: () => Date;
  linkFile?: typeof link;
};

type FileNewsletterMailCaptureStoreOptions = {
  workspaceRoot?: string;
  rootDirectory?: string;
  limits?: Partial<NewsletterMailCaptureLimits>;
  dependencies?: FileStoreDependencies;
};

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function isValidDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function validateLimits(limits: NewsletterMailCaptureLimits): void {
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new NewsletterMailCaptureStoreError("invalid_capture");
    }
  }
}

function validateCapture(
  capture: NewsletterMailCapture,
  limits: NewsletterMailCaptureLimits,
): void {
  if (
    capture.schemaVersion !== 1 ||
    !CAPTURE_ID_PATTERN.test(capture.id) ||
    !["confirmation", "welcome", "weekly"].includes(capture.mailType) ||
    capture.status !== "captured" ||
    !isValidDate(capture.capturedAt) ||
    !capture.recipientEmail ||
    capture.recipientEmail.length > limits.maxRecipientCharacters ||
    !capture.subject ||
    capture.subject.length > limits.maxSubjectCharacters ||
    typeof capture.html !== "string" ||
    typeof capture.text !== "string" ||
    !capture.html ||
    !capture.text
  ) {
    throw new NewsletterMailCaptureStoreError("invalid_capture");
  }

  if (
    utf8Bytes(capture.html) > limits.maxHtmlBytes ||
    utf8Bytes(capture.text) > limits.maxTextBytes
  ) {
    throw new NewsletterMailCaptureStoreError("capture_too_large");
  }

  const metadataEntries = Object.entries(capture.metadata);
  if (
    metadataEntries.length > limits.maxMetadataEntries ||
    metadataEntries.some(
      ([key, value]) =>
        !METADATA_KEY_PATTERN.test(key) ||
        typeof value !== "string" ||
        value.length > limits.maxMetadataValueCharacters ||
        /(?:secret|credential|authorization|serviceRole|jwt|token|hash)/i.test(key),
    )
  ) {
    throw new NewsletterMailCaptureStoreError("invalid_capture");
  }
}

function parseCapture(
  raw: string,
  limits: NewsletterMailCaptureLimits,
): NewsletterMailCapture {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new NewsletterMailCaptureStoreError("storage_failure");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NewsletterMailCaptureStoreError("storage_failure");
  }
  const capture = value as NewsletterMailCapture;
  validateCapture(capture, limits);
  return capture;
}

export function maskNewsletterRecipient(recipientEmail: string): string {
  const separator = recipientEmail.lastIndexOf("@");
  if (separator <= 0 || separator === recipientEmail.length - 1) return "***";
  const local = recipientEmail.slice(0, separator);
  const domain = recipientEmail.slice(separator + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function toSummary(capture: NewsletterMailCapture): NewsletterMailCaptureSummary {
  return {
    id: capture.id,
    mailType: capture.mailType,
    subject: capture.subject,
    capturedAt: capture.capturedAt,
    status: capture.status,
    maskedRecipient: maskNewsletterRecipient(capture.recipientEmail),
  };
}

export class FileNewsletterMailCaptureStore implements NewsletterMailCaptureStore {
  readonly rootDirectory: string;
  readonly limits: NewsletterMailCaptureLimits;
  private readonly now: () => Date;
  private readonly linkFile: typeof link;

  constructor(options: FileNewsletterMailCaptureStoreOptions = {}) {
    const workspaceRoot = resolve(
      /* turbopackIgnore: true */ options.workspaceRoot ?? process.cwd(),
    );
    const allowedRoot = resolve(
      /* turbopackIgnore: true */ workspaceRoot,
      NEWSLETTER_MAIL_CAPTURE_DIRECTORY,
    );
    const requestedRoot = resolve(
      /* turbopackIgnore: true */ options.rootDirectory ?? allowedRoot,
    );
    if (requestedRoot !== allowedRoot) {
      throw new NewsletterMailCaptureStoreError("unsafe_root");
    }

    this.rootDirectory = requestedRoot;
    this.limits = {
      ...DEFAULT_NEWSLETTER_MAIL_CAPTURE_LIMITS,
      ...options.limits,
    };
    validateLimits(this.limits);
    this.now = options.dependencies?.now ?? (() => new Date());
    this.linkFile = options.dependencies?.linkFile ?? link;
  }

  private capturePath(id: string): string {
    if (!CAPTURE_ID_PATTERN.test(id)) {
      throw new NewsletterMailCaptureStoreError("invalid_capture");
    }
    return join(this.rootDirectory, `${id}.json`);
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    } catch {
      throw new NewsletterMailCaptureStoreError("storage_failure");
    }
  }

  private async captureFiles(): Promise<string[]> {
    await this.ensureDirectory();
    try {
      const entries = await readdir(this.rootDirectory, { withFileTypes: true });
      return entries
        .filter(
          (entry) =>
            entry.isFile() &&
            CAPTURE_ID_PATTERN.test(entry.name.replace(/\.json$/i, "")) &&
            entry.name.toLowerCase().endsWith(".json"),
        )
        .map((entry) => entry.name);
    } catch {
      throw new NewsletterMailCaptureStoreError("storage_failure");
    }
  }

  private async readCaptureFile(filename: string): Promise<NewsletterMailCapture> {
    const path = join(this.rootDirectory, filename);
    try {
      const file = await stat(path);
      const maximumSerializedBytes =
        this.limits.maxHtmlBytes + this.limits.maxTextBytes + 16 * 1024;
      if (!file.isFile() || file.size > maximumSerializedBytes) {
        throw new NewsletterMailCaptureStoreError("storage_failure");
      }
      return parseCapture(await readFile(path, "utf8"), this.limits);
    } catch (error) {
      if (error instanceof NewsletterMailCaptureStoreError) throw error;
      throw new NewsletterMailCaptureStoreError("storage_failure");
    }
  }

  private async retainedCaptures(): Promise<NewsletterMailCapture[]> {
    const files = await this.captureFiles();
    const cutoff = this.now().getTime() - this.limits.retentionMs;
    const captures: NewsletterMailCapture[] = [];

    for (const filename of files) {
      const capture = await this.readCaptureFile(filename);
      if (Date.parse(capture.capturedAt) < cutoff) {
        try {
          await unlink(join(this.rootDirectory, filename));
        } catch {
          throw new NewsletterMailCaptureStoreError("storage_failure");
        }
      } else {
        captures.push(capture);
      }
    }

    return captures.sort(
      (left, right) =>
        Date.parse(left.capturedAt) - Date.parse(right.capturedAt) ||
        left.id.localeCompare(right.id),
    );
  }

  async save(capture: NewsletterMailCapture): Promise<void> {
    validateCapture(capture, this.limits);
    const existing = await this.retainedCaptures();
    if (existing.length >= this.limits.maxRecords) {
      throw new NewsletterMailCaptureStoreError("record_limit");
    }

    const finalPath = this.capturePath(capture.id);
    const temporaryPath = join(this.rootDirectory, `.${capture.id}.tmp`);
    const serialized = `${JSON.stringify(capture)}\n`;

    try {
      await writeFile(temporaryPath, serialized, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await this.linkFile(temporaryPath, finalPath);
      await unlink(temporaryPath);
    } catch {
      try {
        await unlink(temporaryPath);
      } catch {
        // The temporary file may not exist; never remove any other path.
      }
      throw new NewsletterMailCaptureStoreError("storage_failure");
    }
  }

  async list(): Promise<NewsletterMailCaptureSummary[]> {
    return (await this.retainedCaptures()).map(toSummary);
  }

  async get(id: string): Promise<NewsletterMailCapture | null> {
    if (!CAPTURE_ID_PATTERN.test(id)) return null;
    await this.ensureDirectory();
    try {
      const capture = await this.readCaptureFile(`${id}.json`);
      const cutoff = this.now().getTime() - this.limits.retentionMs;
      if (Date.parse(capture.capturedAt) < cutoff) return null;
      return capture;
    } catch (error) {
      if (
        error instanceof NewsletterMailCaptureStoreError &&
        error.code === "storage_failure"
      ) {
        try {
          await stat(this.capturePath(id));
        } catch {
          return null;
        }
      }
      throw error;
    }
  }
}
