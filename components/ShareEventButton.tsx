"use client";

import { useState } from "react";

type ShareEventButtonProps = {
  directChildren?: boolean;
  title: string;
  url: string;
};

export default function ShareEventButton({ directChildren = false, title, url }: ShareEventButtonProps) {
  const [message, setMessage] = useState("");

  async function shareEvent() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setMessage("Evento compartido");
        return;
      }

      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado");
    } catch {
      setMessage("");
    }
  }

  const action = (
    <>
      <button
        className="emc-btn emc-btn-dark"
        onClick={shareEvent}
        type="button"
      >
        Compartir
      </button>
      {message ? <span className="emc-share-message">{message}</span> : null}
    </>
  );

  if (directChildren) return action;

  return <span className="emc-share-action">{action}</span>;
}
