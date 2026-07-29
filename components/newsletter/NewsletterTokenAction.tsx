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
import styles from "./NewsletterPreview.module.css";

export type NewsletterTokenActionKind = "confirm" | "unsubscribe";

export type NewsletterTokenActionState =
  | "checking"
  | "token_missing"
  | "token_invalid"
  | "ready"
  | "submitting"
  | "confirmed"
  | "already_confirmed"
  | "unsubscribed"
  | "already_unsubscribed"
  | "invalid_or_expired"
  | "unavailable"
  | "temporarily_unavailable";

type NewsletterTokenActionProps = {
  kind: NewsletterTokenActionKind;
};

type ActionCopy = {
  eyebrow: string;
  title: string;
  introduction: string;
  action: string;
  busy: string;
  completeTitle: string;
  completeCopy: string;
  repeatedTitle: string;
  repeatedCopy: string;
};

const ACTION_COPY: Record<NewsletterTokenActionKind, ActionCopy> = {
  confirm: {
    eyebrow: "CONFIRMACIÓN DE SUSCRIPCIÓN",
    title: "Confirma que quieres recibir La Agenda Motor",
    introduction:
      "La suscripción sólo se confirmará cuando pulses el botón. Abrir este enlace no realiza ninguna acción.",
    action: "Confirmar suscripción",
    busy: "Confirmando…",
    completeTitle: "Suscripción confirmada",
    completeCopy: "Ya puedes recibir la selección semanal de planes de motor.",
    repeatedTitle: "La suscripción ya estaba confirmada",
    repeatedCopy: "No necesitas realizar ninguna otra acción.",
  },
  unsubscribe: {
    eyebrow: "BAJA DE LA NEWSLETTER",
    title: "¿Quieres dejar de recibir La Agenda Motor?",
    introduction:
      "La baja sólo se completará cuando pulses el botón. Puedes cerrar esta página sin realizar cambios.",
    action: "Confirmar baja",
    busy: "Procesando baja…",
    completeTitle: "Baja completada",
    completeCopy: "La solicitud se ha procesado. No recibirás nuevas ediciones.",
    repeatedTitle: "La baja ya estaba completada",
    repeatedCopy: "No necesitas realizar ninguna otra acción.",
  },
};

function stateCopy(
  kind: NewsletterTokenActionKind,
  state: NewsletterTokenActionState,
): { title: string; copy: string } | null {
  const copy = ACTION_COPY[kind];
  if (state === "token_missing") {
    return {
      title: "Falta el enlace completo",
      copy: "Abre el enlace recibido originalmente para continuar.",
    };
  }
  if (state === "token_invalid" || state === "invalid_or_expired") {
    return {
      title: "El enlace no es válido o ha caducado",
      copy: "No se ha realizado ningún cambio.",
    };
  }
  if (state === "confirmed" || state === "unsubscribed") {
    return { title: copy.completeTitle, copy: copy.completeCopy };
  }
  if (state === "already_confirmed" || state === "already_unsubscribed") {
    return { title: copy.repeatedTitle, copy: copy.repeatedCopy };
  }
  if (state === "unavailable") {
    return {
      title: "Servicio no disponible",
      copy: "Esta función interna no está habilitada en este entorno.",
    };
  }
  if (state === "temporarily_unavailable") {
    return {
      title: "No podemos completar la acción",
      copy: "Ha ocurrido un problema temporal. Inténtalo de nuevo más tarde.",
    };
  }
  return null;
}

function cleanVisibleTokenUrl() {
  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", cleanUrl);
}

export default function NewsletterTokenAction({ kind }: NewsletterTokenActionProps) {
  const copy = ACTION_COPY[kind];
  const [state, setState] = useState<NewsletterTokenActionState>("checking");
  const tokenRef = useRef<string | null>(null);
  const mutationLock = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const result = stateCopy(kind, state);

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
    if (result) resultRef.current?.focus();
  }, [result]);

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
            <span className={styles.eyebrow}>{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.introduction}</p>

            {state === "checking" ? (
              <div className={styles.tokenStatus} role="status" aria-live="polite">
                Comprobando el enlace…
              </div>
            ) : null}

            {ready || busy ? (
              <div className={styles.tokenAction}>
                <p>
                  {kind === "confirm"
                    ? "Confirma para activar tu suscripción."
                    : "Confirma para retirar tu consentimiento y completar la baja."}
                </p>
                <button
                  className={kind === "unsubscribe" ? styles.secondaryActionButton : styles.primaryButton}
                  disabled={busy}
                  onClick={submitAction}
                  type="button"
                >
                  {busy ? copy.busy : copy.action}
                </button>
              </div>
            ) : null}

            <div
              aria-live="polite"
              className={styles.tokenResult}
              ref={resultRef}
              role="status"
              tabIndex={result ? -1 : undefined}
            >
              {result ? (
                <>
                  <strong>{result.title}</strong>
                  <p>{result.copy}</p>
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

            <div className={styles.tokenFooter}>
              <Link href="/preview/newsletter">Volver a La Agenda Motor</Link>
              <span>El token se mantiene sólo en memoria y se retira de la URL visible.</span>
            </div>
          </div>
          <aside className={styles.internalNotice}>
            <strong>Entorno R4B</strong>
            <span>{NEWSLETTER_R4B_CONTROLLED_STATUS}</span>
          </aside>
        </div>
      </section>
    </main>
  );
}
