import {
  apiClient,
  kbAdminSaveFetch,
  kbFilePreviewFetch,
  kbIndexGenerateFetch,
} from "@lib/api-client";
import {
  GENERAL_KNOWLEDGE_CATEGORY_LABELS,
  GENERAL_KNOWLEDGE_CATEGORY_VALUES,
  KnowledgeFieldsEditor,
  type GeneralKnowledgeCategory,
  type KnowledgeFieldErrors,
  type KnowledgeFieldValues,
} from "@comp/staff/knowledge-base/knowledge-fields-editor";
import { useTranslation } from "i18n";
import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "tentix-ui";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MODULES = 10;
const MAX_INDEXES = 3;
const MAX_TITLE_LENGTH = 200;
type ChunkSettingMode = "auto" | "custom";
type ChunkSplitMode = "paragraph" | "size" | "char";
type FileImportStep = "file" | "settings" | "preview" | "confirm";

type FileImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleOptions: Array<{ code: string; label: string }>;
  onImported: () => void;
};

type FileImportCandidate = KnowledgeFieldValues & {
  candidateId: string;
  initialContent: string;
  contentModified: boolean;
  errors?: KnowledgeFieldErrors;
  duplicate: "none" | "current" | "existing";
  duplicateAction: "continue" | "skip";
  indexStatus: "idle" | "running" | "success" | "failed";
  importStatus: "pending" | "running" | "success" | "failed" | "skipped";
  error?: string;
};

type ImportProgress = {
  total: number;
  completed: number;
};

type IndexProgress = {
  total: number;
  completed: number;
};

type TranslationFunction = ReturnType<typeof useTranslation>["t"];

function getResponseMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = data.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return getResponseMessage(data, fallback);
}

function getThrownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return getResponseMessage(error, fallback);
}

function isValidChunkSplitter(value: string): boolean {
  if (!value || value.length > 200) return false;
  const separators = value.replace(/\\n/g, "\n").split("|");
  return separators.length <= 10 && separators.every((separator) => separator.length > 0);
}

function normalizeDuplicateContent(content: string): string {
  return content.replace(/\r\n?/g, "\n").normalize("NFC").trim();
}

async function getFileFingerprint(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        await worker(items[index]!);
      }
    }),
  );
}

async function saveFileImportCandidate(
  candidate: FileImportCandidate,
  fileName: string,
  fallbackMessage: string,
): Promise<void> {
  const response = await apiClient.kb.admin["general-knowledge"].$post(
    {
      json: {
        sourceId: `general_knowledge:file:${candidate.candidateId}`,
        title: candidate.title.trim(),
        modules: candidate.modules,
        category: candidate.category as GeneralKnowledgeCategory,
        docName: fileName,
        revision: candidate.revision.trim(),
        content: candidate.content.trim(),
        indexes: candidate.indexes.filter((value) => value.trim()),
      },
    },
    { fetch: kbAdminSaveFetch },
  );
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackMessage));
  }
}

function validateCandidate(candidate: FileImportCandidate, t: TranslationFunction): KnowledgeFieldErrors | undefined {
  const errors: KnowledgeFieldErrors = {};
  if (!candidate.title.trim()) errors.title = t("knowledge_file_import.error_title_required");
  if (candidate.title.trim().length > MAX_TITLE_LENGTH) {
    errors.title = t("knowledge_file_import.error_title_max");
  }
  if (candidate.modules.length === 0) errors.modules = t("knowledge_file_import.error_modules_required");
  if (candidate.modules.length > MAX_MODULES) {
    errors.modules = t("knowledge_file_import.error_modules_max", { max: MAX_MODULES });
  }
  if (!candidate.category) errors.category = t("knowledge_file_import.error_category_required");
  if (!candidate.revision.trim()) errors.revision = t("knowledge_file_import.error_revision_required");
  if (!candidate.content.trim()) errors.content = t("knowledge_file_import.error_content_required");
  if (candidate.content.trim().length > 20_000) {
    errors.content = t("knowledge_file_import.error_content_max");
  }
  if (candidate.indexes.length > MAX_INDEXES) {
    errors.indexes = [t("knowledge_file_import.error_indexes_max")];
  }
  return Object.keys(errors).length ? errors : undefined;
}

export function FileImportDialog({
  open,
  onOpenChange,
  moduleOptions,
  onImported,
}: FileImportDialogProps) {
  const { t } = useTranslation();
  const fileFingerprints = useRef(new Map<string, string>());
  const fileReadVersion = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSizeBytes, setFileSizeBytes] = useState(0);
  const [rawText, setRawText] = useState("");
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [candidates, setCandidates] = useState<FileImportCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [defaultModules, setDefaultModules] = useState<string[]>([]);
  const [defaultCategory, setDefaultCategory] =
    useState<GeneralKnowledgeCategory | "">("");
  const [bulkModules, setBulkModules] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState<GeneralKnowledgeCategory | "">("");
  const [activeStep, setActiveStep] = useState<FileImportStep>("file");
  const [splitOptions, setSplitOptions] = useState<{
    chunkSettingMode: ChunkSettingMode;
    chunkSplitMode: ChunkSplitMode;
    paragraphChunkDeep: number;
    chunkSize: number;
    chunkSplitter: string;
  }>({
    chunkSettingMode: "auto",
    chunkSplitMode: "paragraph",
    paragraphChunkDeep: 3,
    chunkSize: 1000,
    chunkSplitter: "",
  });
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<ImportProgress | null>(null);
  const [isGeneratingIndexes, setIsGeneratingIndexes] = useState(false);
  const [indexProgress, setIndexProgress] =
    useState<IndexProgress | null>(null);

  const selectedCandidate =
    candidates.find((item) => item.candidateId === selectedCandidateId) ??
    candidates[0] ??
    null;
  const availableModuleOptions = [...moduleOptions].sort(
    (left, right) =>
      Number(defaultModules.includes(right.code)) -
      Number(defaultModules.includes(left.code)),
  );

  const setCandidateValues = (candidateId: string, value: KnowledgeFieldValues) => {
    setCandidates((current) =>
      current.map((item) =>
        item.candidateId === candidateId
          ? {
              ...item,
              ...value,
              contentModified: value.content !== item.initialContent,
              errors: undefined,
              error: undefined,
            }
          : item,
      ),
    );
  };

  const handleFileChange = async (nextFile: File | undefined) => {
    if (!nextFile) return;
    const readVersion = fileReadVersion.current + 1;
    fileReadVersion.current = readVersion;
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["md", "txt", "html", "pdf", "docx", "csv", "xlsx"].includes(extension)) {
      setErrorMessage(t("knowledge_file_import.error_file_extension"));
      setFile(null);
      setFileName("");
      setFileSizeBytes(0);
      setRawText("");
      setFileWarnings([]);
      setCandidates([]);
      setSelectedCandidateIds([]);
      setSelectedCandidateId("");
      setImportProgress(null);
      setIndexProgress(null);
      setIsReadingFile(false);
      return;
    }
    if (nextFile.size > MAX_FILE_BYTES) {
      setErrorMessage(t("knowledge_file_import.error_file_size"));
      setFile(null);
      setFileName("");
      setFileSizeBytes(0);
      setRawText("");
      setFileWarnings([]);
      setCandidates([]);
      setSelectedCandidateIds([]);
      setSelectedCandidateId("");
      setImportProgress(null);
      setIndexProgress(null);
      setIsReadingFile(false);
      return;
    }

    setErrorMessage("");
    setFileWarnings([]);
    setIsReadingFile(true);
    setFile(nextFile);
    setFileName(nextFile.name);
    setFileSizeBytes(nextFile.size);
    setCandidates([]);
    setSelectedCandidateIds([]);
    setSelectedCandidateId("");
    setImportProgress(null);
    setIndexProgress(null);

    try {
      const fingerprint = await getFileFingerprint(nextFile);
      if (fileReadVersion.current !== readVersion) return;
      const previousName = fileFingerprints.current.get(fingerprint);
      const nextWarnings = previousName
        ? [t("knowledge_file_import.error_duplicate_file", { fileName: previousName })]
        : [];
      fileFingerprints.current.set(fingerprint, nextFile.name);
      if (fileReadVersion.current !== readVersion) return;

      const form = new FormData();
      form.append("file", nextFile);
      const response = await apiClient.kb.admin["general-knowledge"].file.parse.$post(
        {},
        { fetch: kbFilePreviewFetch, init: { body: form } },
      );
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, t("knowledge_file_parse_failed")));
      }
      const result = await response.json();
      if (fileReadVersion.current !== readVersion) return;
      setRawText(result.data.rawText);
      setFileWarnings([...nextWarnings, ...result.data.warnings]);
    } catch (error) {
      if (fileReadVersion.current !== readVersion) return;
      setErrorMessage(getThrownErrorMessage(error, t("knowledge_file_parse_failed")));
      setRawText("");
      setFileWarnings([]);
    } finally {
      if (fileReadVersion.current === readVersion) setIsReadingFile(false);
    }
  };

  const getSelectedIds = () => selectedCandidateIds;

  const requestPreview = async () => {
    if (isReadingFile) {
      setErrorMessage(t("knowledge_file_import.error_file_reading"));
      return;
    }
    if (!file) {
      setErrorMessage(t("knowledge_file_import.error_choose_file"));
      return;
    }
    if (!rawText) {
      setErrorMessage(t("knowledge_file_import.error_choose_read_file"));
      return;
    }
    if (!defaultModules.length) {
      setErrorMessage(t("knowledge_file_import.error_default_modules"));
      return;
    }
    if (!defaultCategory) {
      setErrorMessage(t("knowledge_file_import.error_default_category"));
      return;
    }
    if (splitOptions.chunkSettingMode === "custom") {
      if (
        !Number.isInteger(splitOptions.chunkSize) ||
        splitOptions.chunkSize < 64 ||
        splitOptions.chunkSize > 4000
      ) {
        setErrorMessage(t("knowledge_file_import.error_chunk_size"));
        return;
      }
      if (splitOptions.chunkSplitMode === "paragraph" && (
        !Number.isInteger(splitOptions.paragraphChunkDeep) ||
        splitOptions.paragraphChunkDeep < 1 ||
        splitOptions.paragraphChunkDeep > 8
      )) {
        setErrorMessage(t("knowledge_file_import.error_title_depth"));
        return;
      }
      if (
        splitOptions.chunkSplitMode === "char" &&
        !isValidChunkSplitter(splitOptions.chunkSplitter)
      ) {
        setErrorMessage(t("knowledge_file_import.error_chunk_splitter"));
        return;
      }
    }

    setImportProgress(null);
    setIndexProgress(null);
    setIsParsing(true);
    setErrorMessage("");
    try {
      const response = await apiClient.kb.admin["general-knowledge"].file.preview.$post(
        {
          json: {
            fileName,
            fileSizeBytes,
            rawText,
            chunkSettingMode: splitOptions.chunkSettingMode,
            chunkSplitMode: splitOptions.chunkSplitMode,
            paragraphChunkDeep: splitOptions.paragraphChunkDeep,
            chunkSize: splitOptions.chunkSize,
            ...(splitOptions.chunkSettingMode === "custom" &&
            splitOptions.chunkSplitMode === "char"
              ? { chunkSplitter: splitOptions.chunkSplitter }
              : {}),
          },
        },
        { fetch: kbFilePreviewFetch },
      );
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, t("knowledge_file_parse_failed")));
      }
      const result = await response.json();
      const parsedCandidates = result.data.candidates.map((candidate) => ({
        title: candidate.title,
        content: candidate.content,
        modules: [...defaultModules],
        category: defaultCategory,
        revision: `file-${new Date().toISOString().slice(0, 10)}`,
        indexes: [],
        candidateId: candidate.candidateId,
        initialContent: candidate.content,
        contentModified: false,
        duplicate: "none" as const,
        duplicateAction: "continue" as const,
        indexStatus: "idle" as const,
        importStatus: "pending" as const,
      }));

      const duplicateResponse =
        await apiClient.kb.admin["general-knowledge"].file.duplicates.$post({
          json: {
            candidates: parsedCandidates.map((candidate) => ({
              candidateId: candidate.candidateId,
              content: candidate.content,
            })),
          },
        });
      if (!duplicateResponse.ok) {
        throw new Error(await getErrorMessage(duplicateResponse, t("knowledge_file_import.error_duplicate_check")));
      }
      const duplicateResult = await duplicateResponse.json();
      const existingMatches = new Set(
        duplicateResult.data.matches
          .filter((match) => match.existing.length > 0)
          .map((match) => match.candidateId),
      );
      const currentContent = new Map<string, string>();
      const candidatesWithDuplicates: FileImportCandidate[] = parsedCandidates.map((candidate) => {
        const normalized = normalizeDuplicateContent(candidate.content);
        const isCurrentDuplicate = currentContent.has(normalized);
        currentContent.set(normalized, candidate.candidateId);
        return {
          ...candidate,
          duplicate: isCurrentDuplicate
            ? "current"
            : existingMatches.has(candidate.candidateId)
              ? "existing"
              : "none",
          };
      });
      if (!candidatesWithDuplicates.length) {
        throw new Error(t("knowledge_file_import.error_no_candidates"));
      }

      setCandidates(candidatesWithDuplicates);
      setSelectedCandidateIds(candidatesWithDuplicates.map((candidate) => candidate.candidateId));
      setSelectedCandidateId(candidatesWithDuplicates[0]?.candidateId ?? "");
      setActiveStep("preview");
    } catch (error) {
      setErrorMessage(
        getThrownErrorMessage(error, t("knowledge_file_parse_failed")),
      );
      setCandidates([]);
      setSelectedCandidateIds([]);
      setSelectedCandidateId("");
    } finally {
      setIsParsing(false);
    }
  };

  const handleRechunk = () => {
    if (candidates.length && !window.confirm(t("knowledge_file_import.error_rechunk_confirm"))) {
      return;
    }
    void requestPreview();
  };

  const goToSettings = () => {
    if (!file || isReadingFile || !rawText) {
      setErrorMessage(t("knowledge_file_import.error_choose_read_file"));
      return;
    }
    setErrorMessage("");
    setActiveStep("settings");
  };

  const goToConfirm = () => {
    if (isGeneratingIndexes) {
      return;
    }
    const selected = candidates.filter((candidate) =>
      selectedCandidateIds.includes(candidate.candidateId),
    );
    if (!selected.length) {
      setErrorMessage(t("knowledge_file_import.error_choose_candidate"));
      return;
    }
    if (selected.some((candidate) => Boolean(validateCandidate(candidate, t)))) {
      setErrorMessage(t("knowledge_file_import.error_fix_required"));
      return;
    }
    setErrorMessage("");
    setActiveStep("confirm");
  };

  const generateIndexes = async (
    items: FileImportCandidate[],
    trackProgress = false,
  ) => {
    const validation = items.map((candidate) => ({
      candidate,
      errors: validateCandidate(candidate, t),
    }));
    const invalidItems = validation.filter((item) => item.errors);
    const validItems = validation
      .filter((item) => !item.errors)
      .map((item) => item.candidate);

    setErrorMessage(
      invalidItems.length > 0
        ? t("knowledge_file_import.error_fix_required")
        : "",
    );

    if (trackProgress) {
      setIndexProgress(
        validItems.length > 0
          ? { total: validItems.length, completed: 0 }
          : null,
      );
    }
    setCandidates((current) =>
      current.map((candidate) => {
        const itemValidation = validation.find(
          (item) => item.candidate.candidateId === candidate.candidateId,
        );
        if (!itemValidation) {
          return candidate;
        }
        if (itemValidation.errors) {
          return {
            ...candidate,
            errors: itemValidation.errors,
            indexStatus: "idle" as const,
          };
        }
        return {
          ...candidate,
          errors: undefined,
          indexStatus: "running" as const,
          error: undefined,
        };
      }),
    );

    if (!validItems.length) return;
    if (trackProgress) {
      setIsGeneratingIndexes(true);
    }

    try {
      await runWithConcurrency(validItems, 2, async (candidate) => {
        try {
          const response = await apiClient.kb.admin["general-knowledge"].indexes.generate.$post(
            {
              json: {
                title: candidate.title,
                modules: candidate.modules,
                category: candidate.category as GeneralKnowledgeCategory,
                content: candidate.content,
              },
            },
            { fetch: kbIndexGenerateFetch },
          );
          if (!response.ok) {
            throw new Error(await getErrorMessage(response, t("knowledge_file_import.error_index_generation")));
          }
          const result = await response.json();
          setCandidates((current) =>
            current.map((item) => {
              if (item.candidateId !== candidate.candidateId) return item;
              const indexes = [...item.indexes];
              let nextIndex = 0;
              for (let index = 0; index < MAX_INDEXES && nextIndex < result.data.indexes.length; index += 1) {
                if (indexes[index]?.trim()) continue;
                indexes[index] = result.data.indexes[nextIndex]!;
                nextIndex += 1;
              }
              return { ...item, indexes, indexStatus: "success" as const };
            }),
          );
        } catch (error) {
          setCandidates((current) =>
            current.map((item) =>
              item.candidateId === candidate.candidateId
                ? {
                    ...item,
                    indexStatus: "failed" as const,
                    error: error instanceof Error ? error.message : t("knowledge_file_import.error_index_generation"),
                  }
                : item,
            ),
          );
        } finally {
          if (trackProgress) {
            setIndexProgress((current) =>
              current
                ? {
                    ...current,
                    completed: Math.min(current.completed + 1, current.total),
                  }
                : current,
            );
          }
        }
      });
    } finally {
      if (trackProgress) {
        setIsGeneratingIndexes(false);
      }
    }
  };

  const handleGenerateIndexes = () => {
    const selected = candidates.filter((candidate) =>
      getSelectedIds().includes(candidate.candidateId),
    );
    void generateIndexes(selected, true);
  };

  const handleImport = async (requestedCandidates?: FileImportCandidate[]) => {
    const isRetry = requestedCandidates !== undefined;
    const selected = requestedCandidates ?? candidates.filter((candidate) =>
      getSelectedIds().includes(candidate.candidateId),
    );
    const validation = selected.map((candidate) => ({
      candidate,
      errors: validateCandidate(candidate, t),
    }));
    const validItems = validation
      .filter(
        (item) =>
          !item.errors &&
          item.candidate.importStatus !== "success" &&
          item.candidate.importStatus !== "skipped" &&
          !(item.candidate.duplicateAction === "skip" && item.candidate.duplicate !== "none"),
      )
      .map((item) => item.candidate);
    if (!isRetry) {
      const alreadyCompletedCount = selected.filter(
        (candidate) =>
          candidate.importStatus === "success" ||
          candidate.importStatus === "skipped",
      ).length;
      const newlySkippedCount = validation.filter(
        (item) =>
          !item.errors &&
          item.candidate.importStatus !== "success" &&
          item.candidate.importStatus !== "skipped" &&
          item.candidate.duplicateAction === "skip" &&
          item.candidate.duplicate !== "none",
      ).length;
      setImportProgress({
        total: selected.length,
        completed: alreadyCompletedCount + newlySkippedCount,
      });
    }
    setCandidates((current) =>
      current.map((candidate) => {
        const itemValidation = validation.find(
          (item) => item.candidate.candidateId === candidate.candidateId,
        );
        if (!itemValidation) {
          return candidate;
        }
        if (candidate.importStatus === "success" || candidate.importStatus === "skipped") {
          return candidate;
        }
        if (itemValidation.errors) {
          return { ...candidate, errors: itemValidation.errors };
        }
        if (candidate.duplicateAction === "skip" && candidate.duplicate !== "none") {
          return { ...candidate, importStatus: "skipped" as const, errors: undefined };
        }
        return { ...candidate, errors: undefined, importStatus: "running" as const, error: undefined };
      }),
    );
    if (!validItems.length) return;

    setIsImporting(true);
    let importedCount = 0;
    await runWithConcurrency(validItems, 2, async (candidate) => {
      try {
        await saveFileImportCandidate(candidate, fileName, t("knowledge_file_import.error_save"));
        importedCount += 1;
        setCandidates((current) =>
          current.map((item) =>
            item.candidateId === candidate.candidateId
              ? { ...item, importStatus: "success" as const }
              : item,
          ),
        );
        if (!isRetry) {
          setImportProgress((current) =>
            current
              ? {
                  ...current,
                  completed: Math.min(current.completed + 1, current.total),
                }
              : current,
          );
        }
      } catch (error) {
        setCandidates((current) =>
          current.map((item) =>
            item.candidateId === candidate.candidateId
              ? {
                  ...item,
                  importStatus: "failed" as const,
                  error: error instanceof Error ? error.message : t("knowledge_file_import.error_save"),
                }
              : item,
          ),
        );
        if (!isRetry) {
          setImportProgress((current) =>
            current
              ? {
                  ...current,
                  completed: Math.min(current.completed + 1, current.total),
                }
              : current,
          );
        }
      }
    });
    setIsImporting(false);
    if (importedCount) onImported();
  };

  const applyBulkSettings = () => {
    const ids = new Set(selectedCandidateIds);
    if (bulkModules.length > MAX_MODULES) {
      setErrorMessage(t("knowledge_file_import.error_modules_max", { max: MAX_MODULES }));
      return;
    }
    if (!ids.size) {
      setErrorMessage(t("knowledge_file_import.error_bulk_choose"));
      return;
    }
    setCandidates((current) =>
      current.map((candidate) =>
        ids.has(candidate.candidateId)
          ? {
              ...candidate,
              modules: bulkModules.length ? bulkModules : candidate.modules,
              category: bulkCategory || candidate.category,
              errors: undefined,
            }
          : candidate,
      ),
    );
  };

  const toggleCandidate = (candidateId: string, checked: boolean) => {
    setSelectedCandidateIds((current) =>
      checked
        ? Array.from(new Set([...current, candidateId]))
        : current.filter((id) => id !== candidateId),
    );
  };

  const selectedCount = selectedCandidateIds.length;
  const pendingCount = candidates.filter(
    (candidate) => candidate.importStatus === "pending" || candidate.importStatus === "running",
  ).length;
  const successCount = candidates.filter((candidate) => candidate.importStatus === "success").length;
  const failedCount = candidates.filter((candidate) => candidate.importStatus === "failed").length;
  const importProgressValue =
    importProgress && importProgress.total > 0
      ? Math.min(
          100,
          Math.round((importProgress.completed / importProgress.total) * 100),
        )
      : 0;
  const indexProgressValue =
    indexProgress && indexProgress.total > 0
      ? Math.min(
          100,
          Math.round((indexProgress.completed / indexProgress.total) * 100),
        )
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] h-[min(900px,calc(100vh-2rem))] w-[min(1180px,calc(100vw-2rem))] sm:max-w-[1180px] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div>
              <DialogTitle>{t("knowledge_file_import.title")}</DialogTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("knowledge_file_import.description")}
              </p>
            </div>
            <div className="hidden text-right text-xs text-muted-foreground sm:block">
              <p>{file ? fileName : t("knowledge_file_import.not_selected")}</p>
              <p className="mt-1">
                {candidates.length
                  ? t("knowledge_file_import.selected_count", { selected: selectedCount, total: candidates.length })
                  : t("knowledge_file_import.waiting_parse")}
              </p>
            </div>
          </div>
          <nav aria-label={t("knowledge_file_import.steps_label")} className="grid grid-cols-4 gap-2 pt-4">
            {([
              ["file", t("knowledge_file_import.step_file")],
              ["settings", t("knowledge_file_import.step_settings")],
              ["preview", t("knowledge_file_import.step_preview")],
              ["confirm", t("knowledge_file_import.step_confirm")],
            ] as const).map(([step, label], index) => (
              <button
                key={step}
                type="button"
                disabled={step === "confirm" && isGeneratingIndexes}
                className={`border-t-2 px-1 pt-2 text-left text-xs ${activeStep === step ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
                onClick={() => {
                  if (step === "confirm") {
                    if (candidates.length) goToConfirm();
                    return;
                  }
                  if (
                    step === "file" ||
                    (step === "settings" && file) ||
                    (step === "preview" && candidates.length)
                  ) {
                    setActiveStep(step);
                  }
                }}
              >
                <span className="mr-1">{index + 1}.</span>{label}
              </button>
            ))}
          </nav>
        </DialogHeader>

        <main className="min-h-0 overflow-y-auto px-6 py-5">
          {activeStep === "file" ? (
            <section className="mx-auto grid max-w-4xl gap-5">
              <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="knowledge-file">{t("knowledge_file_import.local_file")}</Label>
                    <Input
                      id="knowledge-file"
                      type="file"
                      accept=".md,.txt,.html,.pdf,.docx,.csv,.xlsx"
                      disabled={isReadingFile || isParsing || isImporting}
                      onChange={(event) => void handleFileChange(event.target.files?.[0])}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {file
                      ? `${fileName} · ${(fileSizeBytes / 1024).toFixed(1)} KB`
                      : t("knowledge_file_import.supported_files")}
                  </div>
                </div>
                {isReadingFile ? (
                  <p className="text-sm text-muted-foreground">{t("knowledge_file_import.file_parsing")}</p>
                ) : null}
                {fileWarnings.map((warning) => (
                  <p key={warning} role="status" className="text-sm text-amber-600">{warning}</p>
                ))}
                <div className="grid gap-2">
                  <Label>{t("knowledge_file_import.default_modules")}</Label>
                  <div className="grid max-h-52 gap-2 overflow-auto rounded-md border border-border bg-background p-3 sm:grid-cols-2">
                    {moduleOptions.map((item) => (
                      <label key={item.code} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={defaultModules.includes(item.code)}
                          disabled={isReadingFile || isParsing || isImporting || candidates.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked && defaultModules.length >= MAX_MODULES) {
                              setErrorMessage(t("knowledge_file_import.error_modules_max", { max: MAX_MODULES }));
                              return;
                            }
                            setDefaultModules((current) =>
                              checked
                                ? Array.from(new Set([...current, item.code]))
                                : current.filter((code) => code !== item.code),
                            );
                          }}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="max-w-sm">
                  <Label>{t("knowledge_file_import.default_category")}</Label>
                  <Select
                    value={defaultCategory}
                    disabled={isReadingFile || isParsing || isImporting || candidates.length > 0}
                    onValueChange={(value) => setDefaultCategory(value as GeneralKnowledgeCategory)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={t("knowledge_field.category_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {GENERAL_KNOWLEDGE_CATEGORY_VALUES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {t(GENERAL_KNOWLEDGE_CATEGORY_LABELS[category])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!file || isReadingFile || isParsing || isImporting}
                  onClick={goToSettings}
                >
                  {t("knowledge_file_import.next_settings")}
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === "settings" ? (
            <section className="mx-auto grid max-w-4xl gap-5">
              <div className="rounded-xl border border-border bg-muted/20 p-5">
                <h3 className="text-base font-semibold">{t("knowledge_file_import.chunk_settings_title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("knowledge_file_import.chunk_settings_description")}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {([
                    ["auto", t("knowledge_file_import.chunk_default"), t("knowledge_file_import.chunk_default_description")],
                    ["custom", t("knowledge_file_import.chunk_custom"), t("knowledge_file_import.chunk_custom_description")],
                  ] as const).map(([mode, title, description]) => (
                    <button
                      key={mode}
                      type="button"
                      className={`rounded-lg border p-4 text-left ${splitOptions.chunkSettingMode === mode ? "border-primary bg-primary/5" : "border-border"}`}
                      onClick={() => setSplitOptions((current) => ({ ...current, chunkSettingMode: mode }))}
                    >
                      <p className="font-medium">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </button>
                  ))}
                </div>
              </div>
              {splitOptions.chunkSettingMode === "custom" ? (
                <div className="grid gap-4 rounded-xl border border-border p-5">
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">{t(
                      splitOptions.chunkSplitMode === "paragraph"
                        ? "knowledge_file_import.chunk_paragraph_title"
                        : splitOptions.chunkSplitMode === "size"
                          ? "knowledge_file_import.chunk_size_title"
                          : "knowledge_file_import.chunk_separator_title",
                    )}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        splitOptions.chunkSplitMode === "paragraph"
                          ? "knowledge_file_import.chunk_split_paragraph_hint"
                          : splitOptions.chunkSplitMode === "size"
                            ? "knowledge_file_import.chunk_split_size_hint"
                            : "knowledge_file_import.chunk_split_char_hint",
                      )}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("knowledge_file_import.chunk_split_mode")}</Label>
                    <Select
                      value={splitOptions.chunkSplitMode}
                      disabled={isParsing || isImporting}
                      onValueChange={(value) =>
                        setSplitOptions((current) => ({
                          ...current,
                          chunkSplitMode: value as ChunkSplitMode,
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paragraph">{t("knowledge_file_import.chunk_split_paragraph")}</SelectItem>
                        <SelectItem value="size">{t("knowledge_file_import.chunk_split_size")}</SelectItem>
                        <SelectItem value="char">{t("knowledge_file_import.chunk_split_char")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {splitOptions.chunkSplitMode === "paragraph" ? (
                      <div className="grid gap-2">
                        <Label>{t("knowledge_file_import.title_depth")}</Label>
                        <Select
                          value={String(splitOptions.paragraphChunkDeep)}
                          disabled={isParsing || isImporting}
                          onValueChange={(value) =>
                            setSplitOptions((current) => ({ ...current, paragraphChunkDeep: Number(value) }))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((level) => (
                              <SelectItem key={level} value={String(level)}>
                                {t("knowledge_file_import.title_depth_option", { level })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">{t("knowledge_file_import.deeper_title_hint")}</p>
                      </div>
                    ) : null}
                    {splitOptions.chunkSplitMode === "char" ? (
                      <div className="grid gap-2">
                        <Label htmlFor="chunk-splitter">{t("knowledge_file_import.chunk_separator")}</Label>
                        <Input
                          id="chunk-splitter"
                          placeholder={t("knowledge_file_import.chunk_separator_placeholder")}
                          value={splitOptions.chunkSplitter}
                          disabled={isParsing || isImporting}
                          onChange={(event) =>
                            setSplitOptions((current) => ({ ...current, chunkSplitter: event.target.value }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">{t("knowledge_file_import.chunk_separator_hint")}</p>
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      <Label htmlFor="chunk-size">{t("knowledge_file_import.chunk_size")}</Label>
                      <Input
                        id="chunk-size"
                        type="number"
                        min={64}
                        max={4000}
                        step={100}
                        value={splitOptions.chunkSize}
                        disabled={isParsing || isImporting}
                        onChange={(event) =>
                          setSplitOptions((current) => ({ ...current, chunkSize: Number(event.target.value) }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">{t("knowledge_file_import.chunk_size_hint")}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setActiveStep("file")}>{t("knowledge_file_import.previous")}</Button>
                <Button type="button" disabled={isParsing || isImporting} onClick={handleRechunk}>
                  {isParsing ? t("knowledge_file_import.parsing") : t("knowledge_file_import.generate_preview")}
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === "preview" ? (
            <section className="grid min-h-0 gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{t("knowledge_file_import.review_title")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("knowledge_file_import.review_description")}
                  </p>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{t("knowledge_file_import.selected_badge", { count: selectedCount })}</Badge>
                  <Badge variant="outline">{t("knowledge_file_import.total_badge", { count: candidates.length })}</Badge>
                  <Badge variant="outline">{t("knowledge_file_import.max_badge")}</Badge>
                </div>
              </div>
              <div className="grid gap-4 lg:h-[min(32rem,calc(100vh-24rem))] lg:min-h-0 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
                <div className="grid min-h-0 min-w-0 content-start gap-2 overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={candidates.length > 0 && selectedCount === candidates.length}
                      onCheckedChange={(checked) =>
                        setSelectedCandidateIds(checked ? candidates.map((candidate) => candidate.candidateId) : [])
                      }
                    />
                    {t("knowledge_file_import.select_all")}
                  </label>
                  <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
                    {candidates.map((candidate, index) => (
                      <div
                        key={candidate.candidateId}
                        className={`min-w-0 rounded-lg border p-3 text-left ${selectedCandidate?.candidateId === candidate.candidateId ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <Checkbox
                            checked={selectedCandidateIds.includes(candidate.candidateId)}
                            onCheckedChange={(checked) => toggleCandidate(candidate.candidateId, checked === true)}
                          />
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelectedCandidateId(candidate.candidateId)}
                          >
                            <span className="block truncate text-sm font-medium">#{index + 1} {candidate.title || t("knowledge_file_import.untitled")}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              <Badge variant="outline">{candidate.indexStatus === "success" ? t("knowledge_file_import.index_complete") : candidate.indexStatus === "failed" ? t("knowledge_file_import.index_failed") : t("knowledge_file_import.index_pending")}</Badge>
                              <Badge variant={candidate.importStatus === "success" ? "default" : "outline"}>
                                {candidate.importStatus === "success" ? t("knowledge_file_import.imported") : candidate.importStatus === "failed" ? t("knowledge_file_import.import_failed") : candidate.importStatus === "skipped" ? t("knowledge_file_import.skipped") : t("knowledge_file_import.import_pending")}
                              </Badge>
                            </span>
                            {candidate.error ? <span className="mt-1 block text-xs text-destructive">{candidate.error}</span> : null}
                          </button>
                        </div>
                        {candidate.duplicate !== "none" ? (
                          <div className="mt-2 grid gap-2 text-xs text-amber-700">
                            <span>{candidate.duplicate === "current" ? t("knowledge_file_import.duplicate_current") : t("knowledge_file_import.duplicate_existing")}</span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={candidate.duplicateAction === "skip" ? "default" : "outline"}
                                onClick={() => setCandidates((current) => current.map((item) => item.candidateId === candidate.candidateId ? { ...item, duplicateAction: "skip" as const } : item))}
                              >
                                {t("knowledge_file_import.skip")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={candidate.duplicateAction === "continue" ? "default" : "outline"}
                                onClick={() => setCandidates((current) => current.map((item) => item.candidateId === candidate.candidateId ? { ...item, duplicateAction: "continue" as const } : item))}
                              >
                                {t("knowledge_file_import.continue_import")}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {candidate.indexStatus === "failed" ? (
                          <Button type="button" size="sm" variant="outline" className="mt-2" disabled={isGeneratingIndexes} onClick={() => void generateIndexes([candidate])}>{t("knowledge_file_import.retry_index")}</Button>
                        ) : null}
                        {candidate.importStatus === "failed" ? (
                          <Button type="button" size="sm" variant="outline" className="mt-2 ml-2" onClick={() => void handleImport([candidate])}>{t("knowledge_file_import.retry_import")}</Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 min-w-0 overflow-y-auto pr-1">
                  {selectedCandidate ? (
                    <>
                      <KnowledgeFieldsEditor
                        value={selectedCandidate}
                        moduleOptions={availableModuleOptions}
                        errors={selectedCandidate.errors}
                        onChange={(value) => setCandidateValues(selectedCandidate.candidateId, value)}
                        showRevision
                        showIndexFields
                        disabled={isImporting || selectedCandidate.importStatus === "success"}
                      />
                      {selectedCandidate.contentModified ? (
                        <p className="mt-3 text-xs text-amber-600">{t("knowledge_file_import.content_modified_warning")}</p>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">{t("knowledge_file_import.select_candidate")}</div>
                  )}
                </div>
              </div>
              <section className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t("knowledge_file_import.batch_title")}</h3>
                    <p className="text-xs text-muted-foreground">{t("knowledge_file_import.batch_description")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{t("knowledge_file_import.import_pending_count", { count: pendingCount })}</span>
                    <span>{t("knowledge_file_import.import_success_count", { count: successCount })}</span>
                    <span>{t("knowledge_file_import.import_failed_count", { count: failedCount })}</span>
                  </div>
                </div>
                {indexProgress ? (
                  <div className="grid gap-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{isGeneratingIndexes ? t("knowledge_file_import.index_generating") : t("knowledge_file_import.index_complete_status")}</span>
                      <span>
                        {indexProgress.completed} / {indexProgress.total}
                      </span>
                    </div>
                    <Progress
                      value={indexProgressValue}
                      aria-label={t("knowledge_file_import.index_progress_aria")}
                      className="h-2"
                    />
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
                  <div className="grid gap-2">
                    <Label>{t("knowledge_file_import.bulk_modules")}</Label>
                    <div className="flex max-h-20 flex-wrap gap-x-3 gap-y-2 overflow-auto rounded-md border border-border bg-background p-2">
                      {availableModuleOptions.map((item) => (
                        <label key={item.code} className="flex items-center gap-1 text-xs">
                          <Checkbox
                            checked={bulkModules.includes(item.code)}
                            onCheckedChange={(checked) => setBulkModules((current) => checked ? Array.from(new Set([...current, item.code])) : current.filter((code) => code !== item.code))}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("knowledge_file_import.bulk_category")}</Label>
                    <Select value={bulkCategory} onValueChange={(value) => setBulkCategory(value as GeneralKnowledgeCategory)}>
                      <SelectTrigger><SelectValue placeholder={t("knowledge_file_import.no_change")} /></SelectTrigger>
                      <SelectContent>
                        {GENERAL_KNOWLEDGE_CATEGORY_VALUES.map((category) => (
                          <SelectItem key={category} value={category}>{t(GENERAL_KNOWLEDGE_CATEGORY_LABELS[category])}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" className="self-end" onClick={applyBulkSettings}>{t("knowledge_file_import.apply")}</Button>
                </div>
              </section>
              <div className="flex justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setActiveStep("settings")}>{t("knowledge_file_import.back_settings")}</Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={isParsing || isImporting || isGeneratingIndexes || !selectedCount} onClick={handleGenerateIndexes}>{isGeneratingIndexes ? t("knowledge_file_import.index_generating") : t("knowledge_file_import.one_click_index")}</Button>
                  <Button type="button" disabled={isParsing || isImporting || isGeneratingIndexes} onClick={goToConfirm}>{t("knowledge_file_import.next_confirm")}</Button>
                </div>
              </div>
            </section>
          ) : null}

          {activeStep === "confirm" ? (
            <section className="mx-auto grid max-w-3xl gap-5">
              <div className="rounded-xl border border-border bg-muted/20 p-5">
                <h3 className="text-base font-semibold">{t("knowledge_file_import.confirm_title")}</h3>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">{t("knowledge_file_import.file")}</dt><dd className="mt-1 break-all">{fileName}</dd></div>
                  <div><dt className="text-muted-foreground">{t("knowledge_file_import.candidate_count")}</dt><dd className="mt-1">{t("knowledge_file_import.total_badge", { count: selectedCount })}</dd></div>
                  <div><dt className="text-muted-foreground">{t("knowledge_file_import.index_status")}</dt><dd className="mt-1">{t("knowledge_file_import.index_complete")} {candidates.filter((candidate) => candidate.indexStatus === "success").length}</dd></div>
                  <div><dt className="text-muted-foreground">{t("knowledge_file_import.failed_status")}</dt><dd className="mt-1">{failedCount ? t("knowledge_file_import.import_failed_count", { count: failedCount }) : t("knowledge_file_import.no_failed")}</dd></div>
                </dl>
                {importProgress ? (
                  <div className="mt-4 grid gap-2">
                    <div className="flex justify-between text-sm">
                      <span>{isImporting ? t("knowledge_file_import.import_progress") : t("knowledge_file_import.processing_complete")}</span>
                      <span>
                        {importProgress.completed} / {importProgress.total}
                      </span>
                    </div>
                    <Progress
                      value={importProgressValue}
                      aria-label={t("knowledge_file_import.import_progress_aria")}
                      className="h-2"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex justify-between gap-3">
                <Button type="button" variant="outline" disabled={isImporting} onClick={() => setActiveStep("preview")}>{t("knowledge_file_import.previous")}</Button>
                <Button type="button" disabled={isImporting} onClick={() => void handleImport()}>{isImporting ? t("knowledge_file_import.import_progress") : t("knowledge_file_import.confirm_import")}</Button>
              </div>
            </section>
          ) : null}
        </main>

        <DialogFooter className="border-t border-border bg-background px-6 py-4">
          {errorMessage ? <p role="alert" className="mr-auto max-w-xl text-sm text-destructive">{errorMessage}</p> : null}
          <Button type="button" variant="outline" disabled={isImporting} onClick={() => onOpenChange(false)}>{t("knowledge_file_import.cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
