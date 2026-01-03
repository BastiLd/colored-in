export const PLAN_LIMITS = {
  free: {
    palettesPerMonth: 1,
    chatMessagesPerMonth: 0,
    features: {
      askMode: false,
      proBuilder: false,
      chatHistory: false,
    },
  },
  pro: {
    palettesPerMonth: 50,
    chatMessagesPerMonth: 30,
    features: {
      askMode: true,
      proBuilder: true,
      chatHistory: true,
    },
  },
  ultra: {
    palettesPerMonth: 500,
    chatMessagesPerMonth: 100,
    features: {
      askMode: true,
      proBuilder: true,
      chatHistory: true,
    },
  },
  individual: {
    palettesPerMonth: 2500,
    chatMessagesPerMonth: 300,
    features: {
      askMode: true,
      proBuilder: true,
      chatHistory: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string): typeof PLAN_LIMITS[PlanKey] {
  return PLAN_LIMITS[plan as PlanKey] || PLAN_LIMITS.free;
}

export function checkChatAccess(plan: string): boolean {
  return getPlanLimits(plan).features.askMode;
}

export function checkProBuilderAccess(plan: string): boolean {
  return getPlanLimits(plan).features.proBuilder;
}

