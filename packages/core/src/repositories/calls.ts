import { createRepository } from "./base";
import { parseCall, type Call } from "../domain/call";

export const callsRepo = createRepository<Call>("calls", parseCall);
