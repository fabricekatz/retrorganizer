import { createRepository } from "./base";
import { parseNoteSection, type NoteSection } from "../domain/note";

export const noteSectionsRepo = createRepository<NoteSection>("noteSections", parseNoteSection);
