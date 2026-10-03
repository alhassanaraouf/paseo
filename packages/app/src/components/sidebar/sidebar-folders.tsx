import { useCallback, useMemo, useState, type ReactElement } from "react";
import { Pressable, Text, View, type PressableStateCallbackType } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react-native";
import {
  MenuItem,
  MenuSeparator,
  MenuSubTrigger,
  MenuTextField,
  useMenuContext,
  type MenuPageDefinition,
} from "@/components/ui/menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsCompactFormFactor } from "@/constants/layout";
import { isNative, isWeb } from "@/constants/platform";
import {
  normalizeSidebarFolderName,
  useSidebarFoldersStore,
  type SidebarFolder,
} from "@/stores/sidebar-folders-store";
import type { Theme } from "@/styles/theme";

const MENU_ICON_SIZE = 14;
const PROJECT_FOLDER_PAGE_ID = "sidebarProjectFolder";
const PROJECT_FOLDER_CREATE_PAGE_ID = "sidebarProjectFolderCreate";
const FOLDER_RENAME_PAGE_ID = "sidebarFolderRename";

const ThemedChevronDown = withUnistyles(ChevronDown);
const ThemedChevronRight = withUnistyles(ChevronRight);
const ThemedFolder = withUnistyles(Folder);
const ThemedFolderOpen = withUnistyles(FolderOpen);
const ThemedMoreVertical = withUnistyles(MoreVertical);
const ThemedPlus = withUnistyles(Plus);
const ThemedTrash2 = withUnistyles(Trash2);
const ThemedArrowUp = withUnistyles(ArrowUp);
const ThemedArrowDown = withUnistyles(ArrowDown);

const mutedMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });
const foregroundMapping = (theme: Theme) => ({ color: theme.colors.foreground });

const plusLeading = <ThemedPlus size={MENU_ICON_SIZE} uniProps={mutedMapping} />;
const trashLeading = <ThemedTrash2 size={MENU_ICON_SIZE} uniProps={mutedMapping} />;
const arrowUpLeading = <ThemedArrowUp size={MENU_ICON_SIZE} uniProps={mutedMapping} />;
const arrowDownLeading = <ThemedArrowDown size={MENU_ICON_SIZE} uniProps={mutedMapping} />;
const folderLeading = <ThemedFolder size={MENU_ICON_SIZE} uniProps={mutedMapping} />;

function kebabStyle({ hovered = false }: PressableStateCallbackType & { hovered?: boolean }) {
  return [styles.kebab, hovered && styles.kebabHovered];
}

function renderKebabIcon({ hovered }: { hovered?: boolean }) {
  return <ThemedMoreVertical size={14} uniProps={hovered ? foregroundMapping : mutedMapping} />;
}

/**
 * The header a folder's projects sit under. Pressing it collapses the folder; its menu renames,
 * reorders, and deletes it. Deleting returns the projects to the root.
 */
export function SidebarFolderHeader({
  folder,
  collapsed,
  canMoveUp,
  canMoveDown,
}: {
  folder: SidebarFolder;
  collapsed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}): ReactElement {
  const { t } = useTranslation();
  const isCompact = useIsCompactFormFactor();
  const [isHovered, setIsHovered] = useState(false);
  const toggleFolderCollapsed = useSidebarFoldersStore((state) => state.toggleFolderCollapsed);
  const moveFolder = useSidebarFoldersStore((state) => state.moveFolder);
  const deleteFolder = useSidebarFoldersStore((state) => state.deleteFolder);
  const handleToggle = useCallback(
    () => toggleFolderCollapsed(folder.id),
    [folder.id, toggleFolderCollapsed],
  );
  const handleMoveUp = useCallback(() => moveFolder(folder.id, -1), [folder.id, moveFolder]);
  const handleMoveDown = useCallback(() => moveFolder(folder.id, 1), [folder.id, moveFolder]);
  const handleDelete = useCallback(() => deleteFolder(folder.id), [deleteFolder, folder.id]);
  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);
  const accessibilityState = useMemo(() => ({ expanded: !collapsed }), [collapsed]);
  const pages = useMemo<MenuPageDefinition[]>(
    () => [
      {
        id: FOLDER_RENAME_PAGE_ID,
        title: t("sidebar.folder.rename"),
        hoverIntent: false,
        content: <SidebarFolderRenamePage folder={folder} />,
      },
    ],
    [folder, t],
  );
  const rowStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.row,
      isHovered && styles.rowHovered,
      pressed && styles.rowPressed,
    ],
    [isHovered],
  );

  const actionsVisible = isHovered || isNative || isCompact;
  const FolderIcon = collapsed ? ThemedFolder : ThemedFolderOpen;
  const Chevron = collapsed ? ThemedChevronRight : ThemedChevronDown;

  return (
    <View onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        onPress={handleToggle}
        style={rowStyle}
        testID={`sidebar-folder-row-${folder.id}`}
      >
        <View style={styles.left}>
          <View style={styles.leading}>
            {isHovered ? (
              <Chevron size={14} uniProps={mutedMapping} />
            ) : (
              <FolderIcon size={16} uniProps={mutedMapping} />
            )}
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {folder.name}
          </Text>
        </View>
        <View
          style={!actionsVisible && styles.hidden}
          pointerEvents={actionsVisible ? "auto" : "none"}
        >
          <DropdownMenu compactMode="sheet">
            <DropdownMenuTrigger
              hitSlop={8}
              style={kebabStyle}
              accessibilityRole={isWeb ? undefined : "button"}
              accessibilityLabel={t("sidebar.folder.menu")}
              testID={`sidebar-folder-kebab-${folder.id}`}
            >
              {renderKebabIcon}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" width={220} pages={pages} sheetTitle={folder.name}>
              <DropdownMenuSubTrigger
                id={FOLDER_RENAME_PAGE_ID}
                testID={`sidebar-folder-rename-${folder.id}`}
              >
                {t("sidebar.folder.rename")}
              </DropdownMenuSubTrigger>
              <DropdownMenuItem
                leading={arrowUpLeading}
                disabled={!canMoveUp}
                onSelect={handleMoveUp}
                testID={`sidebar-folder-move-up-${folder.id}`}
              >
                {t("sidebar.folder.moveUp")}
              </DropdownMenuItem>
              <DropdownMenuItem
                leading={arrowDownLeading}
                disabled={!canMoveDown}
                onSelect={handleMoveDown}
                testID={`sidebar-folder-move-down-${folder.id}`}
              >
                {t("sidebar.folder.moveDown")}
              </DropdownMenuItem>
              <DropdownMenuItem
                leading={trashLeading}
                onSelect={handleDelete}
                testID={`sidebar-folder-delete-${folder.id}`}
              >
                {t("sidebar.folder.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
      </Pressable>
    </View>
  );
}

function SidebarFolderRenamePage({ folder }: { folder: SidebarFolder }): ReactElement {
  const { t } = useTranslation();
  const menu = useMenuContext("SidebarFolderRenamePage");
  const renameFolder = useSidebarFoldersStore((state) => state.renameFolder);
  const [name, setName] = useState(folder.name);
  const submit = useCallback(() => {
    if (!normalizeSidebarFolderName(name)) return;
    renameFolder(folder.id, name);
  }, [folder.id, name, renameFolder]);
  const submitFromKeyboard = useCallback(() => menu.selectItem(submit, true), [menu, submit]);
  return (
    <>
      <MenuTextField
        initialValue={folder.name}
        onChangeText={setName}
        placeholder={t("sidebar.folder.name")}
        autoFocus
        onSubmitEditing={submitFromKeyboard}
        testID="sidebar-folder-rename-name"
      />
      <MenuSeparator />
      <MenuItem
        disabled={!normalizeSidebarFolderName(name)}
        onSelect={submit}
        testID="sidebar-folder-rename-submit"
      >
        {t("sidebar.folder.save")}
      </MenuItem>
    </>
  );
}

/**
 * The `Folder` row on a project's menu and the pages behind it. Both the kebab dropdown and the
 * row's context menu render these, so the pages are defined once.
 */
export function useProjectFolderMenuPages(projectViewKey: string): MenuPageDefinition[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        id: PROJECT_FOLDER_PAGE_ID,
        title: t("sidebar.folder.title"),
        content: <ProjectFolderPickerPage projectViewKey={projectViewKey} />,
      },
      {
        id: PROJECT_FOLDER_CREATE_PAGE_ID,
        title: t("sidebar.folder.newFolder"),
        hoverIntent: false,
        content: <ProjectFolderCreatePage projectViewKey={projectViewKey} />,
      },
    ],
    [projectViewKey, t],
  );
}

export function ProjectFolderMenuTrigger({
  projectViewKey,
}: {
  projectViewKey: string;
}): ReactElement {
  const { t } = useTranslation();
  const folderName = useSidebarFoldersStore((state) => {
    const folderId = state.folderIdByProjectViewKey[projectViewKey];
    return state.folders.find((folder) => folder.id === folderId)?.name ?? null;
  });
  return (
    <MenuSubTrigger
      id={PROJECT_FOLDER_PAGE_ID}
      value={folderName ?? t("sidebar.folder.none")}
      testID={`sidebar-project-menu-folder-${projectViewKey}`}
    >
      {t("sidebar.folder.title")}
    </MenuSubTrigger>
  );
}

function ProjectFolderPickerPage({ projectViewKey }: { projectViewKey: string }): ReactElement {
  const { t } = useTranslation();
  const folders = useSidebarFoldersStore((state) => state.folders);
  const currentFolderId = useSidebarFoldersStore(
    (state) => state.folderIdByProjectViewKey[projectViewKey] ?? null,
  );
  const assignProject = useSidebarFoldersStore((state) => state.assignProject);
  return (
    <>
      <FolderOptionRow
        label={t("sidebar.folder.none")}
        folderId={null}
        selected={currentFolderId === null}
        projectViewKey={projectViewKey}
        onAssign={assignProject}
      />
      {folders.map((folder) => (
        <FolderOptionRow
          key={folder.id}
          label={folder.name}
          leading={folderLeading}
          folderId={folder.id}
          selected={currentFolderId === folder.id}
          projectViewKey={projectViewKey}
          onAssign={assignProject}
        />
      ))}
      <MenuSeparator />
      <MenuSubTrigger
        id={PROJECT_FOLDER_CREATE_PAGE_ID}
        leading={plusLeading}
        testID="sidebar-project-folder-create"
      >
        {t("sidebar.folder.newFolder")}
      </MenuSubTrigger>
    </>
  );
}

function FolderOptionRow({
  label,
  leading,
  folderId,
  selected,
  projectViewKey,
  onAssign,
}: {
  label: string;
  leading?: ReactElement | null;
  folderId: string | null;
  selected: boolean;
  projectViewKey: string;
  onAssign: (projectViewKey: string, folderId: string | null) => void;
}): ReactElement {
  const select = useCallback(
    () => onAssign(projectViewKey, folderId),
    [folderId, onAssign, projectViewKey],
  );
  return (
    <MenuItem
      leading={leading}
      selected={selected}
      onSelect={select}
      testID={`sidebar-project-folder-option-${folderId ?? "none"}`}
    >
      {label}
    </MenuItem>
  );
}

function ProjectFolderCreatePage({ projectViewKey }: { projectViewKey: string }): ReactElement {
  const { t } = useTranslation();
  const menu = useMenuContext("ProjectFolderCreatePage");
  const createFolder = useSidebarFoldersStore((state) => state.createFolder);
  const assignProject = useSidebarFoldersStore((state) => state.assignProject);
  const [name, setName] = useState("");
  const submit = useCallback(() => {
    const folderId = createFolder(name);
    if (folderId) assignProject(projectViewKey, folderId);
  }, [assignProject, createFolder, name, projectViewKey]);
  const submitFromKeyboard = useCallback(() => {
    if (!normalizeSidebarFolderName(name)) return;
    menu.selectItem(submit, true);
  }, [menu, name, submit]);
  return (
    <>
      <MenuTextField
        onChangeText={setName}
        placeholder={t("sidebar.folder.name")}
        autoFocus
        onSubmitEditing={submitFromKeyboard}
        testID="sidebar-project-folder-create-name"
      />
      <MenuSeparator />
      <MenuItem
        disabled={!normalizeSidebarFolderName(name)}
        onSelect={submit}
        testID="sidebar-project-folder-create-submit"
      >
        {t("sidebar.folder.create")}
      </MenuItem>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    minHeight: 36,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing[1],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[2],
    userSelect: "none",
  },
  rowHovered: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  rowPressed: {
    backgroundColor: theme.colors.surface2,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    flex: 1,
    minWidth: 0,
  },
  leading: {
    width: theme.iconSize.md,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    minWidth: 0,
    flexShrink: 1,
  },
  kebab: {
    width: 24,
    height: 24,
    marginRight: -6,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  kebabHovered: {
    backgroundColor: theme.colors.surface2,
  },
  hidden: {
    opacity: 0,
  },
}));
