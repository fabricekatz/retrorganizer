import { createRepository } from "./base";
import { parseContact, type Contact } from "../domain/contact";

export const contactsRepo = createRepository<Contact>("contacts", parseContact);
