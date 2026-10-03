import { describe, expect, it } from "vitest";
import {
  assignProjectToSidebarFolder,
  createSidebarFolder,
  deleteSidebarFolder,
  moveSidebarFolder,
  renameSidebarFolder,
  resolveSidebarProjectFolderId,
  toggleSidebarFolderCollapsed,
  type SidebarFoldersState,
} from "./sidebar-folders-store";

const empty: SidebarFoldersState = {
  folders: [],
  folderIdByProjectId: {},
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

  it("assigns every host of a project, only to a folder that exists; null moves it to the root", () => {
    const hosts = [
      { serverId: "a", projectId: "prj_1" },
      { serverId: "b", projectId: "prj_2" },
    ];
    let state = assignProjectToSidebarFolder(withFolders(), hosts, "work");
    expect(state.folderIdByProjectId).toEqual({ "a:prj_1": "work", "b:prj_2": "work" });
    expect(resolveSidebarProjectFolderId(state, hosts)).toBe("work");
    state = assignProjectToSidebarFolder(state, hosts, "missing");
    expect(state.folderIdByProjectId).toEqual({});
    state = assignProjectToSidebarFolder(state, hosts, "personal");
    state = assignProjectToSidebarFolder(state, hosts, null);
    expect(state.folderIdByProjectId).toEqual({});
  });

  it("finds the folder through any host, so a newly joined host does not move the project", () => {
    const state = assignProjectToSidebarFolder(
      withFolders(),
      [{ serverId: "a", projectId: "prj_1" }],
      "work",
    );
    expect(
      resolveSidebarProjectFolderId(state, [
        { serverId: "b", projectId: "prj_9" },
        { serverId: "a", projectId: "prj_1" },
      ]),
    ).toBe("work");
  });

  it("deleting a folder returns its projects to the root", () => {
    let state = assignProjectToSidebarFolder(
      withFolders(),
      [{ serverId: "s", projectId: "a" }],
      "work",
    );
    state = assignProjectToSidebarFolder(state, [{ serverId: "s", projectId: "b" }], "personal");
    state = toggleSidebarFolderCollapsed(state, "work");
    state = deleteSidebarFolder(state, "work");
    expect(state.folders.map((folder) => folder.id)).toEqual(["personal"]);
    expect(state.folderIdByProjectId).toEqual({ "s:b": "personal" });
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
