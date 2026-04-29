import { AppError } from "../utils/errors.js";

export function assertAutopilotLevel(level: number, required: number) {
  if (level < required) throw new AppError("APPROVAL_REQUIRED", "Current autopilot level does not allow this action without approval", 403);
}

export function isRiskyAction(action: string): boolean {
  return /(delete|overwrite|post|put|patch|send|shell|execute|payment|contract|settings|enable_high_risk|activate_agent)/i.test(action);
}
