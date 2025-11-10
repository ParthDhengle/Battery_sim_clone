export async function getDriveCyclesFromStorage() {
  if (typeof window === "undefined") return []
  try {
    if (window.storage && typeof window.storage.list === "function") {
      const result = await window.storage.list("drivecycle:")
      const keys = result?.keys ?? []
      const items = await Promise.all(
        keys.map(async (key: string) => {
          const dc = await window.storage.get(key)
          return dc ? JSON.parse(dc.value) : null
        })
      )
      const cycles = items.filter(Boolean)
      return cycles.map((cycle: any) => ({
        value: String(cycle.id ?? cycle.name ?? ""),
        label: cycle.name ?? `Drive Cycle ${cycle.id ?? ''}`,
        specs: {
          duration: cycle.duration ?? cycle.totalDuration ?? "",
          avgSpeed: cycle.avgSpeed ?? "",
        },
      }))
    }
    return []
  } catch (error) {
    console.error("Failed to fetch drive cycles:", error)
    return []
  }
}