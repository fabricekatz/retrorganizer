import { createRepository } from "./base";
import { parseCategory, type Category } from "../domain/category";

export const categoriesRepo = createRepository<Category>("categories", parseCategory);
