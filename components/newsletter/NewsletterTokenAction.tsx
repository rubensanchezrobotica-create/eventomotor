"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  confirmNewsletterSubscription,
  runNewsletterMutationOnce,
  unsubscribeNewsletterSubscription,
} from "@/lib/newsletter/http-client";
import {
  isValidNewsletterOpaqueToken,
} from "@/lib/newsletter/schemas";
import { NEWSLETTER_R4B_CONTROLLED_STATUS } from "@/lib/newsletter/r4b-guard";
import {
  getNewsletterTokenActionView,
  type NewsletterTokenActionKind,
  type NewsletterTokenActionState,
} from "./newsletter-token-action-model";
import styles from "./NewsletterPreview.module.css";

type NewsletterTokenActionProps = {
  kind: NewsletterTokenActionKind;
  experience?: "preview" | "production-canary";
};

const ACTION_LABELS: Record<
  NewsletterTokenActionKind,
  { action: string; busy: string }
> = {
  confirm: {
    action: "Confirmar suscripción",
    busy: "Confirmando…",
  },
  unsubscribe: {
    action: "Sí, darme de baja",
    busy: "Procesando baja…",
  },
};

function cleanVisibleTokenUrl() {
  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", cleanUrl);
}

export default function NewsletterTokenAction({
  kind,
  experience = "preview",
}: NewsletterTokenActionProps) {
  const labels = ACTION_LABELS[kind];
  const [state, setState] = useState<NewsletterTokenActionState>("checking");
  const tokenRef = useRef<string | null>(null);
  const mutationLock = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const view = getNewsletterTokenActionView(kind, state);
  const hasResult = Boolean(view.resultTitle);

  useEffect(() => {
    const token = new URL(window.location.href).searchParams.get("token");
    cleanVisibleTokenUrl();

    let nextState: NewsletterTokenActionState;
    if (!token) {
      nextState = "token_missing";
    } else {
      const valid =
        isValidNewsletterOpaqueToken(token);
      if (valid) {
        tokenRef.current = token;
        nextState = "ready";
      } else {
        nextState = "token_invalid";
      }
    }
    const stateTimer = window.setTimeout(() => setState(nextState), 0);
    return () => window.clearTimeout(stateTimer);
  }, [kind]);

  useEffect(() => {
    if (hasResult) resultRef.current?.focus();
  }, [hasResult]);

  async function submitAction() {
    if (!tokenRef.current || mutationLock.current) return;
    setState("submitting");
    const nextState = await runNewsletterMutationOnce(mutationLock, () =>
      kind === "confirm"
        ? confirmNewsletterSubscription(tokenRef.current as string)
        : unsubscribeNewsletterSubscription(tokenRef.current as string),
    );
    if (
      nextState &&
      nextState !== "temporarily_unavailable" &&
      nextState !== "unavailable"
    ) {
      tokenRef.current = null;
    }
    if (nextState) setState(nextState);
  }

  const ready = state === "ready";
  const busy = state === "submitting";

  return (
    <main className={styles.tokenPage}>
      <section className={styles.tokenHero}>
        <div className={`emc-container ${styles.tokenContainer}`}>
          <div className={styles.tokenCard} data-token-action={kind} data-token-state={state}>
            <div className={styles.tokenCardHeading}>
              <span className={styles.eyebrow}>{view.eyebrow}</span>
              <h1>{view.title}</h1>
              <p>{view.introduction}</p>
            </div>

            {state === "checking" ? (
              <div className={styles.tokenStatus} role="status" aria-live="polite">
                Comprobando el enlace…
              </div>
            ) : null}

            {ready || busy ? (
              <div className={styles.tokenAction}>
                <p>{view.support}</p>
                <button
                  className={kind === "unsubscribe" ? styles.secondaryActionButton : styles.primaryButton}
                  disabled={busy}
                  onClick={submitAction}
                  type="button"
                >
                  {busy ? labels.busy : labels.action}
                </button>
                {kind === "unsubscribe" && !busy ? (
                  <Link
                    className={styles.cancelAction}
                    href={
                      experience === "production-canary"
                        ? "/newsletter"
                        : "/preview/newsletter"
                    }
                  >
                    Mantener mi suscripción
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div
              aria-live="polite"
              className={styles.tokenResult}
              ref={resultRef}
              role="status"
              tabIndex={hasResult ? -1 : undefined}
            >
              {hasResult ? (
                <>
                  <span className={styles.tokenResultIcon} aria-hidden="true">
                    {view.completed ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>{view.resultTitle}</strong>
                    <p>{view.resultCopy}</p>
                  </div>
                  {state === "temporarily_unavailable" ? (
                    <button
                      className={styles.textButton}
                      onClick={() => setState("ready")}
                      type="button"
                    >
                      Volver a intentarlo
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>

            {view.secondaryAction ? (
              <Link className={styles.tokenSecondaryLink} href={view.secondaryAction.href}>
                {view.secondaryAction.label}
              </Link>
            ) : null}
          </div>
          {experience === "preview" ? (
            <aside className={styles.internalNotice}>
              <strong>Entorno R4B</strong>
              <span>{NEWSLETTER_R4B_CONTROLLED_STATUS}</span>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
