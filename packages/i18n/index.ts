import i18nBase from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
export const translations = {
  en: {
    translation: {
      // common
      withdraw: "Recall",
      prompt: "Prompt",

      tkt_one: "Ticket",
      tkt_other: "Tickets",
      klg_base: "Add To Knowledge Base",

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
      only_mine: "Only mine",
      all_tickets: "All tickets",
      pending: "Pending",
      in_progress: "In Progress",
      completed: "Completed",
      scheduled: "Scheduled",
      resolved: "Done",
      status_filter: "Status Filter",

      rows_per_page: "rows per page",
      go_to_first_page: "go to first page",
      go_to_last_page: "go to last page",
      go_to_previous_page: "go to previous page",
      go_to_next_page: "go to next page",

      create: "create",

      urgent: "Critical",
      high: "High Priority",
      medium: "Medium Priority",
      low: "Low Priority",
      normal: "Normal Priority",
      other: "other",

      open_menu: "open menu",
      update_status: "update status",
      transfer: "Transfer",
      transfer_ticket: "Transfer Ticket",
      raise_request: "Raise Request",
      set_prty: "Set Priority",
      set_prty_desc: "Set the priority of ticket {{title}} to",
      close: "Close",
      close_ticket: "Close Ticket",
      ticket_closed: "Ticket closed successfully",
      failed_close_ticket: "Failed to close ticket",

      community: "Forum",

      tkt: "Ticket",
      tkt_list: "Tickets",
      dashboard: "Dashboard",
      are_you_sure_submit_ticket:
        "Are you sure you want to submit this ticket?",
      are_you_sure_close_ticket: "Are you sure you want to close this ticket?",

      // Modal common texts
      success: "Success",
      error: "Error",
      cancel: "Cancel",
      confirm: "Confirm",
      copied: "Copied",
      copy_failed: "Failed to copy",

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
      transfer_reason: "Reason for transfer",
      transfer_reason_ph: "Provide details for this transfer...",
      transferring: "Transferring...",
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
      plz_pvd_info:
        "Please provide details about the issue you're experiencing or your specific request so we can assist you quickly and effectively.",
      title_ph: "Briefly describe your issue or request",

      applaunchpad: "App Launchpad",
      costcenter: "Cost Center",
      appmarket: "App Store",
      db: "Database",
      account_center: "Account Center",
      aiproxy: "AI Proxy",
      devbox: "DevBox",
      task: "Cron Job",
      cloudserver: "Cloud Server",
      objectstorage: "Object Storage",
      laf: "Laf Cloud Development",
      kubepanel: "KubePanel",
      terminal: "Terminal",
      workorder: "Work Order",
      time: "time",

      type: "type",
      desc: "Description",
      desc_ph:
        "Describe the issue in detail, including steps to reproduce, expected and actual results. Drag & drop or paste screenshots/images here.",

      plz_fill_all_fields: "Please fill in all required fields",
      missing_fields: "Missing required fields: {{fields}}",
      error_msg: "Error message",
      submit: "Submit",

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
        upgrade: "$t(tkt) priority changed to {{priority}}",
        resolve: "$t(tkt) marked as resolved",
        transfer: "$t(tkt) transferred to {{assignee}}",
        join: "{{member}} joined the ticket",
        first_reply: "First reply",
      },
      info: "Information",
      assigned_to: "Assigned to",

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

      // Login/Register page
      login: "Login",
      register: "Register",
      login_title: "Login",
      register_title: "Register",
      login_subtitle: "Enter your credentials to access your account",
      register_subtitle: "Create a new account to get started",
      field_name: "Name",
      field_password: "Password",
      ph_name: "Enter your name",
      ph_password: "Enter your password",
      btn_login: "Login",
      btn_register: "Register",
      btn_switch_to_register: "Don't have an account? Register",
      btn_switch_to_login: "Already have an account? Login",
      name_required: "Name is required",
      password_min_6: "Password must be at least 6 characters",
      login_failed: "Login failed",
      invalid_credentials: "Invalid credentials",
      unauthorized: "Unauthorized",
      token_expired: "Token expired",
      token_invalid: "Token invalid",
      user_already_exists: "User already exists",
      failed_create_user: "Failed to create user",
      user_not_found: "User not found",
      please_register_first: "Please register first",
      registration_failed: "Registration failed",

      // WebSocket and chat
      send_failed: "Failed to send",
      send_error_generic: "An error occurred while sending",
      not_joined_cannot_send:
        "You haven't joined this ticket and cannot send messages",
      join_this_ticket: "Join this ticket",
      joining: "Joining...",

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

      // Feedback translations
      feedback_submitted: "Feedback submitted successfully",
      feedback_submit_failed: "Failed to submit feedback",
      feedback: "Feedback",
      helpful_response: "Helpful Response",
      unhelpful_response: "Unhelpful Response",
      helpful: "Helpful",
      unhelpful: "Unhelpful",
      file_complaint: "File a complaint about this ticket",
      feedback_placeholder:
        "We'd like to know the reason for your dissatisfaction. How could we have done better?",
      close_ticket_feedback_placeholder:
        "Please describe whether your issue was resolved, how you found the support, and share any feedback for improvement.",
      unknown: "Unknown",
      user: "User",
      csr: "CSR",
      internal: "Internal",
      irrelevant: "Irrelevant",
      unresolved: "Unresolved",
      unfriendly: "Unfriendly",
      slow_response: "Slow response",
      message_withdrawn: "Message withdrawn",
      failed_to_load_assignees: "Failed to load assignees",
      satisfaction_survey: "Satisfaction Survey",
      share_your_feedback: "Share your feedback",
      please_provide_rating: "Please provide a rating",

      // Chat editor and inputs
      type_your_message: "Type your message...",
      add_internal_note: "Add an internal note...",
      public: "Public",
      public_message: "Public message",
      internal_note: "Internal note",
      unknown_error_sending_message: "An unknown error occurred while sending",
      uploading: "Uploading",
      uploading_simple: "Uploading {{uploaded}}/{{total}}",
      kb_added: "Added to Knowledge Base",
      send_message_shortcut: "Send message (Cmd+Enter)",
      send_message: "Send message",
      enter_message: "Enter message...",
      selected_count: "Selected: {{count}}",

      // File upload and error messages
      file_upload_failed: "File upload failed",
      file_upload_error: "An error occurred during file upload",
      uploading_files: "Uploading files {{uploaded}}/{{total}}",
      unknown_submit_error: "An unknown error occurred during submission",
      history_navigation_failed:
        "History navigation failed, falling back to default route",
      no_agents_configured: "No agents configured",
      // Settings modal & Feishu binding
      settings: "Settings",
      account_binding: "Account Binding",
      account_binding_manage: "Account Binding Management",
      change_avatar: "Change avatar",
      avatar_upload_tip: "PNG/JPEG <= 5MB is recommended",
      username: "Username",
      real_name: "Real Name",
      email: "Email",
      role: "Role",
      register_time: "Register Time",
      avatar_updated: "Avatar updated successfully",
      failed_update_avatar: "Failed to update avatar",
      please_select_image_file: "Please select an image file",
      image_size_limit: "Image size should be less than 5MB",
      failed_upload_avatar: "Failed to upload avatar",
      feishu_account: "Feishu Account",
      bound: "Bound",
      unbound: "Unbound",
      unbinding: "Unbinding...",
      unbind: "Unbind",
      binding_link_loading: "Getting binding link...",
      bind: "Bind",
      feishu_bind_hint_desc:
        "You can bind third-party accounts for easier login",
      feishu_bind_tip_fast_login:
        "After binding Feishu, you can quickly log in",
      feishu_bind_tip_one_to_one:
        "Each Feishu account can only bind to one system account",
      feishu_unbound: "Feishu account unbound successfully",
      failed_unbind_feishu: "Failed to unbind Feishu account",
      failed_get_feishu_bind_url: "Failed to get Feishu bind URL",
      failed_start_feishu_binding: "Failed to start Feishu binding",
      // Server Feishu errors
      feishu_not_configured: "Feishu is not configured.",
      invalid_state: "Invalid state.",
      feishu_identity_not_found:
        "Feishu user identity not found. Please contact the administrator.",
      user_not_found_admin: "User not found. Please contact the administrator.",
      invalid_or_expired_binding_session:
        "Invalid or expired binding session.",
      bound_user_not_found: "Bound user not found after binding",
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
      klg_base: "添加知识库",

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
      only_mine: "仅看我的",
      all_tickets: "全部工单",
      pending: "待处理",
      in_progress: "处理中",
      completed: "已完成",
      scheduled: "计划中",
      resolved: "已完成",
      status_filter: "状态筛选",

      rows_per_page: "每页行数",
      go_to_first_page: "转到第一页",
      go_to_last_page: "转到最后一页",
      go_to_previous_page: "转到上一页",
      go_to_next_page: "转到下一页",

      create: "新建",

      urgent: "紧急",
      high: "高",
      medium: "中",
      low: "低",
      normal: "正常",
      other: "其他",
      open_menu: "打开菜单",
      update_status: "更新状态",
      transfer: "转移",
      transfer_ticket: "转移工单",
      raise_request: "提需求",

      set_prty: "设置优先级",
      set_prty_desc: "设置工单 {{title}} 的优先级为",
      close: "关闭",
      close_ticket: "关闭工单",
      ticket_closed: "工单已成功关闭",
      failed_close_ticket: "关闭工单失败",

      community: "社区",

      tkt: "工单",
      tkt_list: "$t(tkt)列表",
      are_you_sure_submit_ticket: "确定要提交此工单吗？",
      are_you_sure_close_ticket: "您确定要关闭此工单吗？",

      // Modal common texts
      success: "成功",
      error: "错误",
      cancel: "取消",
      confirm: "确定",
      copied: "已复制",
      copy_failed: "复制失败",

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
      transfer_reason: "转移原因",
      transfer_reason_ph: "提供此次转移的详细信息...",
      transferring: "转移中...",
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
      plz_pvd_info: "请提供有关您的问题或请求的信息",
      title_ph: "简要描述您的问题或请求",

      applaunchpad: "应用管理",
      costcenter: "费用中心",
      appmarket: "应用商店",
      db: "数据库",
      account_center: "账户中心",
      aiproxy: "AI Proxy",
      devbox: "DevBox",
      task: "定时任务",
      cloudserver: "云服务器",
      objectstorage: "对象存储",
      laf: "Laf云开发",
      kubepanel: "KubePanel",
      terminal: "终端",
      workorder: "工单",
      time: "时间",

      type: "类型",
      desc: "描述",
      desc_ph:
        "详细描述问题，包括重现步骤、预期结果和实际结果。拖拽或粘贴截图/图片",

      plz_fill_all_fields: "请填写所有必填字段",
      missing_fields: "缺少以下必填字段: {{fields}}",
      error_msg: "错误信息",
      submit: "提交",

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
        upgrade: "$t(tkt)优先级修改为 {{priority}}",
        resolve: "$t(tkt)被标记为已解决",
        transfer: "$t(tkt)被转交给{{assignee}}",
        join: "{{member}}加入了工单",
        first_reply: "首次回复",
      },
      info: "信息",
      assigned_to: "指派给",

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

      // Login/Register page
      login: "登录",
      register: "注册",
      login_title: "登录",
      register_title: "注册",
      login_subtitle: "请输入账号和密码以登录",
      register_subtitle: "创建一个新账号以开始使用",
      field_name: "用户名",
      field_password: "密码",
      ph_name: "请输入用户名",
      ph_password: "请输入密码",
      btn_login: "登录",
      btn_register: "注册",
      btn_switch_to_register: "没有账号？去注册",
      btn_switch_to_login: "已有账号？去登录",
      name_required: "用户名为必填项",
      password_min_6: "密码至少需要 6 位",
      login_failed: "登录失败",
      invalid_credentials: "用户名或密码错误",
      unauthorized: "未授权",
      token_expired: "Token 已过期",
      token_invalid: "Token 无效",
      user_already_exists: "用户已存在",
      failed_create_user: "创建用户失败",
      user_not_found: "用户不存在",
      please_register_first: "请先注册账号",
      registration_failed: "注册失败",

      // WebSocket and chat
      send_failed: "发送失败",
      send_error_generic: "发送消息时出现错误",
      not_joined_cannot_send: "你尚未加入该工单，无法发送消息",
      join_this_ticket: "加入此工单",
      joining: "加入中...",

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

      // Feedback translations
      feedback_submitted: "反馈提交成功",
      feedback_submit_failed: "反馈提交失败",
      feedback: "反馈",
      helpful_response: "有用回复",
      unhelpful_response: "无用回复",
      helpful: "有帮助",
      unhelpful: "无帮助",
      file_complaint: "对此工单进行投诉",
      feedback_placeholder: "我们想了解您不满意的原因，我们如何可以做得更好？",
      close_ticket_feedback_placeholder:
        "您的问题是否已解决，如果没解决，可以分享任何改进建议给我们。",
      unknown: "未知",
      user: "用户",
      csr: "客服",
      internal: "内部",
      irrelevant: "不相关",
      unresolved: "未解决",
      unfriendly: "不友好",
      slow_response: "响应缓慢",
      message_withdrawn: "消息已撤回",
      failed_to_load_assignees: "加载负责人失败",
      satisfaction_survey: "满意度调查",
      share_your_feedback: "分享您的反馈",
      please_provide_rating: "请给出评分",

      // Chat editor and inputs
      type_your_message: "输入消息...",
      add_internal_note: "添加内部备注...",
      public: "公开",
      public_message: "公开消息",
      internal_note: "内部备注",
      unknown_error_sending_message: "发送消息时出现未知错误",
      uploading: "上传中",
      uploading_simple: "上传中 {{uploaded}}/{{total}}",
      kb_added: "已收录到知识库",
      send_message_shortcut: "发送消息 (Cmd+Enter)",
      send_message: "发送消息",
      enter_message: "输入消息...",
      selected_count: "已选：{{count}}",

      // File upload and error messages
      file_upload_failed: "文件上传失败",
      file_upload_error: "文件上传时出现错误",
      uploading_files: "正在上传文件 {{uploaded}}/{{total}}",
      unknown_submit_error: "提交时出现未知错误",
      history_navigation_failed: "历史导航失败，回退到默认路由",
      no_agents_configured: "系统未配置客服人员",
      // Settings modal & Feishu binding
      settings: "设置",
      account_binding: "账户绑定",
      account_binding_manage: "账户绑定管理",
      change_avatar: "更换头像",
      avatar_upload_tip: "建议上传 PNG/JPEG 且不超过 5MB",
      username: "用户名",
      real_name: "真实姓名",
      email: "邮箱",
      role: "角色",
      register_time: "注册时间",
      avatar_updated: "头像更新成功",
      failed_update_avatar: "更新头像失败",
      please_select_image_file: "请选择图片文件",
      image_size_limit: "图片大小需小于 5MB",
      failed_upload_avatar: "上传头像失败",
      feishu_account: "飞书账户",
      bound: "已绑定",
      unbound: "未绑定",
      unbinding: "解绑中...",
      unbind: "解绑",
      binding_link_loading: "获取绑定链接...",
      bind: "绑定",
      feishu_bind_hint_desc: "您可以绑定第三方账户来方便登录系统",
      feishu_bind_tip_fast_login: "绑定飞书账户后，您可以使用飞书账户快速登录系统",
      feishu_bind_tip_one_to_one: "每个飞书账户只能绑定一个系统账户",
      feishu_unbound: "飞书账户解绑成功",
      failed_unbind_feishu: "解绑飞书账户失败",
      failed_get_feishu_bind_url: "获取飞书绑定链接失败",
      failed_start_feishu_binding: "发起飞书绑定失败",
      // Server Feishu errors
      feishu_not_configured: "未配置飞书",
      invalid_state: "无效的 state",
      feishu_identity_not_found: "未找到飞书用户身份，请联系管理员。",
      user_not_found_admin: "未找到用户，请联系管理员。",
      invalid_or_expired_binding_session: "绑定会话无效或已过期。",
      bound_user_not_found: "绑定后未找到对应用户",
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
