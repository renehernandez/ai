export type ArtifactRoute = "atomic_plan" | "openspec";

export type PlanContract = {
  explicitRoute?: ArtifactRoute;
  coherentSingleMr: boolean;
  severalDeliveryUnits: boolean;
  durableCrossComponentContract: boolean;
  migrationDesign: boolean;
  fullPocRequired: boolean;
  unresolvedMaterialDecision: boolean;
};

export type PlanSelection =
  | {
      status: "conversational";
      artifact: "none";
      reason: string;
    }
  | {
      status: "ready";
      artifact: ArtifactRoute;
      requiresFullPoc: boolean;
      planningMr: false;
      reason: string;
    };

function requiresOpenSpec(contract: PlanContract): boolean {
  return (
    contract.severalDeliveryUnits ||
    contract.durableCrossComponentContract ||
    contract.migrationDesign ||
    contract.fullPocRequired
  );
}

export function selectPlanningArtifact(contract: PlanContract): PlanSelection {
  if (contract.unresolvedMaterialDecision) {
    return {
      status: "conversational",
      artifact: "none",
      reason: "material implementation decision remains unresolved",
    };
  }

  const openSpecRequired = requiresOpenSpec(contract);

  if (contract.explicitRoute === "atomic_plan" && openSpecRequired) {
    return {
      status: "ready",
      artifact: "openspec",
      requiresFullPoc: true,
      planningMr: false,
      reason: "the accepted contract requires a durable OpenSpec and full POC",
    };
  }

  if (contract.explicitRoute === "openspec" || openSpecRequired) {
    return {
      status: "ready",
      artifact: "openspec",
      requiresFullPoc: true,
      planningMr: false,
      reason: contract.explicitRoute
        ? "the user selected a coherent OpenSpec route"
        : "the contract requires OpenSpec",
    };
  }

  if (!contract.coherentSingleMr) {
    return {
      status: "conversational",
      artifact: "none",
      reason: "delivery shape is not coherent enough to select an artifact",
    };
  }

  return {
    status: "ready",
    artifact: "atomic_plan",
    requiresFullPoc: false,
    planningMr: false,
    reason: "one coherent MR needs no durable cross-component specification",
  };
}
