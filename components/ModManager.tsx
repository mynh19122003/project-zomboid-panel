"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Mod } from "@/types";
import { formatFileSize, formatDate } from "@/lib/utils";
import { storeToastForReload } from "./Toast";

interface ModManagerProps {
  serverPath: string;
}

export default function ModManager({ serverPath }: ModManagerProps) {
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [disabledMods, setDisabledMods] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (serverPath) {
      loadMods();
    }
  }, [serverPath]);

  const loadMods = async () => {
    if (!serverPath) return;

    setLoading(true);
    setImageErrors(new Set()); // Reset image errors
    try {
      const response = await axios.get("/api/mods", {
        params: { serverPath },
      });
      const loadedMods = response.data.mods || [];
      setMods(loadedMods);

      // Tự động load thông tin chi tiết cho các workshop mods
      await loadModDetails(loadedMods);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Không thể tải mod list",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadModDetails = async (modsToLoad: Mod[]) => {
    // Lấy danh sách workshop IDs (chỉ lấy các ID là số)
    const workshopIds = modsToLoad
      .map((mod) => mod.workshopId || (mod.id.match(/^\d+$/) ? mod.id : null))
      .filter((id): id is string => id !== null);

    if (workshopIds.length === 0) {
      console.log("Không có workshop mods để tải thông tin");
      return;
    }

    console.log(
      "Đang tải thông tin cho",
      workshopIds.length,
      "workshop mods:",
      workshopIds
    );

    setLoadingDetails(true);
    try {
      const response = await axios.post("/api/mods/details", {
        modIds: workshopIds,
      });

      console.log("Response từ API:", response.data);

      const detailsMap = response.data.mods || {};

      if (Object.keys(detailsMap).length === 0) {
        console.warn("Không có thông tin mod nào được trả về từ Steam API");
        setMessage({
          type: "error",
          text: "Không thể tải thông tin mod từ Steam. Kiểm tra Steam API key và kết nối internet.",
        });
        setTimeout(() => setMessage(null), 5000);
      }

      // Cập nhật mods với thông tin chi tiết
      setMods((prevMods) =>
        prevMods.map((mod) => {
          const workshopId =
            mod.workshopId || (mod.id.match(/^\d+$/) ? mod.id : null);
          if (workshopId && detailsMap[workshopId]) {
            const detail = detailsMap[workshopId];
            console.log(
              "Cập nhật mod:",
              workshopId,
              "Mod ID:",
              detail.modId || "không tìm thấy"
            );
            return {
              ...mod,
              details: detail,
              name: detail.title || mod.name,
              // Lưu Mod ID nếu được parse từ description
              modId: detail.modId || mod.modId,
            };
          }
          return mod;
        })
      );
    } catch (error: any) {
      console.error("Failed to load mod details:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "Lỗi không xác định";
      setMessage({
        type: "error",
        text: `Không thể tải thông tin mod: ${errorMessage}`,
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoadingDetails(false);
    }
  };

  const saveMods = async () => {
    if (!serverPath) {
      setMessage({ type: "error", text: "Vui lòng nhập đường dẫn server" });
      return;
    }

    // Chỉ lưu các mods đang Active (không bị disabled)
    const activeMods = mods.filter((m) => !disabledMods.has(m.id));
    const disabledCount = disabledMods.size;

    setSaving(true);
    try {
      await axios.post("/api/mods", {
        serverPath,
        mods: activeMods, // Chỉ gửi active mods
      });

      // Lưu toast vào localStorage và reload trang
      const message =
        disabledCount > 0
          ? `Đã lưu ${activeMods.length} mod (${disabledCount} mod bị tắt không được lưu)`
          : `Đã lưu mod list thành công! (${activeMods.length} mods)`;

      storeToastForReload({
        message,
        type: "success",
      });
      window.location.reload();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Không thể lưu mod list",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeMod = (index: number) => {
    const modId = mods[index].id;
    setMods((prev) => prev.filter((_, i) => i !== index));
    setSelectedMods((prev) => {
      const newSet = new Set(prev);
      newSet.delete(modId);
      return newSet;
    });
  };

  // Toggle selection of a single mod
  const toggleSelectMod = (modId: string) => {
    setSelectedMods((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(modId)) {
        newSet.delete(modId);
      } else {
        newSet.add(modId);
      }
      return newSet;
    });
  };

  // Select/deselect all mods
  const toggleSelectAll = () => {
    if (selectedMods.size === mods.length) {
      setSelectedMods(new Set());
    } else {
      setSelectedMods(new Set(mods.map((m) => m.id)));
    }
  };

  // Toggle disable/enable a mod
  const toggleDisableMod = (modId: string) => {
    setDisabledMods((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(modId)) {
        newSet.delete(modId);
      } else {
        newSet.add(modId);
      }
      return newSet;
    });
  };

  // Bulk delete selected mods
  const deleteSelectedMods = () => {
    if (selectedMods.size === 0) return;
    setMods((prev) => prev.filter((m) => !selectedMods.has(m.id)));
    setSelectedMods(new Set());
    setMessage({ type: "success", text: `Đã xóa ${selectedMods.size} mod` });
    setTimeout(() => setMessage(null), 3000);
  };

  // Bulk open selected mods in Steam
  const openSelectedInSteam = () => {
    const workshopMods = mods.filter(
      (m) => selectedMods.has(m.id) && (m.workshopId || /^\d+$/.test(m.id))
    );
    workshopMods.forEach((mod) => {
      const workshopId = mod.workshopId || mod.id;
      window.open(
        `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`,
        "_blank"
      );
    });
  };

  // Bulk toggle disable selected mods
  const toggleDisableSelected = () => {
    const allDisabled = Array.from(selectedMods).every((id) =>
      disabledMods.has(id)
    );
    if (allDisabled) {
      // Enable all selected
      setDisabledMods((prev) => {
        const newSet = new Set(prev);
        selectedMods.forEach((id) => newSet.delete(id));
        return newSet;
      });
    } else {
      // Disable all selected
      setDisabledMods((prev) => {
        const newSet = new Set(prev);
        selectedMods.forEach((id) => newSet.add(id));
        return newSet;
      });
    }
  };

  const [showAddModDialog, setShowAddModDialog] = useState(false);
  const [addModInput, setAddModInput] = useState("");
  const [addModType, setAddModType] = useState<
    "id" | "name" | "link" | "collection"
  >("id");
  const [searchingMod, setSearchingMod] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [collectionItems, setCollectionItems] = useState<any[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [selectedCollectionMods, setSelectedCollectionMods] = useState<
    Set<string>
  >(new Set());

  const parseWorkshopLink = async (link: string): Promise<string | null> => {
    try {
      const response = await axios.get("/api/steam-workshop/parse-link", {
        params: { link },
      });
      return response.data.workshopId || null;
    } catch (error) {
      console.error("Parse link error:", error);
      return null;
    }
  };

  const searchModByName = async (name: string) => {
    setSearchingMod(true);
    try {
      const response = await axios.get("/api/steam-workshop", {
        params: {
          action: "search",
          query: name,
          sortBy: "subscriptions", // Sắp xếp theo số subscriptions (phổ biến nhất)
          limit: 30, // Lấy 30 kết quả
        },
      });

      if (
        response.data.success &&
        response.data.response?.publishedfiledetails
      ) {
        // Kết quả đã được sắp xếp theo subscriptions từ API
        setSearchResults(response.data.response.publishedfiledetails);
        if (response.data.response.publishedfiledetails.length === 0) {
          setMessage({
            type: "error",
            text: "Không tìm thấy mod nào với tên này",
          });
        }
      } else {
        setSearchResults([]);
        setMessage({
          type: "error",
          text: "Không tìm thấy mod nào với tên này",
        });
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Lỗi khi tìm kiếm mod",
      });
      setSearchResults([]);
    } finally {
      setSearchingMod(false);
    }
  };

  const handleAddMod = async () => {
    if (!addModInput.trim()) {
      setMessage({ type: "error", text: "Vui lòng nhập thông tin mod" });
      return;
    }

    let workshopId: string | null = null;

    if (addModType === "id") {
      // Nếu là số, đó là workshop ID
      if (/^\d+$/.test(addModInput.trim())) {
        workshopId = addModInput.trim();
      } else {
        setMessage({ type: "error", text: "Workshop ID phải là số" });
        return;
      }
    } else if (addModType === "link") {
      // Parse link để lấy workshop ID
      workshopId = await parseWorkshopLink(addModInput.trim());
      if (!workshopId) {
        setMessage({
          type: "error",
          text: "Không thể lấy Workshop ID từ link. Vui lòng kiểm tra link.",
        });
        return;
      }
    } else if (addModType === "name") {
      // Tìm kiếm mod theo tên
      await searchModByName(addModInput.trim());
      return; // Dialog sẽ hiển thị kết quả tìm kiếm
    } else if (addModType === "collection") {
      // Load collection
      await loadCollection(addModInput.trim());
      return; // Dialog sẽ hiển thị collection items
    }

    // Thêm mod với workshop ID
    if (workshopId) {
      // Kiểm tra xem mod đã tồn tại chưa
      if (
        mods.some((m) => m.workshopId === workshopId || m.id === workshopId)
      ) {
        setMessage({ type: "error", text: "Mod này đã có trong danh sách" });
        return;
      }

      setMods((prev) => [
        ...prev,
        {
          id: workshopId,
          name: workshopId, // Tạm thời, sẽ được cập nhật khi load details
          workshopId: workshopId,
        },
      ]);

      setMessage({ type: "success", text: "Đã thêm mod thành công!" });
      setTimeout(() => setMessage(null), 3000);
      setShowAddModDialog(false);
      setAddModInput("");

      // Tự động load details cho mod mới
      setTimeout(() => {
        loadModDetails([{ id: workshopId, name: workshopId, workshopId }]);
      }, 500);
    }
  };

  const loadCollection = async (collectionLink: string) => {
    setLoadingCollection(true);
    try {
      const response = await axios.get("/api/steam-workshop/collection", {
        params: { link: collectionLink },
      });

      if (response.data.success && response.data.items) {
        setCollectionItems(response.data.items);
        // Reset selected mods
        setSelectedCollectionMods(new Set());
      } else {
        setMessage({
          type: "error",
          text: "Không thể tải collection hoặc collection trống",
        });
        setCollectionItems([]);
      }
    } catch (error: any) {
      console.error("Load collection error:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.error ||
          "Lỗi khi tải collection. Vui lòng kiểm tra link.",
      });
      setCollectionItems([]);
    } finally {
      setLoadingCollection(false);
    }
  };

  const handleSelectSearchResult = (mod: any) => {
    const workshopId = mod.publishedfileid;
    if (mods.some((m) => m.workshopId === workshopId || m.id === workshopId)) {
      setMessage({ type: "error", text: "Mod này đã có trong danh sách" });
      return;
    }

    setMods((prev) => [
      ...prev,
      {
        id: workshopId,
        name: mod.title || workshopId,
        workshopId: workshopId,
        details: {
          id: workshopId,
          title: mod.title || workshopId,
          description: mod.description || "",
          preview_url: mod.preview_url || "",
          file_size: mod.file_size || 0,
          subscriptions: mod.subscriptions || 0,
        },
      },
    ]);

    setMessage({ type: "success", text: `Đã thêm mod: ${mod.title}` });
    setTimeout(() => setMessage(null), 3000);
    setShowAddModDialog(false);
    setAddModInput("");
    setSearchResults([]);
  };

  const toggleCollectionMod = (modId: string) => {
    setSelectedCollectionMods((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(modId)) {
        newSet.delete(modId);
      } else {
        newSet.add(modId);
      }
      return newSet;
    });
  };

  const addSelectedCollectionMods = () => {
    if (selectedCollectionMods.size === 0) {
      setMessage({
        type: "error",
        text: "Vui lòng chọn ít nhất một mod để thêm",
      });
      return;
    }

    const modsToAdd = collectionItems.filter((item) =>
      selectedCollectionMods.has(item.publishedfileid)
    );

    const newMods: Mod[] = [];
    modsToAdd.forEach((mod) => {
      const workshopId = mod.publishedfileid;
      // Kiểm tra xem mod đã tồn tại chưa
      if (
        !mods.some((m) => m.workshopId === workshopId || m.id === workshopId)
      ) {
        newMods.push({
          id: workshopId,
          name: mod.title || workshopId,
          workshopId: workshopId,
          details: {
            id: workshopId,
            title: mod.title || workshopId,
            description: mod.description || "",
            preview_url: mod.preview_url || "",
            file_size: mod.file_size || 0,
            subscriptions: mod.subscriptions || 0,
          },
        });
      }
    });

    if (newMods.length === 0) {
      setMessage({
        type: "error",
        text: "Tất cả mods đã được chọn đều có trong danh sách rồi",
      });
      return;
    }

    setMods((prev) => [...prev, ...newMods]);
    setMessage({
      type: "success",
      text: `Đã thêm ${newMods.length} mod từ collection!`,
    });
    setTimeout(() => setMessage(null), 3000);
    setShowAddModDialog(false);
    setAddModInput("");
    setCollectionItems([]);
    setSelectedCollectionMods(new Set());

    // Tự động load details cho mods mới
    setTimeout(() => {
      loadModDetails(newMods);
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Đang tải mod list...</div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-900/50 text-green-300 border border-green-700"
              : "bg-red-900/50 text-red-300 border border-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Danh sách Mod ({mods.length})
          </h3>
          <div className="flex gap-2 mt-1">
            {mods.length > 0 && (
              <button
                onClick={() => loadModDetails(mods)}
                disabled={loadingDetails}
                className="text-sm text-primary-400 hover:text-primary-300 disabled:text-gray-600 flex items-center gap-1"
              >
                {loadingDetails ? (
                  <>
                    <i className="lni lni-spinner lni-is-spinning"></i> Đang
                    tải...
                  </>
                ) : (
                  <>
                    <i className="lni lni-reload"></i> Tải lại thông tin mod
                  </>
                )}
              </button>
            )}
            <span className="text-xs text-white/40">
              Workshop mods:{" "}
              {mods.filter((m) => m.workshopId || /^\d+$/.test(m.id)).length} /{" "}
              {mods.length}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveMods}
            disabled={saving || !serverPath}
            className="px-4 py-2 btn-primary-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <i className="lni lni-spinner lni-is-spinning"></i> Đang lưu...
              </>
            ) : (
              <>
                <i className="lni lni-save"></i> Lưu
              </>
            )}
          </button>
          <button
            onClick={loadMods}
            disabled={loading || !serverPath}
            className="px-4 py-2 btn-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <i className="lni lni-reload"></i> Tải lại
          </button>
          <button
            onClick={() => setShowAddModDialog(true)}
            className="px-4 py-2 btn-glass rounded-xl flex items-center gap-2"
          >
            <i className="lni lni-plus"></i> Thêm Mod
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {mods.length > 0 && (
        <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl flex items-center gap-4 flex-wrap">
          {/* Select All Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedMods.size === mods.length && mods.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Chọn tất cả ({selectedMods.size}/{mods.length})
            </span>
          </label>

          {/* Bulk Actions - only show when something is selected */}
          {selectedMods.size > 0 && (
            <>
              <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600"></div>

              <button
                onClick={toggleDisableSelected}
                className="px-3 py-1.5 text-sm rounded-lg bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-500/30 transition-colors flex items-center gap-1.5"
                title="Tắt/Bật mod tạm thời"
              >
                <i className="lni lni-power-switch"></i>
                Tắt/Bật ({selectedMods.size})
              </button>

              <button
                onClick={openSelectedInSteam}
                className="px-3 py-1.5 text-sm rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors flex items-center gap-1.5"
                title="Mở trong Steam Workshop"
              >
                <i className="lni lni-steam"></i>
                Mở Steam ({selectedMods.size})
              </button>

              <button
                onClick={deleteSelectedMods}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors flex items-center gap-1.5"
                title="Xóa mod đã chọn"
              >
                <i className="lni lni-trash-can"></i>
                Xóa ({selectedMods.size})
              </button>
            </>
          )}
        </div>
      )}

      {loadingDetails && (
        <div className="mb-4 text-sm text-gray-400">
          Đang tải thông tin chi tiết mod...
        </div>
      )}

      {mods.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Chưa có mod nào. Nhấn "Thêm Mod" để thêm mod.
        </div>
      ) : (
        <div className="space-y-2">
          {mods.map((mod, index) => {
            const workshopId =
              mod.workshopId || (mod.id.match(/^\d+$/) ? mod.id : null);
            const previewUrl =
              mod.details?.preview_url || mod.details?.preview_image;
            const hasImageError = imageErrors.has(mod.id);
            const isSelected = selectedMods.has(mod.id);
            const isDisabled = disabledMods.has(mod.id);

            return (
              <div
                key={`${mod.id}-${index}`}
                className={`flex items-center gap-4 p-3 border rounded-xl transition-all group ${
                  isDisabled
                    ? "bg-zinc-200 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 opacity-60"
                    : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectMod(mod.id)}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500 flex-shrink-0"
                />

                {/* Thumbnail */}
                <div
                  className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${
                    isDisabled ? "grayscale" : ""
                  }`}
                >
                  {previewUrl && !hasImageError ? (
                    <img
                      src={previewUrl}
                      alt={mod.details?.title || mod.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={() =>
                        setImageErrors((prev) => new Set(prev).add(mod.id))
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600">
                      <i className="lni lni-package text-2xl"></i>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-medium truncate ${
                      isDisabled
                        ? "text-zinc-500 dark:text-zinc-500 line-through"
                        : "text-zinc-900 dark:text-white"
                    }`}
                  >
                    {mod.details?.title || mod.name}
                  </h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    <span>ID: {mod.id}</span>
                    {mod.details?.file_size && (
                      <span>
                        Kích thước: {formatFileSize(mod.details.file_size)}
                      </span>
                    )}
                    {mod.details?.subscriptions && (
                      <span>
                        Subs: {mod.details.subscriptions.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {!workshopId && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠️ Mod thường
                    </span>
                  )}
                </div>

                {/* Active/Disabled Status */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {isDisabled ? (
                    <div
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-200 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"
                      title="Mod đang bị tắt"
                    >
                      <i className="lni lni-close"></i>
                      Tắt
                    </div>
                  ) : (
                    <div
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 flex items-center gap-1.5"
                      title="Mod đang được kích hoạt"
                    >
                      <i className="lni lni-checkmark-circle"></i>
                      Active
                    </div>
                  )}
                </div>

                {/* Toggle Disable Button */}
                <button
                  onClick={() => toggleDisableMod(mod.id)}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    isDisabled
                      ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30"
                      : "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-500/30"
                  }`}
                  title={isDisabled ? "Bật mod" : "Tắt mod tạm thời"}
                >
                  <i
                    className={`lni ${
                      isDisabled ? "lni-power-switch" : "lni-power-switch"
                    }`}
                  ></i>
                </button>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {workshopId && (
                    <a
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
                      title="Xem trên Steam"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => removeMod(index)}
                    className="p-2 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors"
                    title="Xóa mod"
                  >
                    <i className="lni lni-trash-can"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Mod Dialog */}
      {showAddModDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-strong rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Thêm Mod</h3>
              <button
                onClick={() => {
                  setShowAddModDialog(false);
                  setAddModInput("");
                  setSearchResults([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Add Mod Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cách thêm mod
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setAddModType("id");
                    setSearchResults([]);
                    setCollectionItems([]);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    addModType === "id"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Steam ID
                </button>
                <button
                  onClick={() => {
                    setAddModType("name");
                    setSearchResults([]);
                    setCollectionItems([]);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    addModType === "name"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Tìm theo tên
                </button>
                <button
                  onClick={() => {
                    setAddModType("link");
                    setSearchResults([]);
                    setCollectionItems([]);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    addModType === "link"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Link Workshop
                </button>
                <button
                  onClick={() => {
                    setAddModType("collection");
                    setSearchResults([]);
                    setCollectionItems([]);
                    setSelectedCollectionMods(new Set());
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    addModType === "collection"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  Steam Collection
                </button>
              </div>
            </div>

            {/* Input Field */}
            {addModType !== "collection" || collectionItems.length === 0 ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {addModType === "id" && "Nhập Steam Workshop ID (số)"}
                  {addModType === "name" && "Nhập tên mod để tìm kiếm"}
                  {addModType === "link" && "Nhập link Steam Workshop"}
                  {addModType === "collection" && "Nhập link Steam Collection"}
                </label>
                <input
                  type="text"
                  value={addModInput}
                  onChange={(e) => setAddModInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (
                      e.key === "Enter" &&
                      !searchingMod &&
                      !loadingCollection
                    ) {
                      if (addModType === "collection") {
                        loadCollection(addModInput.trim());
                      } else {
                        handleAddMod();
                      }
                    }
                  }}
                  placeholder={
                    addModType === "id"
                      ? "Ví dụ: 3022543997"
                      : addModType === "name"
                      ? "Ví dụ: True Music"
                      : addModType === "link"
                      ? "Ví dụ: https://steamcommunity.com/sharedfiles/filedetails/?id=3022543997"
                      : "Ví dụ: https://steamcommunity.com/sharedfiles/filedetails/?id=123456789"
                  }
                  className="w-full px-4 py-3 input-glass rounded-xl"
                />
                {(addModType === "link" || addModType === "collection") && (
                  <p className="mt-2 text-xs text-gray-400">
                    Hỗ trợ: steamcommunity.com links, steam:// links, hoặc chỉ
                    số ID
                  </p>
                )}
              </div>
            ) : null}

            {/* Search Results */}
            {addModType === "name" && searchResults.length > 0 && (
              <div className="mb-4 max-h-80 overflow-y-auto">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Kết quả tìm kiếm ({searchResults.length}) -{" "}
                  <span className="text-primary-400">
                    Sắp xếp theo độ phổ biến
                  </span>
                </label>
                <div className="space-y-2">
                  {searchResults.map((mod, index) => (
                    <div
                      key={mod.publishedfileid}
                      className="p-3 glass rounded-xl hover:bg-white/10 cursor-pointer transition-all relative"
                      onClick={() => handleSelectSearchResult(mod)}
                    >
                      {/* Badge phổ biến */}
                      {index < 3 && (
                        <div
                          className={`absolute -top-1 -left-1 px-2 py-0.5 rounded text-xs font-bold ${
                            index === 0
                              ? "bg-yellow-500 text-black"
                              : index === 1
                              ? "bg-gray-300 text-black"
                              : "bg-orange-400 text-black"
                          }`}
                        >
                          #{index + 1}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {mod.preview_url && (
                          <img
                            src={mod.preview_url}
                            alt={mod.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">
                            {mod.title}
                          </div>
                          <div className="text-xs text-gray-400 space-x-2">
                            <span>ID: {mod.publishedfileid}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs">
                            {(mod.subscriptions ||
                              mod.lifetime_subscriptions) && (
                              <span className="text-green-400">
                                <i className="lni lni-users mr-1"></i>
                                {(
                                  mod.subscriptions ||
                                  mod.lifetime_subscriptions
                                ).toLocaleString()}
                              </span>
                            )}
                            {(mod.favorited || mod.lifetime_favorited) && (
                              <span className="text-yellow-400">
                                <i className="lni lni-star mr-1"></i>
                                {(
                                  mod.favorited || mod.lifetime_favorited
                                ).toLocaleString()}
                              </span>
                            )}
                            {mod.vote_data && (
                              <span className="text-blue-400">
                                <i className="lni lni-thumbs-up mr-1"></i>
                                {mod.vote_data.votes_up?.toLocaleString() || 0}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSearchResult(mod);
                          }}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm flex items-center gap-1"
                        >
                          <i className="lni lni-plus"></i> Thêm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collection Items */}
            {addModType === "collection" && (
              <>
                {loadingCollection && (
                  <div className="mb-4 text-center py-8 text-gray-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <p className="mt-2">Đang tải collection...</p>
                  </div>
                )}

                {collectionItems.length > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-300">
                        Mods trong Collection ({collectionItems.length})
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const allIds = new Set(
                              collectionItems.map(
                                (item) => item.publishedfileid
                              )
                            );
                            setSelectedCollectionMods(allIds);
                          }}
                          className="text-xs text-primary-400 hover:text-primary-300"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          onClick={() => setSelectedCollectionMods(new Set())}
                          className="text-xs text-gray-400 hover:text-gray-300"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-700 rounded-lg p-2">
                      {collectionItems.map((mod) => {
                        const isSelected = selectedCollectionMods.has(
                          mod.publishedfileid
                        );
                        const alreadyExists = mods.some(
                          (m) =>
                            m.workshopId === mod.publishedfileid ||
                            m.id === mod.publishedfileid
                        );

                        return (
                          <div
                            key={mod.publishedfileid}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-primary-900/50 border-2 border-primary-500"
                                : "bg-gray-700 hover:bg-gray-650 border-2 border-transparent"
                            } ${alreadyExists ? "opacity-60" : ""}`}
                            onClick={() =>
                              !alreadyExists &&
                              toggleCollectionMod(mod.publishedfileid)
                            }
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  !alreadyExists &&
                                  toggleCollectionMod(mod.publishedfileid)
                                }
                                disabled={alreadyExists}
                                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                              />
                              {mod.preview_url && (
                                <img
                                  src={mod.preview_url}
                                  alt={mod.title}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <div className="text-white font-medium flex items-center gap-2">
                                  {mod.title}
                                  {alreadyExists && (
                                    <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded">
                                      Đã có
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400">
                                  ID: {mod.publishedfileid}
                                  {mod.subscriptions &&
                                    ` • ${mod.subscriptions.toLocaleString()} subscriptions`}
                                </div>
                              </div>
                              <a
                                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.publishedfileid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                              >
                                Xem
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedCollectionMods.size > 0 && (
                      <div className="mt-3 p-3 bg-primary-900/20 border border-primary-700 rounded-lg">
                        <p className="text-sm text-primary-300">
                          Đã chọn:{" "}
                          <strong>{selectedCollectionMods.size}</strong> mod
                          {selectedCollectionMods.size > 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddModDialog(false);
                  setAddModInput("");
                  setSearchResults([]);
                  setCollectionItems([]);
                  setSelectedCollectionMods(new Set());
                }}
                className="px-4 py-2 btn-glass rounded-xl"
              >
                Hủy
              </button>
              {addModType === "collection" && collectionItems.length > 0 ? (
                <button
                  onClick={addSelectedCollectionMods}
                  disabled={selectedCollectionMods.size === 0}
                  className="px-4 py-2 btn-primary-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Thêm{" "}
                  {selectedCollectionMods.size > 0
                    ? `${selectedCollectionMods.size} `
                    : ""}
                  Mod đã chọn
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (addModType === "collection") {
                      loadCollection(addModInput.trim());
                    } else {
                      handleAddMod();
                    }
                  }}
                  disabled={
                    searchingMod || loadingCollection || !addModInput.trim()
                  }
                  className="px-4 py-2 btn-primary-glass rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchingMod || loadingCollection
                    ? "Đang tải..."
                    : addModType === "name"
                    ? "Tìm kiếm"
                    : addModType === "collection"
                    ? "Tải Collection"
                    : "Thêm Mod"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
