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

export interface SidebarFoldersState {
  /** Render order. */
  folders: SidebarFolder[];
  /** `SidebarProjectEntry.viewKey` → folder id. A project absent here sits at the root. */
  folderIdByProjectViewKey: Record<string, string>;
  collapsedFolderIds: string[];
}

const SidebarFoldersPersistedStateSchema = z.strictObject({
  folders: z.array(z.strictObject({ id: z.string(), name: z.string() })).optional(),
  folderIdByProjectViewKey: z.record(z.string(), z.string()).optional(),
  collapsedFolderIds: z.array(z.string()).optional(),
});

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
  const folderIdByProjectViewKey: Record<string, string> = {};
  for (const [viewKey, id] of Object.entries(state.folderIdByProjectViewKey)) {
    if (id !== folderId) folderIdByProjectViewKey[viewKey] = id;
  }
  return {
    folders: state.folders.filter((folder) => folder.id !== folderId),
    folderIdByProjectViewKey,
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
  projectViewKey: string,
  folderId: string | null,
): SidebarFoldersState {
  const folderIdByProjectViewKey = { ...state.folderIdByProjectViewKey };
  if (folderId && state.folders.some((folder) => folder.id === folderId)) {
    folderIdByProjectViewKey[projectViewKey] = folderId;
  } else {
    delete folderIdByProjectViewKey[projectViewKey];
  }
  return { ...state, folderIdByProjectViewKey };
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
  assignProject: (projectViewKey: string, folderId: string | null) => void;
  toggleFolderCollapsed: (folderId: string) => void;
}

export const useSidebarFoldersStore = create<SidebarFoldersStore>()(
  persist(
    (set) => ({
      folders: [],
      folderIdByProjectViewKey: {},
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
      assignProject: (projectViewKey, folderId) =>
        set((state) => assignProjectToSidebarFolder(state, projectViewKey, folderId)),
      toggleFolderCollapsed: (folderId) =>
        set((state) => toggleSidebarFolderCollapsed(state, folderId)),
    }),
    {
      name: "sidebar-folders",
      storage: createValidatedPersistStorage(AsyncStorage, SidebarFoldersPersistedStateSchema),
      partialize: (state) => ({
        folders: state.folders,
        folderIdByProjectViewKey: state.folderIdByProjectViewKey,
        collapsedFolderIds: state.collapsedFolderIds,
      }),
    },
  ),
);
