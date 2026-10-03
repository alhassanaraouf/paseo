import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import { createValidatedPersistStorage } from "@/storage/validated-persist-storage";

/**
 * Sidebar folders group projects for organization only. They are client-local, like the
 * project order, so a folder never reaches a host and has no meaning beyond this sidebar.
 */
export interface SidebarFolder {
  id: string;
  name: string;
}

/** The identities a folder assignment hangs on, as on `SidebarProjectEntry`. */
export interface SidebarFolderProject {
  viewKey: string;
  hosts: readonly { serverId: string; projectId: string }[];
}

export interface SidebarFoldersState {
  /** Render order. */
  folders: SidebarFolder[];
  /**
   * Project ref → folder id. A project with no matching ref sits at the root.
   *
   * A project has several refs and the assignment is stored under all of them, because neither
   * identity survives everything on its own: `serverId:projectId` is stable per host but is lost
   * when that host goes away, and `view:<viewKey>` spans hosts but follows `projectKey`, which
   * changes with the git remote. `reconcileSidebarFolderAssignments` copies an assignment onto any
   * ref a project gains, so it outlives either kind of change.
   */
  folderIdByProjectRef: Record<string, string>;
  collapsedFolderIds: string[];
}

const SidebarFoldersPersistedStateSchema = z.strictObject({
  folders: z.array(z.strictObject({ id: z.string(), name: z.string() })).optional(),
  folderIdByProjectRef: z.record(z.string(), z.string()).optional(),
  collapsedFolderIds: z.array(z.string()).optional(),
});

function projectRefs(project: SidebarFolderProject): string[] {
  return [
    ...project.hosts.map((host) => `${host.serverId}:${host.projectId}`),
    `view:${project.viewKey}`,
  ];
}

/** The folder a project sits in: the first of its refs assigned to a folder that still exists. */
export function resolveSidebarProjectFolderId(
  state: {
    folders: readonly SidebarFolder[];
    folderIdByProjectRef: Readonly<Record<string, string>>;
  },
  project: SidebarFolderProject,
): string | null {
  for (const ref of projectRefs(project)) {
    const folderId = state.folderIdByProjectRef[ref];
    if (folderId && state.folders.some((folder) => folder.id === folderId)) return folderId;
  }
  return null;
}

export function normalizeSidebarFolderName(name: string): string {
  return name.trim();
}

function createFolderId(): string {
  return `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSidebarFolder(
  state: SidebarFoldersState,
  input: { id: string; name: string },
): SidebarFoldersState {
  const name = normalizeSidebarFolderName(input.name);
  if (!name) return state;
  return { ...state, folders: [...state.folders, { id: input.id, name }] };
}

export function renameSidebarFolder(
  state: SidebarFoldersState,
  folderId: string,
  rawName: string,
): SidebarFoldersState {
  const name = normalizeSidebarFolderName(rawName);
  if (!name) return state;
  return {
    ...state,
    folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, name } : folder)),
  };
}

/** Deleting a folder returns its projects to the root; it never removes a project. */
export function deleteSidebarFolder(
  state: SidebarFoldersState,
  folderId: string,
): SidebarFoldersState {
  const folderIdByProjectRef: Record<string, string> = {};
  for (const [ref, id] of Object.entries(state.folderIdByProjectRef)) {
    if (id !== folderId) folderIdByProjectRef[ref] = id;
  }
  return {
    folders: state.folders.filter((folder) => folder.id !== folderId),
    folderIdByProjectRef,
    collapsedFolderIds: state.collapsedFolderIds.filter((id) => id !== folderId),
  };
}

export function moveSidebarFolder(
  state: SidebarFoldersState,
  folderId: string,
  offset: -1 | 1,
): SidebarFoldersState {
  const index = state.folders.findIndex((folder) => folder.id === folderId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= state.folders.length) return state;
  const folders = [...state.folders];
  [folders[index], folders[target]] = [folders[target], folders[index]];
  return { ...state, folders };
}

// ponytail: refs from a host the project has since left are not cleared on reassign; if that
// host returns with an old ref, the project can land back in the old folder. Track refs per
// project if that shows up in practice.
export function assignProjectToSidebarFolder(
  state: SidebarFoldersState,
  project: SidebarFolderProject,
  folderId: string | null,
): SidebarFoldersState {
  const assign = folderId && state.folders.some((folder) => folder.id === folderId);
  const folderIdByProjectRef = { ...state.folderIdByProjectRef };
  for (const ref of projectRefs(project)) {
    if (assign) {
      folderIdByProjectRef[ref] = folderId;
    } else {
      delete folderIdByProjectRef[ref];
    }
  }
  return { ...state, folderIdByProjectRef };
}

/**
 * Copies each foldered project's assignment onto any ref it does not carry yet — a host it just
 * joined, or a `viewKey` it just took. Returns `state` untouched when nothing is missing, so an
 * effect calling this on every project change settles after one write.
 */
export function reconcileSidebarFolderAssignments(
  state: SidebarFoldersState,
  projects: readonly SidebarFolderProject[],
): SidebarFoldersState {
  let folderIdByProjectRef: Record<string, string> | null = null;
  for (const project of projects) {
    const folderId = resolveSidebarProjectFolderId(state, project);
    if (!folderId) continue;
    for (const ref of projectRefs(project)) {
      if (state.folderIdByProjectRef[ref] === folderId) continue;
      folderIdByProjectRef ??= { ...state.folderIdByProjectRef };
      folderIdByProjectRef[ref] = folderId;
    }
  }
  return folderIdByProjectRef ? { ...state, folderIdByProjectRef } : state;
}

export function toggleSidebarFolderCollapsed(
  state: SidebarFoldersState,
  folderId: string,
): SidebarFoldersState {
  const collapsedFolderIds = state.collapsedFolderIds.includes(folderId)
    ? state.collapsedFolderIds.filter((id) => id !== folderId)
    : [...state.collapsedFolderIds, folderId];
  return { ...state, collapsedFolderIds };
}

interface SidebarFoldersStore extends SidebarFoldersState {
  /** Creates a folder and returns its id, or null when the name is blank. */
  createFolder: (name: string) => string | null;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  moveFolder: (folderId: string, offset: -1 | 1) => void;
  assignProject: (project: SidebarFolderProject, folderId: string | null) => void;
  reconcileProjects: (projects: readonly SidebarFolderProject[]) => void;
  toggleFolderCollapsed: (folderId: string) => void;
}

export const useSidebarFoldersStore = create<SidebarFoldersStore>()(
  persist(
    (set) => ({
      folders: [],
      folderIdByProjectRef: {},
      collapsedFolderIds: [],
      createFolder: (name) => {
        if (!normalizeSidebarFolderName(name)) return null;
        const id = createFolderId();
        set((state) => createSidebarFolder(state, { id, name }));
        return id;
      },
      renameFolder: (folderId, name) => set((state) => renameSidebarFolder(state, folderId, name)),
      deleteFolder: (folderId) => set((state) => deleteSidebarFolder(state, folderId)),
      moveFolder: (folderId, offset) => set((state) => moveSidebarFolder(state, folderId, offset)),
      assignProject: (project, folderId) =>
        set((state) => assignProjectToSidebarFolder(state, project, folderId)),
      reconcileProjects: (projects) =>
        set((state) => reconcileSidebarFolderAssignments(state, projects)),
      toggleFolderCollapsed: (folderId) =>
        set((state) => toggleSidebarFolderCollapsed(state, folderId)),
    }),
    {
      name: "sidebar-folders",
      storage: createValidatedPersistStorage(AsyncStorage, SidebarFoldersPersistedStateSchema),
      partialize: (state) => ({
        folders: state.folders,
        folderIdByProjectRef: state.folderIdByProjectRef,
        collapsedFolderIds: state.collapsedFolderIds,
      }),
    },
  ),
);
