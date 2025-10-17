import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Avatar, AvatarFallback, AvatarImage } from "tentix-ui";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { apiClient } from "@lib/api-client";
import useDebounce from "@hook/use-debounce";

type AssignableUserRole = "customer" | "agent" | "technician" | "admin" | "ai";

type UsersResponse = {
  users: Array<{
    id: number;
    name: string;
    avatar?: string | null;
    role: AssignableUserRole | "system";
    realName?: string | null;
    email?: string | null;
    level?: number | null;
    registerTime: string;
  }>;
  pagination: { total: number; totalPages: number };
};

function formatRegisterTime(timeStr: string) {
  if (!timeStr) return "";
  try {
    const date = new Date(timeStr);
    return date.toLocaleDateString();
  } catch {
    return timeStr;
  }
}

export function UserManagementSection() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  type RoleFilter = "all" | AssignableUserRole;
  const [role, setRole] = useState<RoleFilter>("all");
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  const usersQueryOptions = queryOptions<UsersResponse>({
    queryKey: ["admin-users", page, debouncedSearch, role],
    queryFn: async () => {
      const roleQuery: Partial<{ role: AssignableUserRole }> = role !== "all" ? { role } : {};
      const res = await apiClient.admin.users.$get({
        query: {
          page: page.toString(),
          limit: "10",
          ...(debouncedSearch && { search: debouncedSearch }),
          ...roleQuery,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: usersData } = useQuery(usersQueryOptions);

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: AssignableUserRole }) => {
      const res = await apiClient.admin.users[":id"]["role"].$patch({
        param: { id: id.toString() },
        json: { role },
      });
      if (!res.ok) throw new Error("Failed to update user role");
      return await res.json();
    },
    onSuccess: () => {
      // 立即刷新用户列表数据
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleRowClick = (userId: number) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Input placeholder="搜索用户（姓名、ID、真实姓名）" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="按角色筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              <SelectItem value="customer">客户</SelectItem>
              <SelectItem value="agent">客服</SelectItem>
              <SelectItem value="technician">技术员</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {usersData ? (
          <div className="space-y-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>用户名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>注册时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData.users.map((user) => (
                    <>
                      <TableRow
                        key={user.id}
                        onClick={() => handleRowClick(user.id)}
                        className="cursor-pointer hover:bg-zinc-50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={user.avatar || "/placeholder.svg"} />
                              <AvatarFallback className="text-xs">{user.name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => {
                              const allowed: AssignableUserRole[] = ["customer", "agent", "technician", "admin", "ai"];
                              if (allowed.includes(newRole as AssignableUserRole)) {
                                updateUserRoleMutation.mutate({ id: user.id, role: newRole as AssignableUserRole });
                              }
                            }}
                            disabled={user.role === "system"}
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue>
                                <span className="text-xs">
                                  {user.role === "customer" && "客户"}
                                  {user.role === "agent" && "客服"}
                                  {user.role === "technician" && "技术员"}
                                  {user.role === "admin" && "管理员"}
                                  {user.role === "ai" && "AI"}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">客户</SelectItem>
                              <SelectItem value="agent">客服</SelectItem>
                              <SelectItem value="technician">技术员</SelectItem>
                              <SelectItem value="admin">管理员</SelectItem>
                              <SelectItem value="ai">AI</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatRegisterTime(user.registerTime)}</TableCell>
                      </TableRow>
                      {expandedUserId === user.id && (
                        <TableRow className="bg-zinc-50/50">
                          <TableCell colSpan={3}>
                            <div className="p-4 border-t">
                              <div className="grid grid-cols-2 gap-4 text-sm text-zinc-700">
                                <div>
                                  <span className="text-zinc-500 mr-2">ID</span>
                                  <span className="font-mono">{user.id}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 mr-2">真实姓名</span>
                                  <span>{user.realName || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 mr-2">邮箱</span>
                                  <span className="font-mono">{user.email || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 mr-2">级别</span>
                                  <span> {user.level}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                显示 {(page - 1) * 10 + 1} - {Math.min(page * 10, usersData.pagination.total)} 条，共 {usersData.pagination.total} 条
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= usersData.pagination.totalPages}>
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        )}
      </div>
    </div>
  );
}


