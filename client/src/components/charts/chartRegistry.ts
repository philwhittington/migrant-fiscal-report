import { lazy, type ComponentType } from "react";

/**
 * Registry mapping demo IDs → lazy-loaded React components.
 * The MarkdownRenderer detects <div data-demo="id"> in the HTML
 * and swaps in the registered component.
 */
const registry: Record<string, React.LazyExoticComponent<ComponentType<any>>> = {
  "npv-calculator": lazy(() =>
    import("./NPVCalculatorWidget").then((m) => ({ default: m.NPVCalculatorWidget }))
  ),
  "nationality-convergence": lazy(() =>
    import("./NationalityConvergenceWidget").then((m) => ({ default: m.NationalityConvergenceWidget }))
  ),
  "retention-explorer": lazy(() =>
    import("./RetentionExplorerWidget").then((m) => ({ default: m.RetentionExplorerWidget }))
  ),
  "rv2021-shift": lazy(() =>
    import("./RV2021ShiftWidget").then((m) => ({ default: m.RV2021ShiftWidget }))
  ),
  "fiscal-waterfall": lazy(() =>
    import("./FiscalWaterfallWidget").then((m) => ({ default: m.FiscalWaterfallWidget }))
  ),
};

export function getDemoComponent(id: string) {
  return registry[id] ?? null;
}
