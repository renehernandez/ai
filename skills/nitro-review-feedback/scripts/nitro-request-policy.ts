export const nitroArtifactClassifications = [
  "standard",
  "poc",
  "removal-only",
] as const;
export const nitroArtifactLifecycles = ["poc", "final_implementation"] as const;

export type NitroArtifactClassification =
  (typeof nitroArtifactClassifications)[number];
export type NitroArtifactLifecycle = (typeof nitroArtifactLifecycles)[number];

export function expectedNitroRequest(input: {
  artifactLifecycle: NitroArtifactLifecycle;
  artifactClassification: NitroArtifactClassification;
  effectiveDiffFiles: number;
}): "/request_review @nitro" | "@nitro review" {
  const { artifactLifecycle, artifactClassification, effectiveDiffFiles } =
    input;
  if (!Number.isSafeInteger(effectiveDiffFiles) || effectiveDiffFiles < 0) {
    throw new Error("effective_diff_files_invalid");
  }
  if (
    (artifactLifecycle === "poc" && artifactClassification !== "poc") ||
    (artifactLifecycle === "final_implementation" &&
      artifactClassification === "poc")
  ) {
    throw new Error("artifact_lifecycle_classification_mismatch");
  }
  if (effectiveDiffFiles <= 50) {
    return "/request_review @nitro";
  }
  if (
    artifactClassification === "poc" ||
    artifactClassification === "removal-only"
  ) {
    return "@nitro review";
  }
  throw new Error("standard_artifact_exceeds_nitro_file_ceiling");
}
