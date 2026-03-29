import { lazy, type ComponentType } from "react";

/**
 * Registry mapping demo IDs → lazy-loaded React components.
 * The MarkdownRenderer detects <div data-demo="id"> in the HTML
 * and swaps in the registered component.
 */
const registry: Record<string, React.LazyExoticComponent<ComponentType<any>>> = {
  "vat-registrants": lazy(() =>
    import("./VATDemoWidget").then((m) => ({ default: m.VATDemoWidget }))
  ),
  "implementation-plan": lazy(() =>
    import("./ImplementationPlanWidget").then((m) => ({ default: m.ImplementationPlanWidget }))
  ),
  "compliance-review": lazy(() =>
    import("./ComplianceReviewWidget").then((m) => ({ default: m.ComplianceReviewWidget }))
  ),
};

export function getDemoComponent(id: string) {
  return registry[id] ?? null;
}
