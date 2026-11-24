import references from "./references.json";
import type { MapType } from "../mapspec/schema";

/** Curated design notes, selected by the resolved renderer capability. */
export function flatMapReferences(mapType: MapType): string {
  return references
    .filter(({ appliesTo }) => appliesTo.includes("all") || appliesTo.includes(mapType))
    .map(({ id, guidance, example }) => `- [${id}] ${guidance} Example: ${example}`)
    .join("\n");
}
