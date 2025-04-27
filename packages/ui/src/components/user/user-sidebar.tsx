import { Link } from '@tanstack/react-router'

import {
  BookIcon,
  FileTextIcon,
  GaugeIcon,
  HelpCircleIcon,
  HomeIcon,
  LifeBuoyIcon,
  PlusCircleIcon,
  TicketIcon,
  UserIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "../ui/sidebar.tsx"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar.tsx"
import { Button } from "../ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx"

export function UserSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row items-center justify-between">
        <Link to="/" className="flex items-center gap-2 px-2">
          <LifeBuoyIcon className="h-6 w-6" />
          <span className="text-lg font-semibold">帮助中心</span>
        </Link>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/user/dashboard"}>
              <Link to="/user/dashboard">
                <HomeIcon className="h-5 w-5" />
                <span>首页</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/user/tickets" || pathname.startsWith("/user/tickets/")}>
              <Link href="/user/tickets">
                <TicketIcon className="h-5 w-5" />
                <span>我的工单</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/user/newticket"}>
              <Link href="/user/newticket">
                <PlusCircleIcon className="h-5 w-5" />
                <span>创建工单</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/user/docs")}>
              <Link href="/user/docs">
                <BookIcon className="h-5 w-5" />
                <span>文档中心</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/user/profile")}>
              <Link href="/user/profile">
                <UserIcon className="h-5 w-5" />
                <span>个人信息</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/user/support")}>
              <Link href="/user/support">
                <HelpCircleIcon className="h-5 w-5" />
                <span>帮助与支持</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="px-3 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-2">
                <Avatar className="h-6 w-6 mr-2">
                  <AvatarImage src="/mystical-forest-spirit.png" />
                  <AvatarFallback>用户</AvatarFallback>
                </Avatar>
                <span>张三</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>我的账户</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>个人资料</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <GaugeIcon className="mr-2 h-4 w-4" />
                <span>仪表盘</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <FileTextIcon className="mr-2 h-4 w-4" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
