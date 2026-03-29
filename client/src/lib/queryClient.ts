import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
  },
});

export async function fetchReport() {
  const res = await fetch("/data/report.json");
  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json() as Promise<{ id: string; title: string; content: string }>;
}
