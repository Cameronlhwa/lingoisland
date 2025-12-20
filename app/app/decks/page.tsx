"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface Folder {
  id: string;
  name: string;
  created_at: string;
}

interface Deck {
  id: string;
  name: string;
  folder_id: string | null;
  created_at: string;
  folder: {
    id: string;
    name: string;
  } | null;
}

export default function DecksPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [deckName, setDeckName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [foldersRes, decksRes] = await Promise.all([
        fetch("/api/folders"),
        fetch("/api/decks"),
      ]);

      if (!foldersRes.ok || !decksRes.ok) {
        throw new Error("Failed to load data");
      }

      const foldersData = await foldersRes.json();
      const decksData = await decksRes.json();

      setFolders(foldersData.folders || []);
      setDecks(decksData.decks || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create folder");
      }

      const data = await response.json();
      setFolders([...folders, data.folder]);
      setFolderName("");
      setShowFolderModal(false);
    } catch (error) {
      console.error("Error creating folder:", error);
      alert(error instanceof Error ? error.message : "Failed to create folder");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deckName,
          folderId: selectedFolderId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create deck");
      }

      const data = await response.json();
      setDecks([...decks, data.deck]);
      setDeckName("");
      setSelectedFolderId(null);
      setShowDeckModal(false);
    } catch (error) {
      console.error("Error creating deck:", error);
      alert(error instanceof Error ? error.message : "Failed to create deck");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Group decks by folder
  const decksByFolder = decks.reduce((acc, deck) => {
    const folderKey = deck.folder_id || "uncategorized";
    if (!acc[folderKey]) {
      acc[folderKey] = {
        folder: deck.folder,
        decks: [],
      };
    }
    acc[folderKey].decks.push(deck);
    return acc;
  }, {} as Record<string, { folder: { id: string; name: string } | null; decks: Deck[] }>);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-12 text-4xl font-bold tracking-tight text-gray-900">
          {t("Deck Manager")}
        </h1>

        {/* Folders Section */}
        <div className="mb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t("Folders")}</h2>
            <button
              onClick={() => setShowFolderModal(true)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
            >
              + {t("New Folder")}
            </button>
          </div>

          {folders.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                >
                  <div className="text-base font-medium text-gray-900">
                    {folder.name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
              <p className="text-gray-500">
                No folders yet. Create one to organize your decks.
              </p>
            </div>
          )}
        </div>

        {/* Decks Section */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t("Decks")}</h2>
            <button
              onClick={() => setShowDeckModal(true)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
            >
              + {t("New Deck")}
            </button>
          </div>

          {Object.keys(decksByFolder).length > 0 ? (
            <div className="space-y-8">
              {Object.entries(decksByFolder).map(([folderKey, group]) => (
                <div key={folderKey}>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {group.folder ? group.folder.name : t("Uncategorized")}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.decks.map((deck) => (
                      <div
                        key={deck.id}
                        className="group rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                      >
                        <button
                          onClick={() => router.push(`/app/decks/${deck.id}`)}
                          className="mb-3 w-full text-left"
                        >
                          <div className="text-base font-medium text-gray-900 group-hover:text-gray-950">
                            {deck.name}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/quiz?deckId=${deck.id}`);
                          }}
                          className="w-full rounded-lg border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
                        >
                          {t("Quiz")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
              <p className="text-gray-500">
                No decks yet. Create one to start adding flashcards.
              </p>
            </div>
          )}
        </div>

        {/* Create Folder Modal */}
        {showFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="mb-6 text-xl font-semibold text-gray-900">
                {t("Create Folder")}
              </h3>
              <form onSubmit={handleCreateFolder}>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="mb-6 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  autoFocus
                />
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFolderModal(false);
                      setFolderName("");
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !folderName.trim()}
                    className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    {creating ? t("Creating...") : t("Create")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Deck Modal */}
        {showDeckModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="mb-6 text-xl font-semibold text-gray-900">
                {t("Create Deck")}
              </h3>
              <form onSubmit={handleCreateDeck}>
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Deck name"
                  className="mb-4 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  autoFocus
                />
                <select
                  value={selectedFolderId || ""}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  className="mb-6 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="">{t("No folder (uncategorized)")}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeckModal(false);
                      setDeckName("");
                      setSelectedFolderId(null);
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !deckName.trim()}
                    className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    {creating ? t("Creating...") : t("Create")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
