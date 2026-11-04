// Installs Pi's configured packages and pre-downloads the managed launcher's
// explicit extensions, so a first managed launch does not spend its startup
// deadline downloading them.
import { spawnSync } from "node:child_process";
import { launchPackages } from "../hooks/pi/launch.ts";

function run(args: string[]): void {
  const result = spawnSync("pi", args, { stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(
      `pi ${args.join(" ")} failed: ${result.error?.message ?? `exit ${result.status}`}`,
    );
}

run(["update", "--extensions"]);
// Listing models loads the extension without credentials or a model request.
for (const pkg of launchPackages)
  run(["--no-extensions", "-e", pkg, "--list-models", "ax-no-model"]);
