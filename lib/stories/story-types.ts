export const STORY_SCHEMA_VERSION = 1 as const;

export const STORY_STATUSES = ["DRAFT", "READY", "PUBLISHED", "ARCHIVED"] as const;
export const STORY_TYPES = ["CRONICA", "REPORTAJE", "HISTORIA", "ENTREVISTA"] as const;
export const STORY_COLLECTIONS = [
  "DESDE_DENTRO",
  "HISTORIAS_DE_MOTOR",
  "CONVERSACIONES",
] as const;
export const STORY_RIGHTS_TYPES = [
  "OWN",
  "EVENTOMOTOR_COLLABORATOR",
  "PRESS_PROVIDED",
  "LICENSED",
  "PUBLIC_DOMAIN",
  "UNKNOWN",
] as const;
export const STORY_CREDIT_ROLES = ["TEXT", "PHOTO", "VIDEO", "CONTRIBUTOR"] as const;
export const STORY_EVENT_RELATION_TYPES = ["PRIMARY", "RELATED"] as const;
export const STORY_BLOCK_TYPES = [
  "PARAGRAPH",
  "HEADING",
  "IMAGE",
  "IMAGE_PAIR",
  "GALLERY",
  "PULL_QUOTE",
  "EVENT_REFERENCE",
] as const;
export const STORY_INLINE_NODE_TYPES = ["TEXT", "LINK"] as const;
export const STORY_INLINE_MARKS = ["bold", "italic"] as const;

export type StorySchemaVersion = typeof STORY_SCHEMA_VERSION;
export type StoryStatus = (typeof STORY_STATUSES)[number];
export type StoryType = (typeof STORY_TYPES)[number];
export type StoryCollection = (typeof STORY_COLLECTIONS)[number];
export type StoryRightsType = (typeof STORY_RIGHTS_TYPES)[number];
export type StoryCreditRole = (typeof STORY_CREDIT_ROLES)[number];
export type StoryEventRelationType = (typeof STORY_EVENT_RELATION_TYPES)[number];
export type StoryBlockType = (typeof STORY_BLOCK_TYPES)[number];
export type StoryInlineNodeType = (typeof STORY_INLINE_NODE_TYPES)[number];
export type StoryInlineMark = (typeof STORY_INLINE_MARKS)[number];

export const STORY_LIMITS = {
  id: 200,
  slug: 180,
  title: 240,
  dek: 1_000,
  contextLocation: 240,
  seoTitle: 240,
  seoDescription: 600,
  taxonomyValues: 32,
  taxonomyValue: 120,
  blocks: 200,
  blockId: 120,
  inlineNodes: 500,
  inlineText: 20_000,
  paragraphText: 20_000,
  storyBodyText: 250_000,
  totalInlineNodes: 10_000,
  heading: 300,
  quote: 2_000,
  quoteAttribution: 300,
  href: 2_048,
  galleryMin: 2,
  galleryMax: 30,
  credits: 100,
  eventRelations: 100,
} as const;

export type StoryInlineText = {
  type: "TEXT";
  text: string;
  marks?: readonly StoryInlineMark[];
};

export type StoryInlineLink = {
  type: "LINK";
  href: string;
  children: readonly StoryInlineText[];
};

export type StoryInlineNode = StoryInlineText | StoryInlineLink;

type StoryBlockBase<TType extends StoryBlockType> = {
  id: string;
  type: TType;
};

export type StoryParagraphBlock = StoryBlockBase<"PARAGRAPH"> & {
  content: readonly StoryInlineNode[];
};

export type StoryHeadingBlock = StoryBlockBase<"HEADING"> & {
  level: 2 | 3;
  text: string;
};

export type StoryImageBlock = StoryBlockBase<"IMAGE"> & {
  mediaId: string;
};

export type StoryImagePairBlock = StoryBlockBase<"IMAGE_PAIR"> & {
  mediaIds: readonly [string, string];
};

export type StoryGalleryBlock = StoryBlockBase<"GALLERY"> & {
  mediaIds: readonly string[];
};

export type StoryPullQuoteBlock = StoryBlockBase<"PULL_QUOTE"> & {
  text: string;
  attribution?: string;
};

export type StoryEventReferenceBlock = StoryBlockBase<"EVENT_REFERENCE"> & {
  eventId: string;
};

export type StoryContentBlock =
  | StoryParagraphBlock
  | StoryHeadingBlock
  | StoryImageBlock
  | StoryImagePairBlock
  | StoryGalleryBlock
  | StoryPullQuoteBlock
  | StoryEventReferenceBlock;

export type StoryDocument = {
  schemaVersion: StorySchemaVersion;
  contentBlocks: readonly StoryContentBlock[];
};

export type StoryRecord = StoryDocument & {
  id: string;
  slug: string;
  status: StoryStatus;
  type: StoryType;
  collection: StoryCollection;
  title: string;
  dek: string;
  contextLocation?: string | null;
  heroMediaId: string;
  seoTitle: string;
  seoDescription: string;
  disciplineSlugs: readonly string[];
  territoryIds: readonly string[];
  publishedAt?: string | null;
  updatedAt: string;
  homeRank?: number | null;
};

export type StoryCredit = {
  personId: string;
  role: StoryCreditRole;
  sortOrder: number;
};

export type StoryEventRelation = {
  eventId: string;
  relationType: StoryEventRelationType;
  sortOrder: number;
};

export type StoryMediaValidationRecord = {
  id: string;
  altText: string;
  rightsType: StoryRightsType;
};

export type StoryPublicationContext = {
  media: readonly StoryMediaValidationRecord[];
};

export type StoryValidationErrorCode =
  | "EXPECTED_OBJECT"
  | "EXPECTED_ARRAY"
  | "EXPECTED_STRING"
  | "EXPECTED_INTEGER"
  | "UNKNOWN_FIELD"
  | "UNKNOWN_ENUM_VALUE"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "LIMIT_EXCEEDED"
  | "REQUIRED_VALUE"
  | "DUPLICATE_VALUE"
  | "DUPLICATE_BLOCK_ID"
  | "UNSAFE_LINK"
  | "EMPTY_PARAGRAPH"
  | "INVALID_HEADING_LEVEL"
  | "INVALID_IMAGE_PAIR"
  | "INVALID_GALLERY_SIZE"
  | "INVALID_DATE"
  | "INVALID_HOME_RANK"
  | "SLUG_REQUIRED"
  | "SLUG_INVALID"
  | "STATUS_NOT_READY"
  | "TITLE_REQUIRED"
  | "DEK_REQUIRED"
  | "HERO_REQUIRED"
  | "CONTENT_REQUIRED"
  | "SEO_TITLE_REQUIRED"
  | "SEO_DESCRIPTION_REQUIRED"
  | "MEDIA_CONTEXT_INVALID"
  | "HERO_MEDIA_NOT_FOUND"
  | "HERO_ALT_REQUIRED"
  | "HERO_RIGHTS_UNKNOWN"
  | "MEDIA_NOT_FOUND"
  | "MEDIA_ALT_REQUIRED"
  | "MEDIA_RIGHTS_UNKNOWN";

export type StoryValidationError = {
  code: StoryValidationErrorCode;
  field: string;
  message: string;
  blockId?: string;
};

export type StoryValidationResult<T> =
  | { ok: true; value: T; errors: readonly [] }
  | { ok: false; errors: readonly StoryValidationError[] };

export type StoryPublicationGateResult = {
  ok: boolean;
  errors: readonly StoryValidationError[];
};
