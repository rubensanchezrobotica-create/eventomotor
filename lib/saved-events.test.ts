import assert from "node:assert/strict";
import test from "node:test";
import {
  getSavedEvents,
  isEventSaved,
  removeSavedEvent,
  SAVED_EVENTS_STORAGE_KEY,
  saveEvent,
  type SavedEvent,
  VALL_SANT_PERE_SAVED_ALIAS,
  VALL_SANT_PERE_SAVED_CANONICAL,
} from "@/lib/saved-events";

class MemoryStorage {
  private values = new Map<string, string>();
  private setErrorName: string | null = null;
  setCalls = 0;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.setCalls += 1;
    if (this.setErrorName) {
      const error = new Error(`${this.setErrorName} de prueba`);
      error.name = this.setErrorName;
      throw error;
    }
    this.values.set(key, value);
  }

  seedItem(key: string, value: string) {
    this.values.set(key, value);
  }

  throwOnSet(errorName: string | null) {
    this.setErrorName = errorName;
  }
}

function withStorage(run: (storage: MemoryStorage) => void) {
  const storage = new MemoryStorage();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });

  try {
    run(storage);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
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

const vallAliasEvent: SavedEvent = {
  ...firstEvent,
  slug: VALL_SANT_PERE_SAVED_ALIAS,
  title: "Rally Vall de Sant Pere 2026",
  start: "2026-09-25",
  end: "2026-09-26",
  city: "Sant Pere",
  province: "Baleares",
};

const vallCanonicalEvent: SavedEvent = {
  ...vallAliasEvent,
  slug: VALL_SANT_PERE_SAVED_CANONICAL,
  city: "Esporles",
  province: "Illes Balears",
};

test("guardar y quitar conserva todos los eventos salvo el seleccionado", () => {
  withStorage((storage) => {
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
  });
});

test("un único guardado antiguo de Vall normaliza solo su slug sin deducir metadatos", () => {
  withStorage((storage) => {
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify([vallAliasEvent]));

    const [migrated] = getSavedEvents();

    assert.equal(migrated.slug, VALL_SANT_PERE_SAVED_CANONICAL);
    assert.equal(migrated.city, "Sant Pere");
    assert.equal(migrated.province, "Baleares");
    assert.equal(storage.setCalls, 1);
    assert.equal(isEventSaved(VALL_SANT_PERE_SAVED_ALIAS), true);
    assert.equal(isEventSaved(VALL_SANT_PERE_SAVED_CANONICAL), true);
  });
});

test("si existen ambos slugs los datos canónicos ganan en los dos órdenes", () => {
  for (const saved of [
    [vallAliasEvent, vallCanonicalEvent],
    [vallCanonicalEvent, vallAliasEvent],
  ]) {
    withStorage((storage) => {
      storage.seedItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify(saved));

      const migrated = getSavedEvents();

      assert.equal(migrated.length, 1);
      assert.equal(migrated[0].slug, VALL_SANT_PERE_SAVED_CANONICAL);
      assert.equal(migrated[0].city, "Esporles");
      assert.equal(migrated[0].province, "Illes Balears");
    });
  }
});

test("una segunda lectura de datos ya normalizados no vuelve a escribir", () => {
  withStorage((storage) => {
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify([vallAliasEvent]));

    const firstRead = getSavedEvents();
    assert.equal(storage.setCalls, 1);
    const persistedAfterMigration = storage.getItem(SAVED_EVENTS_STORAGE_KEY);

    assert.deepEqual(getSavedEvents(), firstRead);
    assert.equal(storage.setCalls, 1);
    assert.equal(storage.getItem(SAVED_EVENTS_STORAGE_KEY), persistedAfterMigration);
  });
});

for (const errorName of ["QuotaExceededError", "SecurityError"]) {
  test(`la lectura devuelve Vall normalizado si setItem lanza ${errorName}`, () => {
    withStorage((storage) => {
      const original = JSON.stringify([vallAliasEvent]);
      storage.seedItem(SAVED_EVENTS_STORAGE_KEY, original);
      storage.throwOnSet(errorName);

      const migrated = getSavedEvents();

      assert.equal(migrated.length, 1);
      assert.equal(migrated[0].slug, VALL_SANT_PERE_SAVED_CANONICAL);
      assert.equal(migrated[0].city, "Sant Pere");
      assert.equal(storage.getItem(SAVED_EVENTS_STORAGE_KEY), original);
      assert.equal(storage.setCalls, 1);
    });
  });
}

test("saveEvent con el alias no degrada un guardado canónico existente", () => {
  withStorage((storage) => {
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify([vallCanonicalEvent]));

    const saved = saveEvent(vallAliasEvent);

    assert.equal(saved.length, 1);
    assert.equal(saved[0].slug, VALL_SANT_PERE_SAVED_CANONICAL);
    assert.equal(saved[0].city, "Esporles");
    assert.equal(saved[0].province, "Illes Balears");
    assert.deepEqual(JSON.parse(storage.getItem(SAVED_EVENTS_STORAGE_KEY) || "[]"), saved);
  });
});

test("saveEvent con el slug canónico actualiza normalmente la tarjeta", () => {
  withStorage((storage) => {
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify([vallCanonicalEvent]));
    const updated = { ...vallCanonicalEvent, venue: "Nuevo recinto", source_url: "https://example.test/actualizado" };

    const saved = saveEvent(updated);

    assert.equal(saved.length, 1);
    assert.equal(saved[0].venue, "Nuevo recinto");
    assert.equal(saved[0].source_url, "https://example.test/actualizado");
  });
});

test("se puede borrar la tarjeta de Vall por el alias o por el slug canónico", () => {
  for (const slug of [VALL_SANT_PERE_SAVED_ALIAS, VALL_SANT_PERE_SAVED_CANONICAL]) {
    withStorage((storage) => {
      storage.seedItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify([vallCanonicalEvent, firstEvent]));

      assert.deepEqual(removeSavedEvent(slug).map((event) => event.slug), ["primero"]);
      assert.equal(isEventSaved(VALL_SANT_PERE_SAVED_ALIAS), false);
      assert.equal(isEventSaved(VALL_SANT_PERE_SAVED_CANONICAL), false);
    });
  }
});

test("la migración de Vall no reescribe RPM, otros guardados ni preferencias", () => {
  withStorage((storage) => {
    const rpmAlias = { ...firstEvent, slug: "rpm-fest-night-demons-2026-2026-08-15", title: "RPM Fest" };
    const unrelated = { ...firstEvent, slug: "otro-evento", title: "Otro evento" };
    const original = JSON.stringify([rpmAlias, unrelated]);
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, original);
    storage.seedItem("eventomotor:display-preference", "mapa");

    const saved = getSavedEvents();

    assert.deepEqual(saved.map((event) => event.slug), [
      "rpm-fest-night-demons-2026-2026-08-15",
      "otro-evento",
    ]);
    assert.equal(storage.getItem(SAVED_EVENTS_STORAGE_KEY), original);
    assert.equal(storage.getItem("eventomotor:display-preference"), "mapa");
    assert.equal(storage.setCalls, 0);
  });
});

test("una lectura sin Vall conserva entradas ajenas que comparten slug", () => {
  withStorage((storage) => {
    const duplicateA = { ...firstEvent, slug: "evento-ajeno-repetido", title: "Copia A" };
    const duplicateB = { ...firstEvent, slug: "evento-ajeno-repetido", title: "Copia B" };
    const original = JSON.stringify([duplicateA, duplicateB]);
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, original);

    const saved = getSavedEvents();

    assert.deepEqual(saved.map((event) => event.title), ["Copia A", "Copia B"]);
    assert.equal(storage.setCalls, 0);
    assert.equal(storage.getItem(SAVED_EVENTS_STORAGE_KEY), original);
  });
});

test("una lectura sin Vall conserva duplicados del alias antiguo de RPM", () => {
  withStorage((storage) => {
    const rpmSlug = "rpm-fest-night-demons-2026-2026-08-15";
    const duplicateA = { ...firstEvent, slug: rpmSlug, title: "RPM — copia A", start: "2026-08-15" };
    const duplicateB = { ...firstEvent, slug: rpmSlug, title: "RPM — copia B", start: "2026-08-15" };
    const original = JSON.stringify([duplicateA, duplicateB]);
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, original);

    const saved = getSavedEvents();

    assert.deepEqual(saved.map((event) => event.title), ["RPM — copia A", "RPM — copia B"]);
    assert.deepEqual(saved.map((event) => event.slug), [rpmSlug, rpmSlug]);
    assert.equal(storage.setCalls, 0);
    assert.equal(storage.getItem(SAVED_EVENTS_STORAGE_KEY), original);
  });
});

test("la migración de Vall preserva todas las entradas ajenas repetidas y es idempotente", () => {
  withStorage((storage) => {
    const duplicateA = {
      ...firstEvent,
      slug: "evento-ajeno-repetido",
      title: "Ajeno A",
      start: "2026-10-10",
      city: "Ciudad A",
    };
    const duplicateB = {
      ...firstEvent,
      slug: "evento-ajeno-repetido",
      title: "Ajeno B",
      start: "2026-10-10",
      city: "Ciudad B",
    };
    storage.seedItem(
      SAVED_EVENTS_STORAGE_KEY,
      JSON.stringify([duplicateA, vallAliasEvent, vallCanonicalEvent, duplicateB]),
    );
    storage.seedItem("eventomotor:display-preference", "mapa");

    const migrated = getSavedEvents();

    assert.equal(migrated.length, 3);
    assert.equal(migrated[0].slug, VALL_SANT_PERE_SAVED_CANONICAL);
    assert.equal(migrated[0].city, "Esporles");
    assert.deepEqual(
      migrated.filter((event) => event.slug === "evento-ajeno-repetido").map((event) => [event.title, event.city]),
      [["Ajeno A", "Ciudad A"], ["Ajeno B", "Ciudad B"]],
    );
    assert.equal(storage.getItem("eventomotor:display-preference"), "mapa");
    assert.equal(storage.setCalls, 1);

    assert.deepEqual(getSavedEvents(), migrated);
    assert.equal(storage.setCalls, 1);
    assert.equal(storage.getItem("eventomotor:display-preference"), "mapa");
  });
});

test("las escrituras explícitas siguen propagando fallos de almacenamiento", () => {
  withStorage((storage) => {
    storage.seedItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify([vallCanonicalEvent]));
    storage.throwOnSet("QuotaExceededError");

    assert.throws(() => saveEvent(vallAliasEvent), { name: "QuotaExceededError" });
    assert.throws(() => removeSavedEvent(VALL_SANT_PERE_SAVED_CANONICAL), { name: "QuotaExceededError" });
    assert.equal(storage.getItem(SAVED_EVENTS_STORAGE_KEY), JSON.stringify([vallCanonicalEvent]));
  });
});
