import assert from "node:assert/strict";
import test from "node:test";
import {
  getSavedEvents,
  removeSavedEvent,
  SAVED_EVENTS_STORAGE_KEY,
  saveEvent,
  type SavedEvent,
} from "@/lib/saved-events";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const firstEvent: SavedEvent = {
  slug: "primero",
  title: "Primer evento",
  start: "2026-08-10",
  end: "2026-08-10",
  city: "Madrid",
  province: "Madrid",
  venue: "Recinto",
  discipline: "Rallyes",
};

test("guardar y quitar conserva todos los eventos salvo el seleccionado", () => {
  const storage = new MemoryStorage();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });

  try {
    const secondEvent = { ...firstEvent, slug: "segundo", title: "Segundo evento", start: "2026-08-12" };
    const thirdEvent = { ...firstEvent, slug: "tercero", title: "Tercer evento", start: "2026-08-14" };

    saveEvent(firstEvent);
    saveEvent(secondEvent);
    saveEvent(thirdEvent);

    assert.deepEqual(getSavedEvents().map(({ slug }) => slug), ["primero", "segundo", "tercero"]);
    assert.deepEqual(removeSavedEvent("segundo").map(({ slug }) => slug), ["primero", "tercero"]);
    assert.deepEqual(
      JSON.parse(storage.getItem(SAVED_EVENTS_STORAGE_KEY) || "[]").map((event: SavedEvent) => event.slug),
      ["primero", "tercero"],
    );
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
