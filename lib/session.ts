import { nanoid } from "nanoid";

const KEY = "cartomapper_session_id";

/**
 * A stable anonymous id for this browser. CartoMapper has no login — this is how
 * we associate a person's draft → preview → payment → download without accounts.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = nanoid();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
