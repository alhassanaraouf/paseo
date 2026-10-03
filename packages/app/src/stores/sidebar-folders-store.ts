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

/** A project's per-host identities, as on `SidebarProjectEntry.hosts`. */
export type SidebarFolderProjectHosts = readonly { serverId: string; projectId: string }[];

export interface SidebarFoldersState {
  /** Render order. */
  folders: SidebarFolder[];
  /**
   * `serverId:projectId` → folder id, one entry per host the project lives on. A project with no
   * entry sits at the root. Keyed by the host-local project id rather than the sidebar's
   * `viewKey`, which follows `projectKey` and changes when the project's git remote does.
   */
  folderIdByProjectId: Record<string, string>;
  collapsedFolderIds: string[];
}

const SidebarFoldersPersistedStateSchema = z.strictObject({
  folders: z.array(z.strictObject({ id: z.string(), name: z.string() })).optional(),
  folderIdByProjectId: z.record(z.string(), z.string()).optional(),
  collapsedFolderIds: z.array(z.string()).optional(),
});

function projectIdKeys(hosts: SidebarFolderProjectHosts): string[] {
  return hosts.map((host) => `${host.serverId}:${host.projectId}`);
}

/** The folder a project sits in: the first of its hosts with an assignment to a live folder. */
export function resolveSidebarProjectFolderId(
  state: {
    folders: readonly SidebarFolder[];
    folderIdByProjectId: Readonly<Record<string, string>>;
  },
  hosts: SidebarFolderProjectHosts,
): string | null {
  for (const key of projectIdKeys(hosts)) {
    const folderId = state.folderIdByProjectId[key];
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
  const folderIdByProjectId: Record<string, string> = {};
  for (const [key, id] of Object.entries(state.folderIdByProjectId)) {
    if (id !== folderId) folderIdByProjectId[key] = id;
  }
  return {
    folders: state.folders.filter((folder) => folder.id !== folderId),
    folderIdByProjectId,
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

export function assignProjectToSidebarFolder(
  state: SidebarFoldersState,
  hosts: SidebarFolderProjectHosts,
  folderId: string | null,
): SidebarFoldersState {
  const assign = folderId && state.folders.some((folder) => folder.id === folderId);
  const folderIdByProjectId = { ...state.folderIdByProjectId };
  for (const key of projectIdKeys(hosts)) {
    if (assign) {
      folderIdByProjectId[key] = folderId;
    } else {
      delete folderIdByProjectId[key];
    }
  }
  return { ...state, folderIdByProjectId };
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
  assignProject: (hosts: SidebarFolderProjectHosts, folderId: string | null) => void;
  toggleFolderCollapsed: (folderId: string) => void;
}

export const useSidebarFoldersStore = create<SidebarFoldersStore>()(
  persist(
    (set) => ({
      folders: [],
      folderIdByProjectId: {},
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
      assignProject: (hosts, folderId) =>
        set((state) => assignProjectToSidebarFolder(state, hosts, folderId)),
      toggleFolderCollapsed: (folderId) =>
        set((state) => toggleSidebarFolderCollapsed(state, folderId)),
    }),
    {
      name: "sidebar-folders",
      storage: createValidatedPersistStorage(AsyncStorage, SidebarFoldersPersistedStateSchema),
      partialize: (state) => ({
        folders: state.folders,
        folderIdByProjectId: state.folderIdByProjectId,
        collapsedFolderIds: state.collapsedFolderIds,
      }),
    },
  ),
);
