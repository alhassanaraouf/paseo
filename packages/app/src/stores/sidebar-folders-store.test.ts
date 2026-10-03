import { describe, expect, it } from "vitest";
import {
  assignProjectToSidebarFolder,
  createSidebarFolder,
  deleteSidebarFolder,
  moveSidebarFolder,
  renameSidebarFolder,
  toggleSidebarFolderCollapsed,
  type SidebarFoldersState,
} from "./sidebar-folders-store";

const empty: SidebarFoldersState = {
  folders: [],
  folderIdByProjectViewKey: {},
  collapsedFolderIds: [],
};

function withFolders(): SidebarFoldersState {
  let state = createSidebarFolder(empty, { id: "work", name: " Work " });
  state = createSidebarFolder(state, { id: "personal", name: "Personal" });
  return state;
}

describe("sidebar folders", () => {
  it("creates folders with trimmed names and ignores blank names", () => {
    const state = withFolders();
    expect(state.folders).toEqual([
      { id: "work", name: "Work" },
      { id: "personal", name: "Personal" },
    ]);
    expect(createSidebarFolder(state, { id: "blank", name: "   " })).toBe(state);
  });

  it("renames a folder but keeps the old name for a blank one", () => {
    const state = renameSidebarFolder(withFolders(), "work", "Clients");
    expect(state.folders[0]).toEqual({ id: "work", name: "Clients" });
    expect(renameSidebarFolder(state, "work", " ")).toBe(state);
  });

  it("assigns a project only to a folder that exists, and null moves it to the root", () => {
    let state = assignProjectToSidebarFolder(withFolders(), "srv:/repo", "work");
    expect(state.folderIdByProjectViewKey).toEqual({ "srv:/repo": "work" });
    state = assignProjectToSidebarFolder(state, "srv:/repo", "missing");
    expect(state.folderIdByProjectViewKey).toEqual({});
    state = assignProjectToSidebarFolder(state, "srv:/repo", "personal");
    state = assignProjectToSidebarFolder(state, "srv:/repo", null);
    expect(state.folderIdByProjectViewKey).toEqual({});
  });

  it("deleting a folder returns its projects to the root", () => {
    let state = assignProjectToSidebarFolder(withFolders(), "a", "work");
    state = assignProjectToSidebarFolder(state, "b", "personal");
    state = toggleSidebarFolderCollapsed(state, "work");
    state = deleteSidebarFolder(state, "work");
    expect(state.folders.map((folder) => folder.id)).toEqual(["personal"]);
    expect(state.folderIdByProjectViewKey).toEqual({ b: "personal" });
    expect(state.collapsedFolderIds).toEqual([]);
  });

  it("moves folders within bounds", () => {
    const state = withFolders();
    expect(moveSidebarFolder(state, "personal", -1).folders.map((folder) => folder.id)).toEqual([
      "personal",
      "work",
    ]);
    expect(moveSidebarFolder(state, "work", -1)).toBe(state);
    expect(moveSidebarFolder(state, "personal", 1)).toBe(state);
  });

  it("toggles collapse", () => {
    const collapsed = toggleSidebarFolderCollapsed(withFolders(), "work");
    expect(collapsed.collapsedFolderIds).toEqual(["work"]);
    expect(toggleSidebarFolderCollapsed(collapsed, "work").collapsedFolderIds).toEqual([]);
  });
});
