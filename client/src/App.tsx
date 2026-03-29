import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import Reader from "./pages/Reader";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Reader />
    </QueryClientProvider>
  );
}
