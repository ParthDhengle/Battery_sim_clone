import { getPacks } from "@/lib/api/packs"

export async function getPacksFromStorage() {
  if (typeof window === "undefined") return []

  try {
    const packs = await getPacks()
    return packs
      .filter((pack: any) => pack._id || pack.id)
      .map((pack: any) => ({
        value: String(pack._id ?? pack.id),
        label: pack.name,
        specs: {
          config: `${pack.r_s || 0}s${pack.r_p || 0}p`,
          connection: pack.connection_type,
        },
      }))
  } catch (err) {
    console.error("Failed to fetch packs:", err)
    return []
  }
}
