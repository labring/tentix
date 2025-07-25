import i18nBase from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
export const translations = {
  en: {
    translation: {
      // common
      withdraw: "Recall",
      prompt: "Prompt",

      hello: "Hello",
      tkt_one: "Ticket",
      tkt_other: "Tickets",
      team: "team",
      reports: "reports",
      klg_base: "Add To Knowledge Base",
      ntfcs: "notifications",
      settings: "settings",
      docs_management: "docs management",

      area: "Region",
      title: "Title",
      category: "category",
      priority: "Priority",
      status: "Status",
      rqst_by: "Submitter",
      created_at: "Created at",
      updated_at: "Last Updated",
      sbmt_date: "submitted at",
      module: "Module",

      all: "All",
      all_status: "All status",
      pending: "Pending",
      in_progress: "In Progress",
      completed: "Completed",
      scheduled: "Scheduled",
      resolved: "Done",
      status_filter: "Status Filter",

      no_results: "no results",
      rows_per_page: "rows per page",
      go_to_first_page: "go to first page",
      go_to_last_page: "go to last page",
      go_to_previous_page: "go to previous page",
      go_to_next_page: "go to next page",

      create: "create",
      columns: "columns",
      customize_columns: "customize columns",
      rows_selected_one: "{{all}} of {{selected}} row selected",
      rows_selected_other: "{{all}} of {{selected}} rows selected",
      page_number: "Page {{page}} of {{all}}",

      urgent: "Critical",
      high: "High Priority",
      medium: "Medium Priority",
      low: "Low Priority",
      normal: "Normal Priority",

      urgent_desc: "emergency situation",
      high_desc: "business completely unavailable",
      medium_desc: "business/system anomaly affecting usage",
      low_desc: "operational experience issues",
      normal_desc: "general inquiry",
      uncategorized: "uncategorized",
      assign_category: "Assign Category",
      category_updated: "Category updated successfully",
      other: "other",
      bug: "bug",
      feature: "feature",
      question: "question",

      open_menu: "open menu",
      view_details: "view details",
      update_status: "update status",
      transfer: "Transfer",
      transfer_ticket: "Transfer Ticket",
      raise_request: "Raise Request",
      adjust_prty: "adjust priority",
      set_prty: "Set Priority",
      set_prty_desc: "Set the priority of ticket {{title}} to",
      mark_as_solved: "mark as solved",
      close: "Close",
      close_ticket: "Close Ticket",
      ticket_closed: "Ticket closed successfully",
      failed_close_ticket: "Failed to close ticket",

      community: "Forum",

      tkt: "Ticket",
      tkt_list: "Tickets",
      tkt_system: "$t(tkt_other) system",
      tkt_create: "create $t(tkt_one)",
      tkt_edit: "edit $t(tkt_one)",
      tkt_delete: "delete $t(tkt_one)",
      tkt_view: "view $t(tkt_one)",
      tkt_status: "$t(tkt_other) status",
      tkt_status_pending: "pending",
      dashboard: "Dashboard",
      are_you_sure_submit_ticket:
        "Are you sure you want to submit this ticket?",
      are_you_sure_close_ticket: "Are you sure you want to close this ticket?",

      // Modal common texts
      success: "Success",
      error: "Error",
      cancel: "Cancel",
      confirm: "Confirm",

      // Update Status Modal
      update_status_title: "Update Ticket Status",
      update_status_desc:
        "Change the status of ticket #{{id}}. This will notify all members of the ticket.",
      status_updated: "Ticket status updated successfully",
      failed_update_status: "Failed to update ticket status",
      select_status: "Select Status",
      status_change_reason: "Reason for Status Change",
      status_change_reason_ph:
        "Why are you changing the status of this ticket?",
      status_change_desc: "Provide a brief explanation for the status change",
      updating: "Updating...",

      // Transfer Modal
      transfer_ticket_title: "Transfer Ticket",
      transfer_desc:
        "Transfer this ticket to another employee, and they will be notified about the transfer.",
      ticket_transferred: "Ticket transferred successfully",
      failed_transfer: "Failed to transfer ticket",
      select_employee: "Select Employee",
      search_employee: "Search employee",
      select_staff: "Select Staff Member",
      search_staff: "Search staff members...",
      workload: "Workload",
      transfer_reason: "Reason for transfer",
      transfer_reason_ph: "Provide details for this transfer...",
      transferring: "Transferring...",
      transfer_ticket_btn: "Transfer Ticket",
      tickets_count: "tickets",
      please_select_staff: "Please select at least one staff member",
      please_provide_reason: "Please provide a reason for transfer",
      reason_min_length: "Reason must be at least 3 characters",

      // Raise Requirement Modal
      raise_req_title: "Raise New Requirement",
      raise_req_desc_linked:
        "Create a new requirement linked to ticket #{{id}}",
      raise_req_desc_general:
        "Create a new requirement for system improvement or feature request",
      req_raised: "Requirement raised successfully",
      failed_raise_req: "Failed to raise requirement",
      req_title: "Title",
      req_title_ph: "Enter a clear title for the requirement",
      req_description: "Description",
      req_desc_ph: "Provide a detailed description of the requirement",
      req_desc_help:
        "Include all relevant details, expected behavior, and business value",
      submitting: "Submitting...",
      closing: "Closing...",
      raise_req_btn: "Raise Requirement",

      // Error and Not Found Pages
      error_title: "Error",
      error_message: "Sorry, something went wrong",
      not_found_title: "Not Found",
      not_found_message: "The page you're looking for doesn't exist",
      go_back: "Go back",
      reset: "Reset",
      reload: "Reload",
      reset_login: "Reset login information",
      unauthorized_message:
        "Please login through the correct channel, or try refreshing the page",

      create_new_ticket: "Create Ticket",
      select: "Select",
      details: "Details",
      plz_pvd_info:
        "Please provide details about the issue you're experiencing or your specific request so we can assist you quickly and effectively.",
      title_ph: "Briefly describe your issue or request",

      applaunchpad: "App Management",
      costcenter: "Cost Center",
      appmarket: "App Store",
      db: "Database",
      account_center: "Account Center",
      aiproxy: "AI Proxy",
      devbox: "Devbox",
      task: "Cron Job",
      cloudserver: "Cloud Server",
      objectstorage: "Object Storage",
      laf: "Laf Cloud Development",
      kubepanel: "Kubepanel",
      terminal: "Terminal",
      workorder: "Work Order",
      time: "time",
      occurrence_time: "occurrence $t(time)",

      occurrence_time_ph: "Select date and time of occurrence",
      type: "type",
      desc: "Description",
      desc_ph:
        "Describe the issue in detail, including steps to reproduce, expected and actual results. Drag & drop or paste screenshots/images here.",

      plz_fill_all_fields: "Please fill in all required fields",
      missing_fields: "Missing required fields: {{fields}}",
      error_msg: "Error message",
      error_msg_ph: "Paste any error messages or logs",
      submit: "Submit",

      no_sth_found: "No {{sth}} found",
      try_adjust_filters: "Try adjusting filters",
      filter: "Filter",
      my: "My",
      active: "Active",
      unread: "Unread",
      search: "Search",
      view: "View",
      selected: "selected",

      tktH: {
        create: "$t(tkt) creation",
        update: "$t(tkt) information update",
        assign: "$t(tkt) assigned to {{assignee}} by system",
        close: "$t(tkt) closed",
        upgrade: "$t(tkt) priority changed to {{priority}}",
        resolve: "$t(tkt) marked as resolved",
        transfer: "$t(tkt) transferred to {{assignee}}",
        makeRequest: "Made a request",
        first_reply: "First response",
        join: "{{member}} joined the ticket",
        other: "$t(other)",
      },
      info: "Information",
      assigned_to: "Assigned to",
      last_updated: "Last updated $t(time)",
      dateTime: "{{val, datetime}}",

      // Additional translations for ticket details sidebar
      basic_info: "Basic Info",
      user_info: "User Info",
      sealos_id: "User ID",
      name: "Name",
      ticket_id: "Ticket ID",
      assignees: "Assignees",
      activity: "Activity",
      system: "System",

      // Form validation and ticket creation
      field_required: "This field is required",
      title_min_length: "Title must be at least 3 characters",
      please_select_module: "Please select a module",
      ticket_create_failed: "Failed to create ticket",
      ticket_created: "Ticket created successfully",

      // Table pagination
      loading_more: "Loading more...",
      load_more: "Load More",
      retry: "Retry",
      loading: "Loading...",
      error_loading_tickets: "Error loading tickets",

      // Empty state
      no_tickets_created_yet: "No tickets created yet",
      click_to_create_ticket: "Click here to create a ticket with our support",
      team_resolve_questions: "team and resolve your questions quickly.",

      // Auth loading states
      initializing: "Initializing...",
      auth_complete_redirecting: "Authentication complete, redirecting...",
      auth_failed: "Authentication failed",
      setup_session: "Please wait while we set up your session",
      redirecting_dashboard: "Redirecting to your dashboard...",

      // Table pagination and empty states
      total: "Total",
      page: "Page",
      no_tickets_found: "No tickets found",
      no_tickets_received: "We haven't received any tickets from users yet.",

      // Header defaults
      work_orders: "Work Orders",

      // Accessibility labels
      hide_sidebar: "Hide sidebar",
      show_sidebar: "Show sidebar",
      expand_panel: "Expand panel",
      collapse_panel: "Collapse panel",
    },
  },
  zh: {
    translation: {
      // common
      withdraw: "撤回",
      prompt: "提示",

      dashboard: "面板",
      tkt_one: "工单",
      tkt_other: "工单",
      team: "团队",
      reports: "报告",
      klg_base: "添加知识库",
      settings: "设置",
      ntfcs: "通知",
      docs_management: "文档管理",

      area: "区域",
      title: "标题",
      category: "分类",
      priority: "优先级",
      status: "状态",
      rqst_by: "提交人",
      created_at: "创建时间",
      updated_at: "更新时间",
      sbmt_date: "提交时间",
      module: "模块",

      all: "全部",
      all_status: "全部状态",
      pending: "待处理",
      in_progress: "处理中",
      completed: "已完成",
      scheduled: "计划中",
      resolved: "已完成",
      status_filter: "状态筛选",

      no_results: "没有结果",
      rows_per_page: "每页行数",
      go_to_first_page: "转到第一页",
      go_to_last_page: "转到最后一页",
      go_to_previous_page: "转到上一页",
      go_to_next_page: "转到下一页",

      create: "新建",
      columns: "列",
      customize_columns: "自定义列",
      rows_selected_one: "已选择{{selected}}行（共{{all}}行）",
      rows_selected_other: "已选择{{selected}}行（共{{all}}行）",
      page_number: "第{{page}}页（共{{all}}页）",
      urgent: "紧急",
      high: "高",
      medium: "中",
      low: "低",
      normal: "正常",

      urgent_desc: "紧急情况",
      high_desc: "业务完全不可用",
      medium_desc: "业务/系统异常影响使用",
      low_desc: "操作体验问题",
      normal_desc: "普通咨询",
      uncategorized: "未分类",
      assign_category: "划分类别",
      category_updated: "分类成功",
      other: "其他",
      bug: "bug",
      feature: "功能",
      question: "问题",

      open_menu: "打开菜单",
      view_details: "查看详情",
      update_status: "更新状态",
      transfer: "转移",
      transfer_ticket: "转移工单",
      raise_request: "提需求",

      adjust_prty: "调整优先级",
      set_prty: "设置优先级",
      set_prty_desc: "设置工单 {{title}} 的优先级为",
      mark_as_solved: "标记为已解决",
      close: "关闭",
      close_ticket: "关闭工单",
      ticket_closed: "工单已成功关闭",
      failed_close_ticket: "关闭工单失败",

      community: "社区",

      tkt: "工单",
      tkt_list: "$t(tkt)列表",
      tkt_system: "$t(tkt)系统",
      tkt_create: "创建$t(tkt)",
      tkt_edit: "编辑$t(tkt)",
      tkt_delete: "删除$t(tkt)",
      tkt_view: "查看$t(tkt)",
      tkt_status: "$t(tkt)状态",
      tkt_status_pending: "待处理",
      are_you_sure_submit_ticket: "确定要提交此工单吗？",
      are_you_sure_close_ticket: "您确定要关闭此工单吗？",

      // Modal common texts
      success: "成功",
      error: "错误",
      cancel: "取消",
      confirm: "确定",

      // Update Status Modal
      update_status_title: "更新工单状态",
      update_status_desc: "更改工单 #{{id}} 的状态。这将通知所有工单成员。",
      status_updated: "工单状态已成功更新",
      failed_update_status: "更新工单状态失败",
      select_status: "选择状态",
      status_change_reason: "状态变更原因",
      status_change_reason_ph: "为什么要更改这个工单的状态？",
      status_change_desc: "提供状态变更的简要说明",
      updating: "更新中...",

      // Transfer Modal
      transfer_ticket_title: "转移工单",
      transfer_desc: "将此工单转移给另一位员工，他们将收到转移通知。",
      ticket_transferred: "工单已成功转移",
      failed_transfer: "转移工单失败",
      select_employee: "选择员工",
      search_employee: "搜索员工",
      select_staff: "选择员工",
      search_staff: "搜索员工...",
      workload: "工作量",
      transfer_reason: "转移原因",
      transfer_reason_ph: "提供此次转移的详细信息...",
      transferring: "转移中...",
      transfer_ticket_btn: "转移工单",
      tickets_count: "个工单",
      please_select_staff: "请至少选择一位员工",
      please_provide_reason: "请提供转移原因",
      reason_min_length: "原因至少需要3个字符",

      // Raise Requirement Modal
      raise_req_title: "提出新需求",
      raise_req_desc_linked: "创建与工单 #{{id}} 关联的新需求",
      raise_req_desc_general: "为系统改进或功能请求创建新需求",
      req_raised: "需求已成功提出",
      failed_raise_req: "提出需求失败",
      req_title: "标题",
      req_title_ph: "为需求输入一个清晰的标题",
      req_description: "描述",
      req_desc_ph: "提供需求的详细描述",
      req_desc_help: "包括所有相关细节、预期行为和业务价值",
      submitting: "提交中...",
      closing: "关闭中...",
      raise_req_btn: "提出需求",

      // Error and Not Found Pages
      error_title: "错误",
      error_message: "抱歉，出现了错误",
      not_found_title: "未找到",
      not_found_message: "您正在寻找的页面不存在",
      go_back: "返回",
      reset: "重置",
      reload: "刷新",
      reset_login: "重置登录信息",
      unauthorized_message: "请通过正确的渠道登录，或尝试刷新页面",

      create_new_ticket: "创建新工单",
      select: "选择",
      details: "详情",
      plz_pvd_info: "请提供有关您的问题或请求的信息",
      title_ph: "简要描述您的问题或请求",

      applaunchpad: "应用管理",
      costcenter: "费用中心",
      appmarket: "应用商店",
      db: "数据库",
      account_center: "账户中心",
      aiproxy: "AI Proxy",
      devbox: "Devbox",
      task: "定时任务",
      cloudserver: "云服务器",
      objectstorage: "对象存储",
      laf: "Laf云开发",
      kubepanel: "Kubepanel",
      terminal: "终端",
      workorder: "工单",
      time: "时间",
      occurrence_time: "发生$t(time)",

      occurrence_time_ph: "选择发生日期和时间",
      type: "类型",
      desc: "描述",
      desc_ph:
        "详细描述问题，包括重现步骤、预期结果和实际结果。拖拽或粘贴截图/图片",

      plz_fill_all_fields: "请填写所有必填字段",
      missing_fields: "缺少以下必填字段: {{fields}}",
      error_msg: "错误信息",
      error_msg_ph: "粘贴任何错误消息或日志",
      submit: "提交",

      no_sth_found: "没有找到{{sth}}",
      try_adjust_filters: "尝试调整过滤器",
      filter: "过滤器",
      my: "我的",
      active: "活跃",
      unread: "未读",
      search: "搜索",
      view: "查看",
      selected: "已选择",

      tktH: {
        create: "$t(tkt)创建",
        update: "$t(tkt)信息更新",
        assign: "$t(tkt)被系统分配给了{{assignee}}",
        close: "$t(tkt)关闭",
        upgrade: "$t(tkt)优先级修改为 {{priority}}",
        resolve: "$t(tkt)被标记为已解决",
        transfer: "$t(tkt)被转交给{{assignee}}",
        makeRequest: "提出了需求",
        first_reply: "首次响应",
        category: "将该工单分类为{{category}}",
        join: "{{member}}加入了工单",
        other: "$t(other)",
      },
      info: "信息",
      assigned_to: "指派给",
      last_updated: "最后更新$t(time)",
      dateTime: "{{val, datetime}}",

      // Additional translations for ticket details sidebar
      basic_info: "基本信息",
      user_info: "用户信息",
      sealos_id: "用户ID",
      name: "用户名",
      ticket_id: "工单ID",
      assignees: "负责人",
      activity: "活动记录",
      system: "系统",

      // Form validation and ticket creation
      field_required: "此字段为必填项",
      title_min_length: "标题至少需要3个字符",
      please_select_module: "请选择模块",
      ticket_create_failed: "创建工单失败",
      ticket_created: "工单创建成功",

      // Table pagination
      loading_more: "加载更多...",
      load_more: "加载更多",
      retry: "重试",
      loading: "加载中...",
      error_loading_tickets: "加载工单时出错",

      // Empty state
      no_tickets_created_yet: "暂无工单",
      click_to_create_ticket: "点击这里创建工单，我们的支持",
      team_resolve_questions: "团队将快速帮您解决问题。",

      // Auth loading states
      initializing: "正在初始化...",
      auth_complete_redirecting: "认证完成，正在跳转...",
      auth_failed: "认证失败",
      setup_session: "请稍候，正在设置您的会话",
      redirecting_dashboard: "正在跳转到您的面板...",

      // Table pagination and empty states
      total: "总计",
      page: "页",
      no_tickets_found: "未找到工单",
      no_tickets_received: "暂未收到任何用户工单。",

      // Header defaults
      work_orders: "工单系统",

      // Accessibility labels
      hide_sidebar: "隐藏侧边栏",
      show_sidebar: "显示侧边栏",
      expand_panel: "展开面板",
      collapse_panel: "收起面板",
    },
  },
};

export const i18next = i18nBase.use(initReactI18next).init({
  debug: process.env.NODE_ENV !== "production",
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
  resources: translations,
});

export default i18nBase;

export function joinTrans(keys: string[]) {
  const { i18n } = useTranslation();
  const join = i18n.language === "zh" ? "" : " ";
  return keys.join(join);
}

export { useTranslation, Trans } from "react-i18next";
