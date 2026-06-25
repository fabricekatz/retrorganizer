import { createRepository } from "./base";
import { parseEvent, type Event } from "../domain/event";

export const eventsRepo = createRepository<Event>("events", parseEvent);
