export const PRODUCTION_ORDER_TRANSITIONS = {
  DRAFT: ["PLANNED", "CANCELLED"],
  PLANNED: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PARTIALLY_COMPLETED", "COMPLETED"],
  PARTIALLY_COMPLETED: ["PARTIALLY_COMPLETED", "COMPLETED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
} as const;

export type ProductionOrderStatus = keyof typeof PRODUCTION_ORDER_TRANSITIONS;

export function canTransitionProductionOrder(from: ProductionOrderStatus, to: ProductionOrderStatus): boolean {
  return (PRODUCTION_ORDER_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function calculatePurchaseSuggestion(input: {
  grossRequirement: number;
  onHand: number;
  reserved: number;
  confirmedInbound: number;
}): number {
  const available = Math.max(0, input.onHand - input.reserved);
  return Math.max(0, input.grossRequirement - available - input.confirmedInbound);
}
