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

export type NewsletterTokenActionView = {
  eyebrow: string;
  title: string;
  introduction: string;
  support?: string;
  resultTitle?: string;
  resultCopy?: string;
  secondaryAction?: {
    href: string;
    label: string;
  };
  completed: boolean;
};

const PENDING_COPY: Record<
  NewsletterTokenActionKind,
  Pick<NewsletterTokenActionView, "eyebrow" | "title" | "introduction" | "support">
> = {
  confirm: {
    eyebrow: "CONFIRMACIÓN DE SUSCRIPCIÓN",
    title: "Confirma tu suscripción a La Agenda Motor",
    introduction:
      "Sólo falta este paso para empezar a recibir nuestra selección semanal de eventos del motor.",
    support: "Confirma tu dirección para activar tu suscripción.",
  },
  unsubscribe: {
    eyebrow: "BAJA DE LA NEWSLETTER",
    title: "¿Quieres dejar de recibir La Agenda Motor?",
    introduction:
      "Confirma la baja para dejar de recibir nuestras próximas ediciones.",
    support: "Puedes cerrar esta página si prefieres mantener tu suscripción.",
  },
};

const COMPLETE_VIEWS: Partial<
  Record<NewsletterTokenActionState, NewsletterTokenActionView>
> = {
  confirmed: {
    eyebrow: "SUSCRIPCIÓN CONFIRMADA",
    title: "Ya formas parte de La Agenda Motor",
    introduction:
      "Tu suscripción está activa. Recibirás nuestra selección semanal de planes y eventos del motor.",
    resultTitle: "Todo listo",
    resultCopy:
      "Te avisaremos cuando tengamos preparada tu próxima selección.",
    secondaryAction: {
      href: "/#calendario",
      label: "Ver próximos eventos",
    },
    completed: true,
  },
  already_confirmed: {
    eyebrow: "SUSCRIPCIÓN CONFIRMADA",
    title: "Tu suscripción ya estaba confirmada",
    introduction: "No necesitas realizar ninguna otra acción.",
    secondaryAction: {
      href: "/#calendario",
      label: "Ver próximos eventos",
    },
    completed: true,
  },
  unsubscribed: {
    eyebrow: "BAJA COMPLETADA",
    title: "Tu baja se ha completado",
    introduction:
      "Ya no recibirás “La Agenda Motor” en esta dirección.",
    resultTitle: "Baja confirmada",
    resultCopy:
      "Si en el futuro deseas volver, tendrás que realizar una nueva suscripción y confirmar de nuevo tu correo.",
    secondaryAction: {
      href: "/",
      label: "Volver a EventoMotor",
    },
    completed: true,
  },
  already_unsubscribed: {
    eyebrow: "BAJA COMPLETADA",
    title: "Tu baja se ha completado",
    introduction:
      "Ya no recibirás “La Agenda Motor” en esta dirección. No necesitas realizar ninguna otra acción.",
    resultTitle: "La baja ya estaba completada",
    resultCopy:
      "Si en el futuro deseas volver, tendrás que realizar una nueva suscripción y confirmar de nuevo tu correo.",
    secondaryAction: {
      href: "/",
      label: "Volver a EventoMotor",
    },
    completed: true,
  },
};

function unavailableView(
  kind: NewsletterTokenActionKind,
  state: NewsletterTokenActionState,
): NewsletterTokenActionView {
  const invalid = state === "token_invalid" || state === "invalid_or_expired";
  const missing = state === "token_missing";
  const temporary = state === "temporarily_unavailable";

  if (missing) {
    return {
      eyebrow: "ENLACE INCOMPLETO",
      title: "Necesitas abrir el enlace completo",
      introduction:
        "Vuelve al correo original y abre de nuevo su enlace. No se ha realizado ningún cambio.",
      secondaryAction: {
        href: "/",
        label: "Volver a EventoMotor",
      },
      completed: false,
    };
  }

  if (invalid) {
    return {
      eyebrow: "ENLACE NO DISPONIBLE",
      title: "La solicitud ya no está disponible",
      introduction:
        "Es posible que el enlace ya se haya utilizado o no sea válido. Si sigues recibiendo correos, escribe a info@eventomotor.com.",
      secondaryAction: {
        href: "/",
        label: "Volver a EventoMotor",
      },
      completed: false,
    };
  }

  return {
    ...PENDING_COPY[kind],
    resultTitle: temporary
      ? "No podemos completar la acción"
      : "Acción no disponible",
    resultCopy: temporary
      ? "Ha ocurrido un problema temporal. Inténtalo de nuevo más tarde."
      : "Ahora mismo no podemos completar esta acción.",
    completed: false,
  };
}

export function getNewsletterTokenActionView(
  kind: NewsletterTokenActionKind,
  state: NewsletterTokenActionState,
): NewsletterTokenActionView {
  const completed = COMPLETE_VIEWS[state];
  if (completed) return completed;

  if (
    state === "token_missing" ||
    state === "token_invalid" ||
    state === "invalid_or_expired" ||
    state === "unavailable" ||
    state === "temporarily_unavailable"
  ) {
    return unavailableView(kind, state);
  }

  return {
    ...PENDING_COPY[kind],
    completed: false,
  };
}
