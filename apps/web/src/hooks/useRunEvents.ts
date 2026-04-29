import { useEffect, useState } from "react";

export function useRunEvents(runId: string | null) {
  const [events, setEvents] = useState<unknown[]>([]);
  useEffect(() => {
    if (!runId) return;
    const source = new EventSource(`/api/events/runs/${runId}`, { withCredentials: true });
    source.onmessage = (event) => setEvents((items) => [...items, JSON.parse(event.data)]);
    return () => source.close();
  }, [runId]);
  return events;
}
