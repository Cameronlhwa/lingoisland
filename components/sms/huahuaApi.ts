import type { SmsPhoneErrorBody } from "@/lib/sms/phoneState";
import type { HuahuaOverviewResponse, HuahuaPreferencesPatch } from "@/lib/sms/huahua/publicTypes";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(path: string, method: "GET" | "PATCH" | "DELETE", body?: unknown): Promise<Result<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as T | SmsPhoneErrorBody | null;
    if (!response.ok || !data || (typeof data === "object" && "code" in (data as object))) {
      const message = (data as SmsPhoneErrorBody | null)?.error;
      return { ok: false, error: message || "Something went wrong. Please try again." };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}

export const huahuaApi = {
  load: () => request<HuahuaOverviewResponse>("/api/sms/huahua", "GET"),
  update: (patch: HuahuaPreferencesPatch) => request<HuahuaOverviewResponse>("/api/sms/huahua", "PATCH", patch),
  deleteHistory: (includeWords: boolean) =>
    request<HuahuaOverviewResponse>("/api/sms/huahua/history", "DELETE", { includeWords }),
};
