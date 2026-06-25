import { createRepository } from "./base";
import { parseTask, type Task } from "../domain/task";

export const tasksRepo = createRepository<Task>("tasks", parseTask);
