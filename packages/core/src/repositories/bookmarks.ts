import { createRepository } from "./base";
import { parseBookmark, type Bookmark } from "../domain/bookmark";

export const bookmarksRepo = createRepository<Bookmark>("bookmarks", parseBookmark);
