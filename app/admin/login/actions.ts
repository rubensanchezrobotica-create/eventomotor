"use server";

import { redirect } from "next/navigation";
import {
  assertTrustedAdminMutation,
  clearAdminSession,
  createAdminSession,
  safeAdminNext,
  verifyConfiguredAdminCredential,
} from "@/lib/admin-session.server";

export async function loginAdminAction(formData: FormData) {
  await assertTrustedAdminMutation();
  const credential = String(formData.get("credential") ?? "");
  const next = safeAdminNext(String(formData.get("next") ?? ""));
  if (!verifyConfiguredAdminCredential(credential)) {
    redirect(`/admin/login?error=invalid&next=${encodeURIComponent(next)}`);
  }
  await createAdminSession();
  redirect(next);
}

export async function logoutAdminAction() {
  await assertTrustedAdminMutation();
  await clearAdminSession();
  redirect("/admin/login?loggedOut=1");
}
