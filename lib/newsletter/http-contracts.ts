export type RequestNewsletterResponse = {
  ok: true;
  status: "accepted";
};

export type ConfirmNewsletterResponse = {
  ok: true;
  status: "confirmed" | "already_confirmed" | "invalid_or_expired";
};

export type UnsubscribeNewsletterResponse = {
  ok: true;
  status: "unsubscribed" | "already_unsubscribed" | "invalid_or_expired";
};

export type PublicNewsletterErrorResponse = {
  ok: false;
  error:
    | "not_found"
    | "invalid_request"
    | "payload_too_large"
    | "unsupported_media_type"
    | "temporarily_unavailable"
    | "rate_limited";
};
