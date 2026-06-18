import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, SlidersHorizontal, Trash2, FolderPlus, Grid, 
  Download, Sparkles, Star, Archive, RefreshCw, FileText, 
  ArrowLeft, Upload, Grid3X3, Layers, Settings, ChevronRight, 
  Calendar, Check, X, FileJson, Copy, Bookmark, Database, Image as ImageIcon,
  CheckSquare, Square, Inbox, Heart, Info, MoveLeft, MoveRight, HelpCircle, AlertCircle,
  FlipHorizontal
} from 'lucide-react';
import {
  seedDatabase, getProjects, getCategories, getAllTagNames, getProject,
  getProjectImages, getProjectSheets, getProjectTags, updateProject,
  createProject, deleteProject, duplicateProject, addProjectImages,
  updateProjectImage, deleteProjectImage, selectAllProjectImages,
  swapProjectImages, saveProjectSheet, addProjectTag, removeProjectTag, dataUrlToBlob,
  sortProjectImagesByName,
  type Project, type Category, type ProjectImage, type ProjectSheet
} from './api';
import { compareNumericFilenames } from './utils/fileSort';
import UploadZone from './components/UploadZone';
import AnimationPreview from './components/AnimationPreview';
import { 
  generateJSONExport, generateXMLExport, generateUnityExport, 
  generateGodotExport, generatePhaserExport, FrameCoord 
} from './utils/exporter';

export default function App() {
  // DB States
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedInProgress, setSeedInProgress] = useState(false);

  // Active Navigation
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<number | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name' | 'frames'>('updated');
  const [frameCountFilter, setFrameCountFilter] = useState<number | null>(null);

  // Pagination for heavy storage scaling
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Bulk operation states
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Record<number, boolean>>({});

  // Trigger Creation Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState<number>(1);
  const [newProjectTagsInput, setNewProjectTagsInput] = useState('');

  // Project Editor States (for current project)
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [editorImages, setEditorImages] = useState<ProjectImage[]>([]);
  const [editorSheets, setEditorSheets] = useState<ProjectSheet[]>([]);
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  
  // Dimensions & Resize states
  const [frameWidth, setFrameWidth] = useState(64);
  const [frameHeight, setFrameHeight] = useState(64);
  const [lockAspect, setLockAspect] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1.0); // W / H

  // Exporter panel states
  const [exporterFormat, setExporterFormat] = useState<'json' | 'xml' | 'unity' | 'godot' | 'phaser'>('json');
  const [exportedString, setExportedString] = useState('');
  const [isCustomDimensionsWarning, setIsCustomDimensionsWarning] = useState(false);

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        setSeedInProgress(true);
        // Call database seeder to populate default categories and dynamic pixel projects
        await seedDatabase();
      } catch (err) {
        console.error("Failed to seed database: ", err);
      } finally {
        setSeedInProgress(false);
        await reloadAllData();
      }
    };
    initApp();
  }, []);

  // Fetch lists from IndexedDB
  const reloadAllData = async () => {
    try {
      const [allProjects, allCategories, uniqueTags] = await Promise.all([
        getProjects(),
        getCategories(),
        getAllTagNames(),
      ]);
      setProjects(allProjects);
      setCategories(allCategories);
      setTags(uniqueTags);
    } catch (e) {
      console.error("Failed to read database records:", e);
    } finally {
      setLoading(false);
    }
  };

  // Keep project tags synced
  const reloadProjectTags = async (projId: number) => {
    const records = await getProjectTags(projId);
    setEditorTags(records.map(r => r.tagName));
  };

  // Project Editor loading triggers
  useEffect(() => {
    const loadActiveProject = async () => {
      if (currentProjectId === null) {
        setCurrentProject(null);
        setEditorImages([]);
        setEditorSheets([]);
        setEditorTags([]);
        return;
      }

      try {
        const proj = await getProject(currentProjectId);
        if (!proj) {
          setCurrentProjectId(null);
          return;
        }

        const [images, sheets] = await Promise.all([
          getProjectImages(currentProjectId),
          getProjectSheets(currentProjectId),
        ]);

        setCurrentProject(proj);
        setEditorImages(images);
        setEditorSheets(sheets);
        setFrameWidth(proj.frameWidth || 64);
        setFrameHeight(proj.frameHeight || 64);
        
        if (images.length > 0) {
          const img = new Image();
          img.onload = () => {
            if (img.width && img.height) {
              setAspectRatio(img.width / img.height);
            }
          };
          img.src = images[0].imageSrc;
        }

        await reloadProjectTags(currentProjectId);

        await updateProject(currentProjectId, { updatedAt: Date.now() });
        const allProj = await getProjects();
        setProjects(allProj);

      } catch (err) {
        console.error("Failed to load project details:", err);
      }
    };
    loadActiveProject();
  }, [currentProjectId]);

  // Sync Dimension Aspect Lock
  useEffect(() => {
    if (editorImages.length > 0 && aspectRatio) {
      // Just to update aspect ratio based on current images if changed
    }
  }, [editorImages, aspectRatio]);

  // Multi-filtering logic for dashboard
  const filteredProjects = useMemo(() => {
    let list = [...projects];

    // Status Filter (Active / Archived / All)
    if (statusFilter === 'active') {
      list = list.filter(p => p.status === 'active');
    } else if (statusFilter === 'archived') {
      list = list.filter(p => p.status === 'archived');
    }

    // Favorite Filter
    if (showFavoritesOnly) {
      list = list.filter(p => p.isFavorite);
    }

    // Category Filter
    if (activeCategoryFilter !== null) {
      list = list.filter(p => p.categoryId === activeCategoryFilter);
    }

    // Tag Filter
    if (activeTagFilter !== null) {
      // We can check matches asynchronously, but for fast clientside index:
      // We check if the project has projectTags relation. Let's lookup via an async-mapped static lookup or direct filter.
      // Since project list is small/medium, we can query relations or we can do filter with joined project tags:
    }

    // Frame Count Filter
    if (frameCountFilter !== null) {
      list = list.filter(p => p.frameCount === frameCountFilter);
    }

    // Keyword Search (Project Name, Category, Tags, Frame Size specs)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => {
        const catName = categories.find(c => c.id === p.categoryId)?.name.toLowerCase() || '';
        const sizeStr = `${p.frameWidth}x${p.frameHeight}`;
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          catName.includes(q) ||
          sizeStr.includes(q)
        );
      });
    }

    // Apply Sorting
    list.sort((a, b) => {
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
      if (sortBy === 'created') return b.createdAt - a.createdAt;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'frames') return b.frameCount - a.frameCount;
      return 0;
    });

    return list;
  }, [projects, statusFilter, showFavoritesOnly, activeCategoryFilter, activeTagFilter, frameCountFilter, searchQuery, sortBy, categories]);

  // Paginated Projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProjects.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProjects, currentPage]);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage) || 1;

  // Global counts for Dashboard stats widgets
  const stats = useMemo(() => {
    const totalProjectsCount = projects.length;
    const activeProjectsCount = projects.filter(p => p.status === 'active').length;
    const favoriteCount = projects.filter(p => p.isFavorite).length;

    let totalFrames = 0;
    let totalGeneratedSheets = 0;
    let totalEstimatedStorageBytes = 0; // estimate based on base64 lengths

    // Traverse details
    projects.forEach(p => {
      totalFrames += p.frameCount || 0;
      if (p.version && p.version > 0) {
        totalGeneratedSheets += 1;
      }
    });

    return {
      totalProjectsCount,
      activeProjectsCount,
      favoriteCount,
      totalFrames,
      totalGeneratedSheets,
    };
  }, [projects]);

  // Handle Resize Settings changes
  const handleWidthChange = (val: number) => {
    if (val <= 0) return;
    setFrameWidth(val);
    if (lockAspect && aspectRatio) {
      setFrameHeight(Math.round(val / aspectRatio));
    }
  };

  const handleHeightChange = (val: number) => {
    if (val <= 0) return;
    setFrameHeight(val);
    if (lockAspect && aspectRatio) {
      setFrameWidth(Math.round(val * aspectRatio));
    }
  };

  // Auto update lock aspect when checkbox is check-marked
  const toggleLockAspect = () => {
    const nextVal = !lockAspect;
    setLockAspect(nextVal);
    if (nextVal && frameHeight > 0) {
      // align height to width aspect ratio baseline
      setFrameHeight(Math.round(frameWidth / aspectRatio));
    }
  };

  // Add multiple uploaded images to the active project
  const syncResizeFromDimensions = (width: number, height: number) => {
    setFrameWidth(width);
    setFrameHeight(height);
    if (height > 0) {
      setAspectRatio(width / height);
    }
  };

  const handleAddImages = async (files: File[]) => {
    if (!currentProjectId || !currentProject || files.length === 0) return;

    try {
      setUploadingImages(true);
      const { images, project: updatedProj } = await addProjectImages(currentProjectId, files);

      setEditorImages(images);
      setCurrentProject(updatedProj);
      syncResizeFromDimensions(updatedProj.frameWidth, updatedProj.frameHeight);

      await reloadAllData();
    } catch (e) {
      console.error('Error bulk uploading images:', e);
      alert(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSortImagesByName = async () => {
    if (!currentProjectId) return;
    try {
      const imgs = await sortProjectImagesByName(currentProjectId);
      setEditorImages(imgs);
      await reloadAllData();
    } catch (e) {
      console.error('Failed to sort images:', e);
    }
  };

  const refreshEditorImages = async () => {
    if (!currentProjectId) return;
    const imgs = await getProjectImages(currentProjectId);
    setEditorImages(imgs);
  };

  const syncProjectStatsAndDates = async () => {
    if (!currentProjectId || !currentProject) return;
    const updatedProj = await getProject(currentProjectId);
    if (updatedProj) {
      setCurrentProject(updatedProj);
    }
    await reloadAllData();
  };

  // Select / Deselect actions in active Grid Manager
  const handleImageSelectToggle = async (imageId: number, val: boolean) => {
    await updateProjectImage(imageId, { isSelected: val });
    await refreshEditorImages();
  };

  const handleSelectAllImages = async (val: boolean) => {
    if (!currentProjectId || editorImages.length === 0) return;
    const imgs = await selectAllProjectImages(currentProjectId, val);
    setEditorImages(imgs);
  };

  const handleDeleteImage = async (imageId: number) => {
    await deleteProjectImage(imageId);
    await refreshEditorImages();
    await syncProjectStatsAndDates();
  };

  // Frame sequencing: Move Frame Left / Right
  const handleMoveFrame = async (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === editorImages.length - 1) return;

    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    const currentImg = editorImages[index];
    const targetImg = editorImages[targetIndex];

    if (currentImg.id && targetImg.id) {
      await swapProjectImages(
        currentProjectId!,
        currentImg.id,
        currentImg.sortOrder,
        targetImg.id,
        targetImg.sortOrder
      );
      await refreshEditorImages();
    }
  };

  // Create Project handler
  const handleCreateNewProject = async () => {
    if (newProjectName.trim() === '') return;

    try {
      const tagsToInsert = newProjectTagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const proj = await createProject({
        name: newProjectName,
        description: newProjectDesc,
        categoryId: newProjectCategory,
        tags: tagsToInsert,
      });

      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectTagsInput('');
      setIsCreateModalOpen(false);
      
      await reloadAllData();
      setCurrentProjectId(proj.id!);
    } catch (err) {
      console.error("Failed to build new project:", err);
    }
  };

  // Editor Tag functions
  const handleAddEditorTag = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim() !== '') {
      e.preventDefault();
      if (!currentProjectId) return;
      const cleanTag = newTagInput.trim().toLowerCase();
      
      try {
        await addProjectTag(currentProjectId, cleanTag);
        await reloadProjectTags(currentProjectId);
        await reloadAllData();
      } catch {
        // tag may already exist
      }
      setNewTagInput('');
    }
  };

  const handleRemoveEditorTag = async (tagName: string) => {
    if (!currentProjectId) return;
    await removeProjectTag(currentProjectId, tagName);
    await reloadProjectTags(currentProjectId);
    await reloadAllData();
  };

  // Interactive sprite sheet generation stitching engine
  const handleStitchSpriteSheet = async () => {
    if (!currentProject || !currentProjectId) return;
    const selectedFrames = editorImages
      .filter((img) => img.isSelected)
      .sort((a, b) => compareNumericFilenames(a.fileName, b.fileName));

    if (selectedFrames.length === 0) {
      alert("No frames selected! Please checkmark at least one image frame to compile into a sheet.");
      return;
    }

    try {
      const sheetWidth = frameWidth * selectedFrames.length;
      const sheetHeight = frameHeight;

      // Draw horizontal canvas sequence
      const canvas = document.createElement('canvas');
      canvas.width = sheetWidth;
      canvas.height = sheetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure transparent backgrounds are crisp and not filled
      ctx.imageSmoothingEnabled = false;

      let loadedCount = 0;
      const tempImgs: HTMLImageElement[] = [];

      selectedFrames.forEach((frameObj, idx) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          tempImgs[idx] = img;

          if (loadedCount === selectedFrames.length) {
            const reverseCanvas = document.createElement('canvas');
            reverseCanvas.width = sheetWidth;
            reverseCanvas.height = sheetHeight;
            const reverseCtx = reverseCanvas.getContext('2d');
            if (!reverseCtx) return;
            reverseCtx.imageSmoothingEnabled = false;

            tempImgs.forEach((itm, index) => {
              ctx.drawImage(itm, index * frameWidth, 0, frameWidth, frameHeight);

              reverseCtx.save();
              reverseCtx.translate((index + 1) * frameWidth, 0);
              reverseCtx.scale(-1, 1);
              reverseCtx.drawImage(itm, 0, 0, frameWidth, frameHeight);
              reverseCtx.restore();
            });

            triggerSaveSheetState(
              canvas.toDataURL('image/png'),
              reverseCanvas.toDataURL('image/png'),
              sheetWidth,
              sheetHeight,
              selectedFrames.length
            );
          }
        };
        img.src = frameObj.imageSrc;
      });

    } catch (e) {
      console.error("Stitching process failed:", e);
    }
  };

  const triggerSaveSheetState = async (
    sheetDataUrl: string,
    reverseDataUrl: string,
    sheetWidth: number,
    sheetHeight: number,
    finalFrameCount: number
  ) => {
    if (!currentProjectId || !currentProject) return;

    try {
      const sheetBlob = await dataUrlToBlob(sheetDataUrl);
      const reverseBlob = await dataUrlToBlob(reverseDataUrl);

      const { project: updatedProj, sheets: updatedSheets } = await saveProjectSheet(currentProjectId, {
        sheetBlob,
        reverseBlob,
        sheetWidth,
        sheetHeight,
        frameCount: finalFrameCount,
        frameWidth,
        frameHeight,
        fps: currentProject.fps || 10,
      });

      setCurrentProject(updatedProj);
      setEditorSheets(updatedSheets);
      await reloadAllData();
    } catch (e) {
      console.error("Failed storing updated sprite sheet version:", e);
    }
  };

  // Delete project
  const handleDeleteProject = async (id: number) => {
    const ok = confirm("Are you sure you want to completely delete this project and all its associated frames & sheets?");
    if (!ok) return;

    try {
      await deleteProject(id);

      if (currentProjectId === id) {
        setCurrentProjectId(null);
      }

      await reloadAllData();
    } catch (e) {
      console.error("Failed to delete project:", e);
    }
  };

  // Toggle favorite status
  const handleToggleFavorite = async (id: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const proj = projects.find(p => p.id === id);
    if (!proj) return;

    const nextVal = !proj.isFavorite;
    await updateProject(id, { isFavorite: nextVal });
    await reloadAllData();

    if (currentProjectId === id && currentProject) {
      setCurrentProject({ ...currentProject, isFavorite: nextVal });
    }
  };

  // Duplicate project flow (#1)
  const handleDuplicateProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const orig = projects.find(p => p.id === id);
    if (!orig) return;

    try {
      await duplicateProject(id);
      await reloadAllData();
    } catch (err) {
      console.error("Failed to duplicate project:", err);
    }
  };

  // Archive Project Toggle (#1)
  const handleToggleArchiveProject = async (id: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const orig = projects.find(p => p.id === id);
    if (!orig) return;

    const nextStatus = orig.status === 'archived' ? 'active' : 'archived';
    await updateProject(id, { status: nextStatus, updatedAt: Date.now() });
    await reloadAllData();

    if (currentProjectId === id && currentProject) {
      setCurrentProject({ ...currentProject, status: nextStatus });
    }
  };

  // FPS editing tracker
  const handleEditorFpsChange = async (newFps: number) => {
    if (!currentProjectId || !currentProject) return;
    await updateProject(currentProjectId, { fps: newFps });
    setCurrentProject({ ...currentProject, fps: newFps });
    await reloadAllData();
  };

  // Bulk operation triggers (#19)
  const handleToggleBulkSelect = (id: number) => {
    setBulkSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isAnyBulkSelected = useMemo(() => {
    return Object.values(bulkSelectedIds).some(v => v === true);
  }, [bulkSelectedIds]);

  const handleBulkDelete = async () => {
    const selected = Object.keys(bulkSelectedIds).filter(k => bulkSelectedIds[parseInt(k, 10)]).map(k => parseInt(k, 10));
    if (selected.length === 0) return;

    const ok = confirm(`Are you sure you want to bulk-delete all ${selected.length} selected projects? This cannot be undone.`);
    if (!ok) return;

    for (const id of selected) {
      await deleteProject(id);
    }

    setBulkSelectedIds({});
    await reloadAllData();
  };

  const handleBulkArchive = async () => {
    const selected = Object.keys(bulkSelectedIds).filter(k => bulkSelectedIds[parseInt(k, 10)]).map(k => parseInt(k, 10));
    if (selected.length === 0) return;

    for (const id of selected) {
      await updateProject(id, { status: 'archived', updatedAt: Date.now() });
    }

    setBulkSelectedIds({});
    await reloadAllData();
  };

  const handleBulkDownload = async () => {
    const selected = Object.keys(bulkSelectedIds).filter(k => bulkSelectedIds[parseInt(k, 10)]).map(k => parseInt(k, 10));
    if (selected.length === 0) return;

    let idx = 0;
    for (const id of selected) {
      const proj = projects.find(p => p.id === id);
      if (!proj) continue;

      // Find the latest sheet
      const latestSheet = await getProjectSheets(id);

      if (latestSheet && latestSheet.length > 0) {
        const filename = `${proj.name.toLowerCase().replace(/\s+/g, '_')}_sheet.png`;
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = latestSheet[0].sheetSrc;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, idx * 400); // Stagger downloads to prevent browser blocking popups
        idx++;
      }
    }
  };

  // Generator calculations for the Exporter text output
  const activeCoordinates: FrameCoord[] = useMemo(() => {
    if (!currentProject || editorImages.length === 0) return [];
    const selected = editorImages.filter(img => img.isSelected);
    
    return selected.map((img, idx) => ({
      filename: img.fileName,
      x: idx * frameWidth,
      y: 0,
      w: frameWidth,
      h: frameHeight
    }));
  }, [currentProject, editorImages, frameWidth, frameHeight]);

  const activeMetadataOutput = useMemo(() => {
    if (!currentProject || activeCoordinates.length === 0) return '// Please generate spritesheet first';
    const name = currentProject.name;
    const sWidth = frameWidth * activeCoordinates.length;
    const sHeight = frameHeight;

    if (exporterFormat === 'json') {
      return generateJSONExport(name, activeCoordinates, sWidth, sHeight);
    }
    if (exporterFormat === 'xml') {
      return generateXMLExport(name, activeCoordinates, sWidth, sHeight);
    }
    if (exporterFormat === 'unity') {
      return generateUnityExport(name, activeCoordinates, sWidth, sHeight);
    }
    if (exporterFormat === 'godot') {
      return generateGodotExport(name, activeCoordinates, frameWidth, frameHeight);
    }
    if (exporterFormat === 'phaser') {
      return generatePhaserExport(name, activeCoordinates, sWidth, sHeight);
    }
    return '';
  }, [exporterFormat, currentProject, activeCoordinates, frameWidth, frameHeight]);

  const downloadMetadataFile = () => {
    if (!currentProject) return;
    const ext = exporterFormat === 'xml' ? 'xml' : exporterFormat === 'unity' ? 'meta' : exporterFormat === 'godot' ? 'tres' : 'json';
    const filename = `${currentProject.name.toLowerCase().replace(/\s+/g, '_')}_atlas.${ext}`;
    
    const blob = new Blob([activeMetadataOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Inline copy utility
  const handleCopyMetadata = () => {
    navigator.clipboard.writeText(activeMetadataOutput);
    alert("Metadata schema copied to your clipboard!");
  };

  // Single sheet download target helper
  const handleDownloadSingleSheet = (sheet: ProjectSheet, name: string, reversed = false) => {
    const src = reversed ? sheet.reverseSheetSrc : sheet.sheetSrc;
    if (!src) return;
    const suffix = reversed ? '_reverse' : '';
    const filename = `${name.toLowerCase().replace(/\s+/g, '_')}_sheet${suffix}.png`;
    const a = document.createElement('a');
    a.href = src;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* Visual Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0 sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-white">S</div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight text-white flex items-center gap-2">
              SpriteSheet <span className="text-indigo-400">Pro</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-700/60 font-medium">v2.0</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
            <span className="text-[11px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 hidden md:inline">
              SQLite + File Storage
            </span>
            {currentProjectId !== null && (
              <button
                onClick={() => setCurrentProjectId(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-sm font-medium border border-slate-700 flex items-center gap-2 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-9 h-9 animate-spin text-indigo-500 mb-4" />
            <h2 className="text-sm font-semibold text-slate-300">Connecting to server...</h2>
            {seedInProgress && <span className="text-xs text-slate-500 mt-1">Initializing SQLite database...</span>}
          </div>
        ) : (
          <>
            {currentProjectId === null ? (
              /* ==================== DASHBOARD & PROJECTS MANAGER ==================== */
              <div className="flex flex-col gap-8">
                
                {/* Stats Widgets Panel */}
                <section className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
                    <div className="p-2.5 bg-indigo-950/40 text-indigo-400 rounded-lg">
                      <FolderPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Projects</span>
                      <span className="font-display text-lg font-bold text-white">{stats.totalProjectsCount}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-950/40 text-emerald-400 rounded-lg">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stitched Sheets</span>
                      <span className="font-display text-lg font-bold text-white">{stats.totalGeneratedSheets}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
                    <div className="p-2.5 bg-amber-950/40 text-amber-400 rounded-lg">
                      <Grid className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Frame Clips</span>
                      <span className="font-display text-lg font-bold text-white">{stats.totalFrames}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
                    <div className="p-2.5 bg-pink-950/40 text-pink-400 rounded-lg">
                      <Star className="w-5 h-5 fill-pink-500/20" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Starred Favorites</span>
                      <span className="font-display text-lg font-bold text-white">{stats.favoriteCount}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5 col-span-2 lg:col-span-1">
                    <div className="p-2.5 bg-violet-950/40 text-violet-400 rounded-lg">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Engine Sandbox</span>
                      <span className="font-display text-[11px] font-bold text-emerald-400">HIGH-PERFORMANCE</span>
                    </div>
                  </div>
                </section>

                {/* Search & Filtering Panel */}
                <section className="bg-slate-900/35 border border-slate-800/80 p-5 rounded-2xl flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-3.5 justify-between">
                    
                    {/* Search field */}
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search workspace by project name, category, or dimensions (e.g. 64x64)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 focus:border-indigo-600 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition"
                      />
                    </div>

                    {/* Left Actions - Add New & Sort dropdowns */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                      <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 hover:border-slate-700 cursor-pointer"
                      >
                        <option value="updated">Recently Opened</option>
                        <option value="created">Created Date</option>
                        <option value="name">Alphabetical (A-Z)</option>
                        <option value="frames">Frame Count (Highest)</option>
                      </select>

                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition hover:shadow-lg hover:shadow-indigo-900/20 active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Create Project
                      </button>
                    </div>
                  </div>

                  {/* Filter Subrails */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-4 text-xs font-semibold">
                    <span className="text-slate-400 tracking-wider text-[11px] uppercase mr-2 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3 h-3 text-indigo-400" /> Filters:
                    </span>

                    {/* Status Tabs */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-0.5 flex">
                      <button
                        onClick={() => setStatusFilter('active')}
                        className={`px-3 py-1 text-[11px] rounded ${statusFilter === 'active' ? 'bg-indigo-600 font-bold text-white' : 'text-slate-400 hover:text-slate-200'} transition cursor-pointer`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => setStatusFilter('archived')}
                        className={`px-3 py-1 text-[11px] rounded ${statusFilter === 'archived' ? 'bg-indigo-600 font-bold text-white' : 'text-slate-400 hover:text-slate-200'} transition cursor-pointer`}
                      >
                        Archived
                      </button>
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1 text-[11px] rounded ${statusFilter === 'all' ? 'bg-indigo-600 font-bold text-white' : 'text-slate-400 hover:text-slate-200'} transition cursor-pointer`}
                      >
                        All
                      </button>
                    </div>

                    {/* Starred Switcher */}
                    <button
                      onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                      className={`px-3.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                        showFavoritesOnly 
                          ? 'bg-amber-600/10 border-amber-500/40 text-amber-300 font-bold' 
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
                      Favorites Only
                    </button>

                    {/* Categories dropdown */}
                    <select
                      value={activeCategoryFilter || ''}
                      onChange={(e) => setActiveCategoryFilter(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                      className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none hover:border-slate-700 cursor-pointer"
                    >
                      <option value="">All Categories</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    {/* Frame count filter shortcut */}
                    <select
                      value={frameCountFilter || ''}
                      onChange={(e) => setFrameCountFilter(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                      className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none hover:border-slate-700 cursor-pointer"
                    >
                      <option value="">Any Frame Count</option>
                      <option value="4">4 Frames</option>
                      <option value="6">6 Frames</option>
                      <option value="8">8 Frames</option>
                      <option value="12">12 Frames</option>
                    </select>

                    {(activeCategoryFilter !== null || showFavoritesOnly || statusFilter !== 'active' || frameCountFilter !== null || searchQuery !== '') && (
                      <button
                        onClick={() => {
                          setActiveCategoryFilter(null);
                          setShowFavoritesOnly(false);
                          setStatusFilter('active');
                          setFrameCountFilter(null);
                          setSearchQuery('');
                        }}
                        className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900/40 rounded-lg px-3 py-1 hover:bg-rose-950/50 transition flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        <X className="w-3 h-3" />
                        Clear Filter
                      </button>
                    )}
                  </div>
                </section>

                {/* Bulk Operations Toolbar (#19) */}
                {isAnyBulkSelected && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-indigo-950/25"
                  >
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></span>
                      <strong className="text-slate-100">
                        {Object.values(bulkSelectedIds).filter(v => v).length} Projects Selected
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleBulkDownload}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Download latest sheets sequentially"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        Download Selected
                      </button>

                      <button
                        onClick={handleBulkArchive}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5 text-amber-400" />
                        Archive Selected
                      </button>

                      <button
                        onClick={handleBulkDelete}
                        className="px-3.5 py-1.5 bg-rose-900/20 hover:bg-rose-900/40 border border-rose-800/45 text-rose-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        Delete Selected
                      </button>

                      <button
                        onClick={() => setBulkSelectedIds({})}
                        className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 text-xs text-center transition cursor-pointer"
                      >
                        Deselect
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Projects Display Matrix */}
                <section className="flex flex-col gap-6">
                  {paginatedProjects.length === 0 ? (
                    <div className="bg-slate-900/30 border border-slate-800 rounded-2xl py-20 px-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full">
                      <Inbox className="w-12 h-12 text-slate-700 mb-4" />
                      <p className="text-base font-semibold text-slate-300">No projects match your active selection</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">Try searching for other tags, choosing a different category filter, or clear active sorting parameter guidelines.</p>
                      <button
                        onClick={() => {
                          setActiveCategoryFilter(null);
                          setShowFavoritesOnly(false);
                          setStatusFilter('active');
                          setSearchQuery('');
                          setFrameCountFilter(null);
                        }}
                        className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Reset Workspace
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {paginatedProjects.map((p) => {
                        const projCat = categories.find(c => c.id === p.categoryId)?.name || 'Unassigned';
                        return (
                          <motion.div
                            key={p.id}
                            layout
                            className={`group relative bg-slate-900/70 hover:bg-slate-900 border ${
                              p.status === 'archived' ? 'border-dashed border-slate-800 opacity-70' : 'border-slate-800/90 hover:border-indigo-500/50'
                            } rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col`}
                          >
                            
                            {/* Card Header Media area */}
                            <div className="relative h-44 bg-slate-950 transparent-grid flex items-center justify-center border-b border-slate-950">
                              {p.coverImage && p.coverImage !== '' ? (
                                <img
                                  src={p.coverImage}
                                  alt={p.name}
                                  className="max-h-36 max-w-[85%] pixelated object-contain transition-transform group-hover:scale-110 duration-200 pointer-events-none"
                                />
                              ) : (
                                <div className="text-slate-600 flex flex-col items-center justify-center gap-1 text-[11px]">
                                  <ImageIcon className="w-7 h-7" />
                                  <span>No Images Yet</span>
                                </div>
                              )}

                              {/* Multi selection checkbox overlay */}
                              <div className="absolute top-3 left-3 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (p.id) handleToggleBulkSelect(p.id);
                                  }}
                                  className="text-slate-400 hover:text-white transition selection:bg-transparent"
                                >
                                  {bulkSelectedIds[p.id || 0] ? (
                                    <CheckSquare className="w-5 h-5 text-indigo-400 fill-indigo-950/80" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-600 fill-slate-950/80 hover:text-slate-500" />
                                  )}
                                </button>
                              </div>

                              {/* Action Overlays for star rating */}
                              <div className="absolute top-3 right-3 z-10 flex gap-1.5">
                                <button
                                  onClick={(e) => handleToggleFavorite(p.id!, e)}
                                  className="p-1.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition"
                                >
                                  <Star className={`w-3.5 h-3.5 ${p.isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
                                </button>
                              </div>

                              {/* Category Badge overlay bottom */}
                              <div className="absolute bottom-3 left-3">
                                <span className="px-2 py-0.5 bg-slate-950/95 border border-slate-800 text-[10px] font-bold uppercase tracking-wider text-indigo-400 rounded-md">
                                  {projCat}
                                </span>
                              </div>

                              {/* Size spec display bottom-right */}
                              {p.frameWidth && (
                                <span className="absolute bottom-3 right-3 px-2 py-0.5 bg-slate-950/80 font-mono text-[9px] text-slate-400 rounded border border-slate-800">
                                  {p.frameWidth}x{p.frameHeight} px
                                </span>
                              )}
                            </div>

                            {/* Card Content parameters */}
                            <div className="p-4.5 flex-1 flex flex-col justify-between gap-3.5">
                              <div>
                                <h3 className="font-display font-semibold text-slate-100 group-hover:text-white text-sm line-clamp-1 flex items-center gap-1.5">
                                  {p.name}
                                  {p.status === 'archived' && (
                                    <span className="text-[9px] bg-slate-800 text-slate-500 px-1 py-0.5 rounded font-bold uppercase tracking-widest border border-slate-700/50">Archived</span>
                                  )}
                                </h3>
                                <p className="text-slate-400 text-xs mt-1 line-clamp-2 min-h-8">
                                  {p.description || 'No description established.'}
                                </p>
                              </div>

                              {/* Details Summary Row */}
                              <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-lg border border-slate-800/50 text-[10px] text-slate-400">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500">Clip Frames</span>
                                  <span className="font-mono text-[11px] font-semibold text-slate-200">{p.frameCount || 0} slots</span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500">Sheet</span>
                                  <span className="font-mono text-[11px] font-semibold text-emerald-400">
                                    {p.version > 0 ? 'Ready' : '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Action options bar */}
                              <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs gap-1">
                                <button
                                  onClick={() => setCurrentProjectId(p.id!)}
                                  className="flex-1 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  View & Stitch
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>

                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={(e) => handleDuplicateProject(p.id!, e)}
                                    className="p-1.5 bg-slate-800/40 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 border border-slate-800 transition"
                                    title="Duplicate Project"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleToggleArchiveProject(p.id!, e)}
                                    className="p-1.5 bg-slate-800/40 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-500 border border-slate-800 transition"
                                    title={p.status === 'archived' ? 'Unarchive Project' : 'Archive Project'}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProject(p.id!)}
                                    className="p-1.5 bg-slate-800/40 hover:bg-rose-950/40 rounded-lg text-slate-400 hover:text-rose-400 border border-slate-800 transition"
                                    title="Delete Project"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Active Pagination Control Panel */}
                  {filteredProjects.length > itemsPerPage && (
                    <div className="flex items-center justify-center gap-2 border-t border-slate-900 pt-5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        Prev
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentPage(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            currentPage === idx 
                              ? 'bg-indigo-600 text-white border-indigo-600' 
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
                          } transition cursor-pointer`}
                        >
                          {idx}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </section>

              </div>
            ) : (
              /* ==================== PROJECT EDITOR VIEW ==================== */
              <div className="flex flex-col gap-6">
                
                {/* Custom Breadcrumb Details Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCurrentProjectId(null)}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition cursor-pointer"
                      title="Back to Dashboard"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="font-display font-bold text-lg text-white">{currentProject?.name}</h2>
                        <button 
                          onClick={() => handleToggleFavorite(currentProjectId)}
                          className="text-slate-400 hover:text-amber-400 transition"
                        >
                          <Star className={`w-4 h-4 ${currentProject?.isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-xl">{currentProject?.description || 'No description assigned.'}</p>
                    </div>
                  </div>

                  {/* Actions right corner */}
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleToggleArchiveProject(currentProjectId)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition text-slate-300 cursor-pointer animate-none"
                    >
                      <Archive className="w-3.5 h-3.5 text-amber-500" />
                      {currentProject?.status === 'archived' ? 'Unarchive' : 'Archive Project'}
                    </button>
                    <button
                      onClick={() => handleDeleteProject(currentProjectId)}
                      className="px-3.5 py-1.5 bg-rose-950/20 hover:bg-rose-950/45 border border-rose-900/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      Delete Project
                    </button>
                  </div>
                </div>

                {/* Main Split Workstage Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">

                  {/* Left Sidebar Panel - Tags & Version History (lg:col-span-3) */}
                  <div className="lg:col-span-3 flex flex-col gap-5">
                    
                    {/* Tags sub-manager */}
                    <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-lg flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Project Tags</label>
                        <p className="text-[9px] text-slate-500 mb-2">Press ENTER to commit keytags</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 items-center bg-slate-950 p-2 border border-slate-800 rounded focus-within:border-indigo-600 transition">
                        {editorTags.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-800 text-[10px] rounded border border-slate-700 text-slate-300 flex items-center gap-1">
                            #{t}
                            <button onClick={() => handleRemoveEditorTag(t)} className="text-slate-500 hover:text-rose-400">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="tag..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={handleAddEditorTag}
                          className="flex-1 min-w-[50px] bg-transparent text-[11px] font-mono border-none focus:outline-none focus:ring-0 p-0.5 placeholder-slate-600 text-indigo-400"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Center Column - Canvas & Grid Frame Manager (lg:col-span-6) */}
                  <div className="lg:col-span-6 flex flex-col gap-6">
                    
                    {/* Integrated Upload Area */}
                    <div className="bg-slate-950 border border-slate-900 p-4 rounded-lg flex flex-col gap-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block animate-none">Add Images</label>
                      <UploadZone
                        onFilesSelected={handleAddImages}
                        uploading={uploadingImages}
                      />
                    </div>

                    {/* Image Grid Frame sequence list */}
                    <div className="bg-slate-950 border border-slate-905 p-4 rounded-lg flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-900 pb-2.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                          Clip Frame Grid ({editorImages.length} items)
                        </label>

                        {/* Selection aids */}
                        <div className="flex items-center gap-2 text-[10px] flex-wrap justify-end">
                          <button
                            onClick={handleSortImagesByName}
                            className="text-amber-400 hover:underline cursor-pointer"
                            title="Sort frames by number in filename (0001 → 0033)"
                          >
                            Auto Sort
                          </button>
                          <span className="text-slate-850">|</span>
                          <button
                            onClick={() => handleSelectAllImages(true)}
                            className="text-indigo-400 hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-850">|</span>
                          <button
                            onClick={() => handleSelectAllImages(false)}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {editorImages.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-slate-700 mb-2" />
                          <p className="text-xs">This project has no frames yet.</p>
                          <p className="text-[10px] text-slate-500 mt-1">Drag files or use instructions container above.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          {editorImages.map((img, idx) => (
                            <div
                              key={img.id}
                              className={`bg-slate-900 border rounded-lg p-3 group flex flex-col justify-between transition-all ${
                                img.isSelected 
                                  ? 'border-indigo-500/30' 
                                  : 'border-slate-850 opacity-65'
                              }`}
                            >
                              
                              {/* Stage render with indicators matching Mockup styling */}
                              <div className="aspect-square bg-slate-800 rounded-md border border-slate-700 mb-2 relative overflow-hidden flex items-center justify-center transparent-grid">
                                <img
                                  src={img.imageSrc}
                                  alt={img.fileName}
                                  className="max-h-[85%] max-w-[85%] pixelated object-contain pointer-events-none"
                                />

                                {/* Format / Number indicators inside mockup shape */}
                                <div className="absolute inset-y-0 inset-x-0 pointer-events-none flex items-center justify-center opacity-35">
                                  <div className="w-12 h-12 border-2 border-slate-650 border-dashed rounded-full flex items-center justify-center text-slate-500 text-xs font-mono font-bold">
                                    {String(idx + 1).padStart(2, '0')}
                                  </div>
                                </div>

                                <input
                                  type="checkbox"
                                  checked={img.isSelected || false}
                                  onChange={(e) => handleImageSelectToggle(img.id!, e.target.checked)}
                                  className="absolute top-2 left-2 rounded bg-slate-700 border-slate-600 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  title="Include in sheet"
                                />

                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-[8px] rounded text-slate-300 font-mono">
                                  {frameWidth}x{frameHeight}
                                </span>
                              </div>

                              {/* Label structure exactly like mockup */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-slate-400 truncate max-w-[90px]" title={img.fileName}>
                                  {img.fileName}
                                </span>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleMoveFrame(idx, 'left')}
                                    disabled={idx === 0}
                                    className="p-1 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-400 hover:text-white"
                                    title="Move Frame Left"
                                  >
                                    <MoveLeft className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveFrame(idx, 'right')}
                                    disabled={idx === editorImages.length - 1}
                                    className="p-1 hover:bg-slate-800 disabled:opacity-20 rounded text-slate-400 hover:text-white"
                                    title="Move Frame Right"
                                  >
                                    <MoveRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteImage(img.id!)}
                                    className="p-1 hover:bg-rose-950/30 rounded text-slate-500 hover:text-rose-400"
                                    title="Delete Frame"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Settings Inspector & Exporters (lg:col-span-3) */}
                  <div className="lg:col-span-3 flex flex-col gap-5">
                    
                    {/* Size and Resize parameter configuration panel */}
                    <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg flex flex-col gap-4">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Resize Settings</label>

                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 mb-1 block">Width</label>
                          <input
                            type="number"
                            min="4"
                            max="4096"
                            value={frameWidth}
                            onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                            className="w-full bg-slate-800 border-slate-750 text-indigo-400 rounded text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                          />
                        </div>
                        <div className="pt-4 text-slate-600 font-mono">×</div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 mb-1 block">Height</label>
                          <input
                            type="number"
                            min="4"
                            max="4096"
                            value={frameHeight}
                            onChange={(e) => handleHeightChange(parseInt(e.target.value, 10))}
                            className="w-full bg-slate-800 border-slate-750 text-indigo-400 rounded text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                          />
                        </div>
                      </div>

                      {/* Aspect Ratio Constraint */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={lockAspect}
                          onChange={toggleLockAspect}
                          id="lock-aspect"
                          className="rounded bg-slate-700 border-slate-600 text-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <label htmlFor="lock-aspect" className="text-xs text-slate-400 cursor-pointer select-none">
                          Lock Aspect Ratio
                        </label>
                      </div>

                      {/* CREATE SPRITE SHEET BUTTON */}
                      <button
                        onClick={handleStitchSpriteSheet}
                        disabled={editorImages.length === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-md text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/20 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        Create Sprite Sheet
                      </button>
                      {editorSheets.length > 0 && (
                        <p className="text-[9px] text-slate-500 text-center">
                          Regenerating replaces the previous sprite sheet.
                        </p>
                      )}
                    </div>

                    {editorSheets.length > 0 && (
                      <div className="p-3 bg-indigo-500/5 rounded border border-indigo-500/20 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase">Output Preview</span>
                          <span className="text-[9px] text-slate-500 font-mono truncate max-w-[140px]">
                            {currentProject?.name.toLowerCase().replace(/\s+/g, '_')}_sheet.png
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">Facing Right</span>
                            <div className="h-20 bg-slate-950 rounded border border-slate-800 flex items-center justify-center p-1.5 transparent-grid overflow-hidden">
                              <img
                                src={editorSheets[0]?.sheetSrc}
                                alt="Sprite sheet facing right"
                                className="max-h-full max-w-full pixelated object-contain"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">Facing Left (Reverse)</span>
                            <div className="h-20 bg-slate-950 rounded border border-slate-800 flex items-center justify-center p-1.5 transparent-grid overflow-hidden">
                              <img
                                src={editorSheets[0]?.reverseSheetSrc || editorSheets[0]?.sheetSrc}
                                alt="Sprite sheet facing left"
                                className="max-h-full max-w-full pixelated object-contain"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownloadSingleSheet(editorSheets[0], currentProject?.name || 'sheet', false)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-md text-sm font-bold transition-colors shadow-lg shadow-emerald-900/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          Download Sprite Sheet — Facing Right
                        </button>

                        <button
                          onClick={() => handleDownloadSingleSheet(editorSheets[0], currentProject?.name || 'sheet', true)}
                          disabled={!editorSheets[0]?.reverseSheetSrc}
                          className="w-full bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-md text-sm font-bold transition-colors shadow-lg shadow-violet-900/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <FlipHorizontal className="w-4 h-4" />
                          Download Sprite Sheet — Facing Left (Reverse)
                        </button>
                      </div>
                    )}

                    {/* Exporters specifications report */}
                    {editorSheets.length > 0 && (
                      <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg flex flex-col gap-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Export Details</label>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Format</span>
                            <span className="font-medium text-slate-350">PNG 32-bit</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Total Size</span>
                            <span className="font-medium font-mono text-slate-300">{editorSheets[0]?.sheetWidth} × {editorSheets[0]?.sheetHeight} px</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Frame Count</span>
                            <span className="font-medium font-mono text-slate-300">{editorSheets[0]?.frameCount} frames</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Integrated Metadata Atlas Exporters */}
                    {editorSheets.length > 0 && (
                      <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-lg flex flex-col gap-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Engine Metadata</label>

                        {/* Format selector */}
                        <div className="grid grid-cols-5 gap-0.5 bg-slate-950 p-0.5 border border-slate-800 rounded">
                          {['json', 'xml', 'unity', 'godot', 'phaser'].map((fmt) => (
                            <button
                              key={fmt}
                              onClick={() => setExporterFormat(fmt as any)}
                              className={`py-0.5 rounded text-[8px] font-bold uppercase transition select-none tracking-wider ${
                                exporterFormat === fmt 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'text-slate-500 hover:text-slate-300'
                              } cursor-pointer`}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>

                        {/* Export block */}
                        <div className="relative mt-1">
                          <pre className="p-2.5 bg-slate-950 rounded border border-slate-900 text-[9px] font-mono text-indigo-400 overflow-x-auto max-h-32 overflow-y-auto">
                            <code>{activeMetadataOutput}</code>
                          </pre>
                          
                          <div className="absolute right-2 bottom-2 flex items-center gap-1">
                            <button
                              onClick={handleCopyMetadata}
                              className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition"
                              title="Copy Code"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={downloadMetadataFile}
                              className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition"
                              title="Download coordinates schema"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Animation live preview player box (placed at the bottom of Right Column) */}
                    <AnimationPreview
                      sheetSrc={editorSheets[0]?.sheetSrc || ''}
                      frameCount={editorSheets[0]?.frameCount || 0}
                      frameWidth={editorSheets[0]?.frameWidth || 64}
                      frameHeight={editorSheets[0]?.frameHeight || 64}
                      sheetWidth={editorSheets[0]?.sheetWidth}
                      sheetHeight={editorSheets[0]?.sheetHeight}
                      initialFps={currentProject?.fps || 10}
                      onFpsChange={handleEditorFpsChange}
                    />

                  </div>

                </div>

              </div>
            )}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 mt-20 bg-slate-950 py-10 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 Sprite Sheet Manager. Data stored in SQLite; images and sprite sheets saved to disk.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-300">Unity Companion</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-300">Godot Parser</a>
            <span>•</span>
            <a href="#" className="hover:text-slate-300">Texture Atlas Spec v1.1</a>
          </div>
        </div>
      </footer>

      {/* ==================== CREATE NEW PROJECT MODAL OVERLAY ==================== */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="font-display font-bold text-lg text-white mb-1.5 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-400 animate-pulse" />
                Create New Project
              </h3>
              <p className="text-xs text-slate-400 mb-5">Create a workspace to host clip frames, adjust dimensions, and stitch horizontal sprite sheet outputs.</p>

              <div className="flex flex-col gap-4">
                
                {/* Project Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Project Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Hero Running Animation"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief definition or details about frames sequencing behavior..."
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 resize-none"
                  />
                </div>

                {/* Grid Category selection */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Category Organization</label>
                    <select
                      value={newProjectCategory}
                      onChange={(e) => setNewProjectCategory(parseInt(e.target.value, 10))}
                      className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none hover:border-slate-700 cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Add Tag prompts */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">Search Tags</label>
                    <input
                      type="text"
                      placeholder="e.g. idle, running, player"
                      value={newProjectTagsInput}
                      onChange={(e) => setNewProjectTagsInput(e.target.value)}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-600 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                    <span className="text-[10px] text-slate-500">Comma separated words</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-4">
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 rounded-xl text-xs font-bold border border-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewProject}
                    disabled={newProjectName.trim() === ''}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-40"
                  >
                    Create Workspace
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
