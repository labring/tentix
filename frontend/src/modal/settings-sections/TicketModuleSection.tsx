import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, toast, Label } from "tentix-ui";
import { Pencil, Trash2, Plus } from "lucide-react";
import { apiClient } from "@lib/api-client";
import { useTranslation } from "i18n";

type TicketModule = {
  code: string;
  icon: string | null;
  translations: {
    "zh-CN": string;
    "en-US": string;
    [key: string]: string;
  };
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type TicketModulesResponse = {
  modules: TicketModule[];
};

export function TicketModuleSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TicketModule | null>(null);
  const [expandedModuleCode, setExpandedModuleCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    translationZhCN: "",
    translationEnUS: "",
    sortOrder: 0,
  });

  const ticketModulesQueryOptions = queryOptions<TicketModulesResponse>({
    queryKey: ["ticket-modules"],
    queryFn: async () => {
      const res = await apiClient.user["ticket-module"].$get();
      if (!res.ok) throw new Error("Failed to fetch ticket modules");
      return await res.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: modulesData } = useQuery(ticketModulesQueryOptions);

  const createModuleMutation = useMutation({
    mutationFn: async (data: {
      code: string;
      translations: { "zh-CN": string; "en-US": string };
      sortOrder: number;
    }) => {
      const res = await apiClient.user["ticket-module"].$post({
        json: data,
      });
      if (!res.ok) throw new Error("Failed to create ticket module");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("ticket_module_created"),
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["ticket-modules"] });
      queryClient.invalidateQueries({ queryKey: ["getTicketModulesConfig"] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_create_ticket_module"),
        variant: "destructive",
      });
    },
  });

  const updateModuleMutation = useMutation({
    mutationFn: async ({
      code,
      data,
    }: {
      code: string;
      data: {
        translations?: { "zh-CN": string; "en-US": string };
        sortOrder?: number;
      };
    }) => {
      const res = await apiClient.user["ticket-module"][":code"].$patch({
        param: { code },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update ticket module");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("ticket_module_updated"),
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["ticket-modules"] });
      queryClient.invalidateQueries({ queryKey: ["getTicketModulesConfig"] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_update_ticket_module"),
        variant: "destructive",
      });
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiClient.user["ticket-module"][":code"].$delete({
        param: { code },
      });
      if (!res.ok) throw new Error("Failed to delete ticket module");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("ticket_module_deleted"),
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["ticket-modules"] });
      queryClient.invalidateQueries({ queryKey: ["getTicketModulesConfig"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message || t("failed_delete_ticket_module"),
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingModule(null);
    setFormData({
      code: "",
      translationZhCN: "",
      translationEnUS: "",
      sortOrder: 0,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (module: TicketModule) => {
    setEditingModule(module);
    setFormData({
      code: module.code,
      translationZhCN: module.translations["zh-CN"] || "",
      translationEnUS: module.translations["en-US"] || "",
      sortOrder: module.sortOrder,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingModule(null);
    setFormData({
      code: "",
      translationZhCN: "",
      translationEnUS: "",
      sortOrder: 0,
    });
  };

  const handleSubmit = () => {
    if (!formData.code.trim() || !formData.translationZhCN.trim() || !formData.translationEnUS.trim()) {
      toast({
        title: t("validation_error"),
        description: t("code_translations_required"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      code: formData.code.trim(),
      translations: {
        "zh-CN": formData.translationZhCN.trim(),
        "en-US": formData.translationEnUS.trim(),
      },
      sortOrder: formData.sortOrder,
    };

    if (editingModule) {
      updateModuleMutation.mutate({
        code: editingModule.code,
        data: {
          translations: payload.translations,
          sortOrder: payload.sortOrder,
        },
      });
    } else {
      createModuleMutation.mutate(payload);
    }
  };

  const handleDelete = (code: string) => {
    if (confirm(t("confirm_delete_ticket_module"))) {
      deleteModuleMutation.mutate(code);
    }
  };

  const handleRowClick = (code: string) => {
    setExpandedModuleCode(expandedModuleCode === code ? null : code);
  };

  return (
    <>
      <div className="space-y-6 max-w-5xl">
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium text-zinc-900">{t("ticket_module_management")}</h3>
              <p className="text-sm text-zinc-500 mt-1">{t("ticket_module_management_desc")}</p>
            </div>
            <Button onClick={handleOpenCreateDialog} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {t("create_module")}
            </Button>
          </div>

          {modulesData ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("code")}</TableHead>
                    <TableHead>{t("chinese_translation")}</TableHead>
                    <TableHead>{t("english_translation")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modulesData.modules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {t("no_ticket_modules_found")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    modulesData.modules.map((module) => (
                      <>
                        <TableRow
                          key={module.code}
                          onClick={() => handleRowClick(module.code)}
                          className="cursor-pointer hover:bg-zinc-50"
                        >
                          <TableCell className="font-mono text-sm">
                            {module.code}
                          </TableCell>
                          <TableCell>{module.translations["zh-CN"]}</TableCell>
                          <TableCell>{module.translations["en-US"]}</TableCell>
                          <TableCell className="text-right">
                            <div
                              className="flex justify-end gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditDialog(module)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(module.code)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedModuleCode === module.code && (
                          <TableRow className="bg-zinc-50/50">
                            <TableCell colSpan={4}>
                              <div className="p-4 border-t">
                                <div className="grid grid-cols-2 gap-4 text-sm text-zinc-700">
                                  <div>
                                    <span className="text-zinc-500 mr-2">{t("icon")}</span>
                                    <span>{module.icon || "-"}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500 mr-2">{t("sort_order")}</span>
                                    <span>{module.sortOrder}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500 mr-2">{t("created_at")}</span>
                                    <span className="font-mono text-xs">{new Date(module.createdAt).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500 mr-2">{t("updated_at")}</span>
                                    <span className="font-mono text-xs">{new Date(module.updatedAt).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t("loading")}</div>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingModule ? t("edit_module") : t("create_ticket_module")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t("code_required")}</Label>
              <Input
                id="code"
                placeholder={t("code_placeholder")}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                disabled={!!editingModule}
                className="font-mono"
              />
              {editingModule && (
                <p className="text-xs text-zinc-500">{t("code_cannot_change")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="translation-zh">{t("chinese_translation")}</Label>
              <Input
                id="translation-zh"
                placeholder={t("chinese_translation_placeholder")}
                value={formData.translationZhCN}
                onChange={(e) => setFormData({ ...formData, translationZhCN: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="translation-en">{t("english_translation")}</Label>
              <Input
                id="translation-en"
                placeholder={t("english_translation_placeholder")}
                value={formData.translationEnUS}
                onChange={(e) => setFormData({ ...formData, translationEnUS: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">{t("sort_order")}</Label>
              <Input
                id="sortOrder"
                type="number"
                placeholder="0"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={createModuleMutation.isPending || updateModuleMutation.isPending}>
              {editingModule ? t("update") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}