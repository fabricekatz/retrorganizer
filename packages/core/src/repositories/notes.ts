import { createRepository } from "./base";
import { parseNote, type Note } from "../domain/note";

export const notesRepo = createRepository<Note>("notes", parseNote);
