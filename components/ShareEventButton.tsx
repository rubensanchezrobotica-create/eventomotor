"use client";

import { useState } from "react";

type ShareEventButtonProps = {
  title: string;
  url: string;
};

export default function ShareEventButton({ title, url }: ShareEventButtonProps) {
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

  return (
    <span className="emc-share-action">
      <button
        className="emc-btn emc-btn-dark"
        onClick={shareEvent}
        type="button"
      >
        Compartir
      </button>
      {message ? <span className="emc-share-message">{message}</span> : null}
    </span>
  );
}
