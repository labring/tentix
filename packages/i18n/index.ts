import i18nBase from "i18next";
import { initReactI18next } from "react-i18next";
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
      other: "Other",

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
      pending_reply: "Pending reply",
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
      sealos_auth_not_ready:
        "Sealos account verification is not complete. Please reopen Work Orders from Sealos.",

      // Login/Register page
      login: "Login",
      register: "Register",
      login_title: "Welcome to Tentix Inc.",
      register_title: "Register",
      field_name: "Name",
      field_password: "Password",
      ph_name: "Enter your name",
      ph_password: "Enter your password",
      btn_login: "Login",
      or: "Or",
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
      force_relogin_required:
        "Your account permissions have changed. Please login again.",
      user_already_exists: "User already exists",
      failed_create_user: "Failed to create user",
      user_not_found: "User not found",
      please_register_first: "Please register first",
      registration_failed: "Registration failed",

      // Password reset
      reset_password_title: "Reset Password",
      reset_password_for_user: "Resetting password for: {{name}}",
      field_current_password: "Current Password",
      field_new_password: "New Password",
      field_confirm_password: "Confirm Password",
      ph_current_password: "Enter your current password",
      ph_new_password: "Enter your new password",
      ph_confirm_password: "Confirm your new password",
      btn_reset_password: "Reset Password",
      btn_back_to_login: "Back to Login",
      password_not_match: "Passwords do not match",
      password_reset_success: "Password Reset Successful",
      password_reset_success_desc: "Your password has been reset successfully",
      password_reset_failed: "Password Reset Failed",

      // Admin workflow & AI role config errors
      workflow_not_found: "Workflow not found",
      workflow_name_exists: "Workflow name already exists",
      active_ai_role_exists_in_scope:
        "An active AI role already exists in scope '{{scope}}'",
      workflow_in_use_by_active_config:
        "Workflow is in use by active AI role config",
      invalid_nodes: "Invalid nodes payload",
      duplicate_node_id: "Duplicate node id detected",
      invalid_node_type: "Invalid node type",
      invalid_edges: "Invalid edges payload",
      invalid_edge_reference: "Edge references unknown node id",
      invalid_edge_cycle: "Cycle detected in workflow edges",

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
      no_tickets_found_for_sealos_user: "No tickets found for this User ID",
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
      internal_messages: "Internal Messages",
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
      checking_video: "Checking video...",
      checking_file: "Checking file...",
      kb_added: "Added to Knowledge Base",
      send_message_shortcut: "Send message (Cmd+Enter)",
      send_message: "Send message",
      enter_message: "Enter message...",
      selected_count: "Selected: {{count}}",

      // File upload and error messages
      file_upload_failed: "File upload failed",
      file_upload_error: "An error occurred during file upload",
      knowledge_file_parse_failed: "File parsing failed",
      knowledge_category: {
        troubleshooting: "Troubleshooting", feature: "Feature description", billing: "Billing",
        operation: "Operating rules", other: "Other",
      },
      knowledge_field: {
        title: "Title", title_hint: "Used as the list and retrieval result title", title_placeholder: "e.g. Account login failed",
        content: "Content", content_placeholder: "Enter the formal knowledge content returned to the AI", modules: "Applicable modules",
        no_modules: "No modules available", category: "Knowledge type", category_placeholder: "Select a knowledge type",
        revision: "Revision", revision_placeholder: "e.g. manual-2026-08-20", indexes: "Retrieval indexes",
        indexes_hint: "Up to three, optional", auto_generate: "Auto-generate", generate_indexes: "Generate indexes",
        generating_indexes: "Generating", index_label: "Retrieval index {{index}}", index_placeholder: "A question users may ask, optional",
      },
      knowledge_file_import: {
        title: "Import knowledge base file", description: "Select a file, adjust chunking, and review each item before adding it to the existing general knowledge base.", not_selected: "No file selected",
        selected_count: "{{selected}}/{{total}} candidates selected", waiting_parse: "Waiting for parsing", steps_label: "File import steps",
        step_file: "Select file", step_settings: "Settings", step_preview: "Data preview",
        step_confirm: "Confirm import", local_file: "Local file", supported_files: "Supports .md, .txt, .html, .pdf, .docx, .csv, and .xlsx, up to 10 MB",
        default_modules: "Default ticket modules", default_category: "Default knowledge type", next_settings: "Next: Settings",
        chunk_settings_title: "Choose a chunking method", chunk_settings_description: "Default parameters fit most Markdown files. Custom parameters support paragraphs, target length, or custom separators.",
        chunk_default: "Default parameters", chunk_default_description: "Process Markdown headings and natural paragraphs; length and overlap are selected automatically.",
        chunk_custom: "Custom parameters", chunk_custom_description: "Choose paragraphs, target length, or custom separators for unusual file structures.",
        chunk_split_mode: "Chunking mode", chunk_split_paragraph: "Paragraphs and headings", chunk_split_size: "Target length", chunk_split_char: "Custom separators",
        chunk_split_paragraph_hint: "Use Markdown headings and natural paragraphs. Candidate titles use the current heading.",
        chunk_split_size_hint: "Ignore Markdown heading boundaries and split by natural text units toward the target length.",
        chunk_split_char_hint: "Split by the literal separators you provide before applying the normal length rules.",
        chunk_paragraph_title: "Paragraph and heading settings", chunk_paragraph_description: "Candidate titles use the current heading; parent headings provide context only.",
        chunk_size_title: "Target length settings",
        chunk_separator_title: "Custom separator settings",
        title_depth: "Heading depth", title_depth_option: "Recognize through H{{level}}", deeper_title_hint: "Deeper headings remain in the current knowledge content.",
        chunk_separator: "Custom separators", chunk_separator_placeholder: "\\n\\n|====", chunk_separator_hint: "Use | between separators and \\n for a line break. Up to 10 separators and 200 characters.",
        chunk_size: "Target chunk length", chunk_size_hint: "Natural boundaries may make a chunk slightly longer than this target.", previous: "Previous",
        generate_preview: "Generate preview", parsing: "Parsing", file_parsing: "Uploading and parsing the file...", review_title: "Review candidate knowledge",
        review_description: "Each candidate can be edited for title, content, modules, knowledge type, and indexes.", selected_badge: "Selected {{count}}", total_badge: "Total {{count}}",
        max_badge: "Up to 100", select_all: "Select all candidates", untitled: "Untitled",
        index_complete: "Indexes ready", index_failed: "Index generation failed", index_pending: "Index pending",
        imported: "Imported", import_failed: "Import failed", skipped: "Skipped",
        import_pending: "Import pending", duplicate_current: "The content duplicates another candidate in this file", duplicate_existing: "The content duplicates existing knowledge",
        skip: "Skip", continue_import: "Continue import", retry_index: "Retry indexes",
        retry_import: "Retry import", content_modified_warning: "The content was modified, so retrieval indexes may no longer match. You can still continue importing.",
        select_candidate: "Select a candidate", batch_title: "Batch settings and processing status", batch_description: "Batch settings apply only to the currently selected candidates.",
        import_pending_count: "Import pending {{count}}", import_success_count: "Import successful {{count}}",
        import_failed_count: "Import failed {{count}}", index_generating: "Generating indexes",
        index_complete_status: "Index processing complete", index_progress_aria: "Index generation progress",
        bulk_modules: "Batch set modules", bulk_category: "Batch set knowledge type", no_change: "No change",
        apply: "Apply", back_settings: "Back to settings", one_click_index: "Generate indexes",
        next_confirm: "Next: Confirm import", confirm_title: "Confirm import", file: "File",
        candidate_count: "Candidate count", index_status: "Index status", failed_status: "Failure status",
        no_failed: "No failed items", import_progress: "Import progress", processing_complete: "Processing complete",
        confirm_import: "Confirm and import selected content", cancel: "Cancel", error_save: "Failed to import general knowledge",
        error_title_required: "Title cannot be empty", error_title_max: "Title cannot exceed 200 characters", error_modules_required: "Select at least one module",
        error_modules_max: "No more than {{max}} modules can be selected", error_category_required: "Select a knowledge type",
        error_revision_required: "Revision cannot be empty", error_content_required: "Content cannot be empty",
        error_content_max: "Content cannot exceed 20,000 characters", error_indexes_max: "No more than 3 retrieval indexes",
        error_file_extension: "Only .md, .txt, .html, .pdf, .docx, .csv, and .xlsx files are supported", error_file_size: "File cannot exceed 10 MB",
        error_duplicate_file: "A file with the same content was already selected in this session (previous file: {{fileName}})", error_file_read: "Failed to read the file. Please select it again.",
        error_file_reading: "The file is still being read. Please wait.", error_choose_file: "Please select a file first",
        error_empty_file: "The file is empty and cannot be parsed", error_default_modules: "Please select default ticket modules first",
        error_default_category: "Please select a default knowledge type first", error_chunk_size: "Custom chunk length must be between 64 and 4000", error_chunk_splitter: "Custom separators must contain 1 to 10 non-empty items and be no longer than 200 characters",
        error_title_depth: "Title recognition depth must be from H1 to H8", error_duplicate_check: "Duplicate check failed",
        error_no_candidates: "No importable text was parsed from the file.", error_rechunk_confirm: "Rechunking will replace edits to the current candidates. Continue?",
        error_choose_read_file: "Please select and read a file first", error_choose_candidate: "Select at least one candidate",
        error_fix_required: "Fix the required fields in the selected candidates first", error_index_generation: "Failed to generate retrieval indexes",
        error_bulk_choose: "Select candidates first", import_progress_aria: "Import progress",
      },
      knowledge_error: {
        source_id: "Knowledge ID must use the format general_knowledge:{source_doc_id}:{entry_slug}", title_required: "Title cannot be empty", title_max: "Title cannot exceed {{max}} characters", modules_required: "Select at least one module",
        modules_max: "No more than {{max}} modules can be selected", category_required: "Select a valid knowledge type", revision_required: "Revision cannot be empty",
        content_required: "Content cannot be empty", indexes_max: "No more than 3 retrieval indexes", index_max: "Each retrieval index cannot exceed {{max}} characters",
        file_missing: "Select a file to parse", file_name: "The file name is invalid", file_extension: "Only .md, .txt, .html, .pdf, .docx, .csv, and .xlsx files are supported",
        file_size: "File cannot exceed 10 MB", file_read: "The file could not be read", file_corrupt: "The file is damaged or has an invalid structure",
        file_encrypted: "Encrypted files are not supported", file_no_text: "No readable text was found in the file", file_parse_failed: "The file could not be parsed",
        file_parse_limit: "The file content exceeds the parsing limit", invalid_request: "Invalid request",
        chunk_size: "Custom chunk length must be between 64 and 4000", title_depth: "Title recognition depth must be from H1 to H8", chunk_splitter: "Custom separators must contain 1 to 10 non-empty items and be no longer than 200 characters", candidates_max: "More than 100 candidates were parsed. Split the file.",
        index_not_configured: "Retrieval index generation is not configured", index_generation_failed: "Failed to generate general knowledge retrieval indexes",
      },
      knowledge_warning: {
        unsupported_content: "Images, charts, and content requiring OCR are not supported and were ignored.",
      },
      knowledge_base_entry: {
        title: "Knowledge base", description: "Manage business knowledge that AI support can retrieve when answering customers; indexes are rebuilt after saving.", import_file: "Import file",
        add_general: "Add general knowledge", refresh: "Refresh",
      },
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
      invalid_or_expired_binding_session: "Invalid or expired binding session.",
      bound_user_not_found: "Bound user not found after binding",

      // Ticket Module Management
      ticket_module_management: "Ticket Module Management",
      ticket_module_management_desc:
        "Manage ticket modules and their translations",
      create_module: "Create Module",
      edit_module: "Edit Ticket Module",
      create_ticket_module: "Create Ticket Module",
      code: "Code",
      code_required: "Code *",
      code_placeholder: "e.g. bug_report",
      code_cannot_change: "Code cannot be changed after creation",
      icon: "Icon",
      chinese_translation: "Chinese Translation (zh-CN) *",
      chinese_translation_placeholder: "e.g. 错误报告",
      english_translation: "English Translation (en-US) *",
      english_translation_placeholder: "e.g. Bug Report",
      sort_order: "Sort Order",
      actions: "Actions",
      no_ticket_modules_found: "No ticket modules found",
      ticket_module_created: "Ticket module created successfully",
      ticket_module_updated: "Ticket module updated successfully",
      ticket_module_deleted: "Ticket module deleted successfully",
      failed_create_ticket_module: "Failed to create ticket module",
      failed_update_ticket_module: "Failed to update ticket module",
      failed_delete_ticket_module: "Failed to delete ticket module",
      validation_error: "Validation Error",
      code_translations_required: "Code and translations are required",
      confirm_delete_ticket_module:
        "Are you sure you want to delete this ticket module?",
      update: "Update",
      // Data Analytics
      analytics: "Data Analytics",
      analytics_filter: "Analytics Filter",
      all_staff:'All Staff',
      // Ticket status analysis module translation keys
      hot_issues_analysis: "Hot Issues Analysis",
      tkt_backlog_rate_error:"Ticket Backlog Rate Error",
      ticket_status_analysis: "Ticket Status Analysis",
      key_metrics: "Key Metrics",
      backlog_rate: "Backlog Rate",
      pending_tickets: "Pending Tickets",
      in_progress_tickets: "In Progress Tickets",
      completion_rate: "Completion Rate",
      suggestions: "Suggestions",
      percentage: "Percentage",
      current_backlog_percentage: "Current unprocessed ticket percentage",
      exceed_normal_level: "exceeds normal level",
      suggest_increase_staff: "suggest increasing processing staff",

      // Ticket volume trends module translation keys
      ticket_volume_trends: "Ticket Volume Trends",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly",
      ticket_count: "Ticket Count",
      ticket_response_time_analysis: "Ticket Response Time Analysis",
      average_first_response_time: "Average First Response Time",
      average_resolution_time: "Average Resolution Time",
      range: "Range",
      hours: "Hours",

      // Module analysis module
      module_analysis: "Module Analysis",

      // Rating module
      rating_distribution_analysis: "Rating Distribution Analysis",
      total_rating_count: "Total Rating Count",
      unrated: "Unrated",
      star: "Star",
      times: "Times",
      manual_transfer_distribution: "Manual Transfer Distribution",
      transferred_to_agent_tickets: "Transferred to Agent Tickets",
      not_transferred_to_agent_tickets: "Not Transferred to Agent Tickets",

      // Knowledge base hit distribution module
      knowledge_base_hit_distribution: "Knowledge Base Hit Distribution",
      hit_rate: "Hit Rate",
      access_count: "Access Count",
      potential_zone: "Potential Zone",
      recommend_adding_guidance: "Recommend adding relevant guidance and recommendations",
      high_efficiency_zone: "High Efficiency Zone",
      maintain_and_promote_content: "Maintain and promote this content",
      low_efficiency_zone: "Low Efficiency Zone",
      recommend_updating_content: "Recommend updating or removing content",
      needs_optimization: "Needs Optimization",
      recommend_improving_accuracy: "Recommend improving content accuracy",
      questions: "Questions",

      // Popular issues analysis
      top_popular_issues: "Top Popular Issues",
      tag_issue_count: "Tag Issue Count",

      // Intelligent analysis insights module
      intelligent_analysis_insights: "Intelligent Analysis Insights",

      // Additional keys for ticket status analysis
      current: "Current",
      increase_manpower: "increase processing manpower",

      // Additional keys for ticket trend chart
      hourly: "Hourly",
      no_data: "No Data",

      // Additional keys for rating analysis
      count: "Count",
      total_tickets: "Total Tickets",

      // Additional keys for knowledge base hits
      previous_page: "Previous Page",
      next_page: "Next Page",

      // Additional keys for hot issues analysis
      key_findings: "Key Findings",
      improvement_suggestions: "Improvement Suggestions",
      data_driven_strategy: "Data-Driven Strategy",
      analyzing_data: "Analyzing data...",

      // Additional keys for module analysis
      uncategorized: "Uncategorized",

      // react-flow i18n resources
      rf: {
        nodeType: {
          emotionDetector: "Emotion Detection",
          handoff: "Handoff",
          smartChat: "Smart Chat",
          escalationOffer: "Escalation Offer",
          variableSetter: "Variable Setter",
          rag: "RAG",
          start: "Start",
          end: "End",
        },
        var: {
          search_placeholder: "Search variables...",
          not_found: "No variables found",
          global_group: "Global Variables",
          node_group: "Node Variables - {{name}}",
          desc: {
            ticketDescription: "Ticket description content",
            ticketModule: "Ticket module",
            ticketCategory: "Ticket category",
            ticketTitle: "Ticket title",
            lastCustomerMessage: "Most recent customer message",
            historyMessages: "Conversation history messages",
            userQuery: "User query content",
            emotionDetector: {
              sentiment:
                "Detected sentiment label (NEUTRAL, FRUSTRATED, ANGRY, etc.)",
              stylePrompt: "Style prompt generated based on sentiment",
              handoffReason: "Reason for handoff",
              handoffPriority: "Handoff priority (P1, P2, P3)",
              handoffRequired: "Whether handoff is required (true/false)",
            },
            escalationOffer: {
              proposeEscalation: "Whether escalation is proposed (true/false)",
              escalationReason: "Reason for escalation proposal",
              handoffPriority: "Handoff priority (P1, P2, P3)",
            },
            rag: {
              retrievedContextString:
                "Retrieved context content (formatted string)",
              retrievedContextCount: "Number of retrieved context items",
              hasRetrievedContext: "Whether context was retrieved (true/false)",
            },
          },
        },
        mcp: {
          enabled: "Enabled",
          ai_auto_select_api: "AI Auto-select API",
          system_prompt_placeholder:
            "System prompt for AI API selection (Liquid variables supported)",
          user_prompt_placeholder:
            "User prompt for AI API selection (Liquid variables supported)",
          ai_selection_hint:
            "Tip: After AI is enabled, the backend first asks AI to select an API from the apis allowlist. If AI fails, it falls back to the manually selected selectedApiId.",
          supported_apis: "Supported APIs (apis)",
          add_api: "Add",
          empty_api_hint:
            "No APIs yet. Click \"Add\" to add one first (recommended: quota: GET /api/quota)",
          delete_api: "Delete",
          api_path_placeholder: "Enter API path",
          selected_api: "Current execution API (selectedApiId)",
          select_api: "Select an API",
          add_api_first: "Add an API first",
          fallback_api_hint: "Default API when AI is disabled",
        },
        ui: {
          dialog_title_edit_text: "Edit text content",
          tip_press: "Press",
          tip_insert_variable: "to insert variable",
          available_count: "({{count}} available)",
          finish_editing: "Finish Editing",
        },
      },
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
      other: "其他",

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
      pending_reply: "待回复",
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
      sealos_id: "用户 ID",
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
      sealos_auth_not_ready:
        "Sealos 账号校验未完成，请从 Sealos 重新打开工单页面",

      // Login/Register page
      login: "登录",
      register: "注册",
      login_title: "欢迎使用 Tentix Inc.",
      register_title: "注册",
      field_name: "用户名",
      field_password: "密码",
      ph_name: "请输入用户名",
      ph_password: "请输入密码",
      btn_login: "登录",
      or: "或",
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
      force_relogin_required: "您的账户权限已变更,请重新登录。",
      user_already_exists: "用户已存在",
      failed_create_user: "创建用户失败",
      user_not_found: "用户不存在",
      please_register_first: "请先注册账号",
      registration_failed: "注册失败",

      // Password reset
      reset_password_title: "重置密码",
      reset_password_for_user: "为用户重置密码：{{name}}",
      field_current_password: "当前密码",
      field_new_password: "新密码",
      field_confirm_password: "确认密码",
      ph_current_password: "请输入当前密码",
      ph_new_password: "请输入新密码",
      ph_confirm_password: "请确认新密码",
      btn_reset_password: "重置密码",
      btn_back_to_login: "返回登录",
      password_not_match: "密码不匹配",
      password_reset_success: "密码重置成功",
      password_reset_success_desc: "您的密码已成功重置",
      password_reset_failed: "密码重置失败",

      // Admin workflow & AI role config errors
      workflow_not_found: "未找到工作流",
      workflow_name_exists: "工作流名称已存在",
      active_ai_role_exists_in_scope: "scope '{{scope}}' 下已有激活的 AI 角色",
      workflow_in_use_by_active_config: "工作流被激活的 AI 角色配置使用",
      invalid_nodes: "无效的节点数据",
      duplicate_node_id: "存在重复的节点 ID",
      invalid_node_type: "无效的节点类型",
      invalid_edges: "无效的边数据",
      invalid_edge_reference: "边引用了不存在的节点",
      invalid_edge_cycle: "检测到环路，边不允许形成环",

      // WebSocket and chat
      send_failed: "发送失败",
      send_error_generic: "发送消息时出现错误",
      not_joined_cannot_send: "你尚未加入该工单，无法发送消息",
      join_this_ticket: "加入此工单",
      joining: "加入中...",

      // Table pagination and empty states
      total: "总共",
      page: "页",
      no_tickets_found: "未找到工单",
      no_tickets_found_for_sealos_user: "未找到该用户 ID 的工单",
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
      internal_messages: "内部消息",
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
      checking_video: "正在检查视频...",
      checking_file: "正在检查文件...",
      kb_added: "已收录到知识库",
      send_message_shortcut: "发送消息 (Cmd+Enter)",
      send_message: "发送消息",
      enter_message: "输入消息...",
      selected_count: "已选：{{count}}",

      // File upload and error messages
      file_upload_failed: "文件上传失败",
      file_upload_error: "文件上传时出现错误",
      knowledge_file_parse_failed: "文件解析失败",
      knowledge_category: {
        troubleshooting: "故障排查", feature: "功能说明", billing: "费用计费",
        operation: "运营规则", other: "其他",
      },
      knowledge_field: {
        title: "标题", title_hint: "用于列表显示和召回结果标题", title_placeholder: "例如：账号登录失败",
        content: "正文", content_placeholder: "填写会返回给 AI 的正式知识内容", modules: "适用模块",
        no_modules: "暂无可选模块", category: "知识类型", category_placeholder: "选择知识类型",
        revision: "版本", revision_placeholder: "例如：manual-2026-08-20", indexes: "召回索引",
        indexes_hint: "最多填写三条，可留空", auto_generate: "自动生成", generate_indexes: "生成索引",
        generating_indexes: "生成中", index_label: "召回索引 {{index}}", index_placeholder: "用户可能的问法，可留空",
      },
      knowledge_file_import: {
        title: "导入知识库文件", description: "选择文件，调整分块方式，逐条确认后写入现有通用知识库。", not_selected: "尚未选择文件",
        selected_count: "{{selected}}/{{total}} 条候选已选", waiting_parse: "等待解析", steps_label: "文件导入步骤",
        step_file: "选择文件", step_settings: "参数设置", step_preview: "数据预览",
        step_confirm: "确认导入", local_file: "本地文件", supported_files: "支持 .md、.txt、.html、.pdf、.docx、.csv、.xlsx，最大 10 MB",
        default_modules: "默认工单模块", default_category: "默认知识类型", next_settings: "下一步：参数设置",
        chunk_settings_title: "选择分块方式", chunk_settings_description: "默认参数适合大多数 Markdown 文件。自定义参数支持段落、目标长度或自定义分隔符。",
        chunk_default: "默认参数", chunk_default_description: "按 Markdown 标题和自然段落处理，系统自动选择长度和重叠方式。",
        chunk_custom: "自定义参数", chunk_custom_description: "文件结构特殊时，可以选择段落、目标长度或自定义分隔符。",
        chunk_split_mode: "分块方式", chunk_split_paragraph: "按段落和标题", chunk_split_size: "按目标长度", chunk_split_char: "按自定义分隔符",
        chunk_split_paragraph_hint: "使用 Markdown 标题和自然段落。候选标题使用当前标题。",
        chunk_split_size_hint: "忽略 Markdown 标题边界，按自然文本单元向目标长度拆分。",
        chunk_split_char_hint: "优先按你填写的文字分隔符拆分，再处理超出目标长度的内容。",
        chunk_paragraph_title: "段落和标题设置", chunk_paragraph_description: "候选标题使用当前标题；父级标题只作为正文上下文。",
        chunk_size_title: "目标长度设置",
        chunk_separator_title: "自定义分隔符设置",
        title_depth: "识别到第几级标题", title_depth_option: "识别到 H{{level}}", deeper_title_hint: "更深的标题会留在当前知识正文里。",
        chunk_separator: "自定义分隔符", chunk_separator_placeholder: "\\n\\n|====", chunk_separator_hint: "使用 | 分隔多个分隔符，使用 \\n 表示换行。最多 10 个分隔符，总长度不超过 200 个字符。",
        chunk_size: "目标分块长度", chunk_size_hint: "自然段落、句子或其他边界可能使候选内容略微超过该目标。", previous: "上一步",
        generate_preview: "生成预览", parsing: "解析中", file_parsing: "正在上传并解析文件...", review_title: "候选知识审核",
        review_description: "每条候选都可以修改标题、正文、模块、知识类型和索引。", selected_badge: "已选 {{count}}", total_badge: "共 {{count}}",
        max_badge: "最多 100 条", select_all: "全选候选", untitled: "未填写标题",
        index_complete: "索引完成", index_failed: "索引失败", index_pending: "索引待处理",
        imported: "已导入", import_failed: "导入失败", skipped: "已跳过",
        import_pending: "待导入", duplicate_current: "与当前文件中的其他候选正文重复", duplicate_existing: "与已有知识正文重复",
        skip: "跳过", continue_import: "继续导入", retry_index: "重试索引",
        retry_import: "重试导入", content_modified_warning: "正文已修改，召回索引可能不再匹配。你仍然可以继续导入。",
        select_candidate: "请选择候选知识", batch_title: "批量设置和处理状态", batch_description: "批量设置只作用于当前勾选的候选。",
        import_pending_count: "导入待处理 {{count}}", import_success_count: "导入成功 {{count}}",
        import_failed_count: "导入失败 {{count}}", index_generating: "索引生成中",
        index_complete_status: "索引处理完成", index_progress_aria: "索引生成进度",
        bulk_modules: "批量设置模块", bulk_category: "批量设置知识类型", no_change: "不修改",
        apply: "应用", back_settings: "返回参数设置", one_click_index: "一键生成索引",
        next_confirm: "下一步：确认导入", confirm_title: "确认导入", file: "文件",
        candidate_count: "候选数量", index_status: "索引状态", failed_status: "失败状态",
        no_failed: "没有失败项", import_progress: "导入进度", processing_complete: "处理完成",
        confirm_import: "确认并导入选中内容", cancel: "取消", error_save: "导入通用知识失败",
        error_title_required: "标题不能为空", error_title_max: "标题不能超过 200 个字符", error_modules_required: "至少选择一个模块",
        error_modules_max: "模块数量不能超过 {{max}} 个", error_category_required: "请选择知识类型",
        error_revision_required: "版本不能为空", error_content_required: "正文不能为空",
        error_content_max: "正文不能超过 20000 个字符", error_indexes_max: "召回索引最多 3 条",
        error_file_extension: "仅支持 .md、.txt、.html、.pdf、.docx、.csv、.xlsx 文件", error_file_size: "文件不能超过 10 MB",
        error_duplicate_file: "本次页面会话已选择过内容相同的文件（上次文件名：{{fileName}}）", error_file_read: "文件读取失败，请重新选择文件",
        error_file_reading: "文件仍在读取，请稍候", error_choose_file: "请先选择文件",
        error_empty_file: "文件内容为空，无法解析", error_default_modules: "请先选择默认工单模块",
        error_default_category: "请先选择默认知识类型", error_chunk_size: "自定义分块长度必须在 64 到 4000 之间", error_chunk_splitter: "自定义分隔符必须包含 1 到 10 个非空项，且总长度不能超过 200 个字符",
        error_title_depth: "标题识别层级必须在 H1 到 H8 之间", error_duplicate_check: "重复检查失败",
        error_no_candidates: "文件中没有解析出可导入的文字内容", error_rechunk_confirm: "重新分块会替换当前候选的编辑内容，是否继续？",
        error_choose_read_file: "请先选择并读取文件", error_choose_candidate: "请至少选择一条候选知识",
        error_fix_required: "请先修正已选候选中的必填内容", error_index_generation: "召回索引生成失败",
        error_bulk_choose: "请先选择候选知识", import_progress_aria: "导入进度",
      },
      knowledge_error: {
        source_id: "知识 ID 格式应为 general_knowledge:{source_doc_id}:{entry_slug}", title_required: "标题不能为空", title_max: "标题不能超过 {{max}} 个字符", modules_required: "至少选择一个模块",
        modules_max: "模块数量不能超过 {{max}} 个", category_required: "请选择有效的知识类型", revision_required: "版本不能为空",
        content_required: "正文不能为空", indexes_max: "召回索引最多 3 条", index_max: "每条召回索引不能超过 {{max}} 个字符",
        file_missing: "请选择要解析的文件", file_name: "文件名无效", file_extension: "仅支持 .md、.txt、.html、.pdf、.docx、.csv、.xlsx 文件",
        file_size: "文件不能超过 10 MB", file_read: "文件无法读取", file_corrupt: "文件损坏或结构无效",
        file_encrypted: "不支持加密文件", file_no_text: "文件中没有可读取的文字", file_parse_failed: "文件解析失败",
        file_parse_limit: "文件内容超过解析限制", invalid_request: "请求无效",
        chunk_size: "自定义分块长度必须在 64 到 4000 之间", title_depth: "标题识别层级必须在 H1 到 H8 之间", chunk_splitter: "自定义分隔符必须包含 1 到 10 个非空项，且总长度不能超过 200 个字符", candidates_max: "解析结果超过 100 条，请拆分文件",
        index_not_configured: "AI 召回索引生成未配置", index_generation_failed: "通用知识召回索引生成失败",
      },
      knowledge_warning: {
        unsupported_content: "不支持图片、图表以及需要 OCR 解析的内容，这些内容已被忽略。",
      },
      knowledge_base_entry: {
        title: "知识库", description: "管理 AI 客服回答时可召回的业务知识，保存后自动重建索引。", import_file: "导入文件",
        add_general: "添加通用知识", refresh: "刷新",
      },
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
      feishu_bind_tip_fast_login:
        "绑定飞书账户后，您可以使用飞书账户快速登录系统",
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

      // Ticket Module Management
      ticket_module_management: "工单模块管理",
      ticket_module_management_desc: "管理工单模块及其多语言翻译",
      create_module: "创建模块",
      edit_module: "编辑工单模块",
      create_ticket_module: "创建工单模块",
      code: "代码",
      code_required: "代码 *",
      code_placeholder: "例如：bug_report",
      code_cannot_change: "代码创建后无法修改",
      icon: "图标",
      chinese_translation: "中文翻译 (zh-CN) *",
      chinese_translation_placeholder: "例如：错误报告",
      english_translation: "英文翻译 (en-US) *",
      english_translation_placeholder: "例如：Bug Report",
      sort_order: "排序",
      actions: "操作",
      no_ticket_modules_found: "未找到工单模块",
      ticket_module_created: "工单模块创建成功",
      ticket_module_updated: "工单模块更新成功",
      ticket_module_deleted: "工单模块删除成功",
      failed_create_ticket_module: "创建工单模块失败",
      failed_update_ticket_module: "更新工单模块失败",
      failed_delete_ticket_module: "删除工单模块失败",
      validation_error: "验证错误",
      code_translations_required: "代码和翻译为必填项",
      confirm_delete_ticket_module: "确定要删除此工单模块吗？",
      update: "更新",
      // 数据分析
      analytics: "数据分析",
      analytics_filter: "筛选",
      today: "今天",
      all_staff: "全部员工",
      // 工单分析状态模块翻译键
      ticket_status_analysis: "工单状态分析",
      key_metrics: "关键指标",
      backlog_rate: "积压率",
      pending_tickets: "待处理工单",
      in_progress_tickets: "处理中工单",
      completion_rate: "完成率",
      suggestions: "建议",
      percentage: "占比",

      // 工单数量趋势模块翻译键
      ticket_volume_trends: "工单数量趋势",
      daily: "按日",
      weekly: "按周",
      monthly: "按月",
      yearly: "按年",
      ticket_count: "工单数量",
      ticket_response_time_analysis: "工单响应时长分析",
      average_first_response_time: "平均首次响应时长",
      average_resolution_time: "平均解决时长",
      range: "范围",
      hours: "小时",

      // 模块分析模块
      module_analysis: "模块分析",

      // 评分模块
      rating_distribution_analysis: "评分占比分析分布",
      total_rating_count: "总评分次数",
      unrated: "未评分",
      star: "星",
      times: "次",
      manual_transfer_distribution: "转人工情况分布",
      transferred_to_agent_tickets: "转人工工单",
      not_transferred_to_agent_tickets: "未转人工工单",

      // 知识库命中分布模块
      knowledge_base_hit_distribution: "知识库命中分布",
      hit_rate: "命中率",
      access_count: "访问数",
      potential_zone: "潜力区",
      recommend_adding_guidance: "建议增加相关引导和推荐",
      high_efficiency_zone: "高效区",
      maintain_and_promote_content: "保持并推广该部分内容",
      low_efficiency_zone: "低效区",
      recommend_updating_content: "建议更新或移除内容",
      needs_optimization: "需优化",
      recommend_improving_accuracy: "建议提高内容准确性",
      questions: "问题",

      // 热门问题分析
      hot_issues_analysis: "热门问题分析",
      top_popular_issues: "热门问题TOP榜单",
      tag_issue_count: "标签问题数量",

      // 智能分析洞察模块
      intelligent_analysis_insights: "智能分析洞察",

      // 工单状态分析额外键
      tkt_backlog_rate_error:"工单积压率警告",
      current: "当前",
      exceed_normal_level: "超过正常水平",
      increase_manpower: "增加处理人力",
      current_backlog_percentage: "当前未处理工单占比",
      suggest_increase_staff: "建议增加处理人力",

      // 工单趋势图表额外键
      hourly: "按小时",
      no_data: "无数据",

      // 评分分析额外键
      count: "数量",
      total_tickets: "总工单数",

      // 知识库命中分析额外键
      previous_page: "上一页",
      next_page: "下一页",

      // 热门问题分析额外键
      key_findings: "关键发现",
      improvement_suggestions: "改进建议",
      data_driven_strategy: "数据驱动策略",
      analyzing_data: "正在分析数据...",

      // 模块分析额外键
      uncategorized: "未分类",

      // react-flow i18n resources
      rf: {
        nodeType: {
          emotionDetector: "情绪检测",
          handoff: "转人工",
          smartChat: "智能聊天",
          escalationOffer: "升级询问",
          variableSetter: "变量设置",
          rag: "检索增强生成",
          start: "开始",
          end: "结束",
        },
        var: {
          search_placeholder: "搜索变量...",
          not_found: "未找到变量",
          global_group: "全局变量",
          node_group: "节点变量 - {{name}}",
          desc: {
            ticketDescription: "工单描述内容",
            ticketModule: "工单所属模块",
            ticketCategory: "工单分类",
            ticketTitle: "工单标题",
            lastCustomerMessage: "最近一条客户消息",
            historyMessages: "历史对话消息",
            userQuery: "用户查询内容",
            emotionDetector: {
              sentiment: "检测到的情绪标签 (NEUTRAL, FRUSTRATED, ANGRY等)",
              stylePrompt: "根据情绪生成的风格提示",
              handoffReason: "转人工原因",
              handoffPriority: "转人工优先级 (P1, P2, P3)",
              handoffRequired: "是否需要转人工 (true/false)",
            },
            escalationOffer: {
              proposeEscalation: "是否建议升级 (true/false)",
              escalationReason: "建议升级的原因",
              handoffPriority: "转人工优先级 (P1, P2, P3)",
            },
            rag: {
              retrievedContextString: "检索到的上下文内容（格式化字符串）",
              retrievedContextCount: "检索到的上下文数量",
              hasRetrievedContext: "是否有检索到的上下文 (true/false)",
            },
          },
        },
        mcp: {
          enabled: "启用",
          ai_auto_select_api: "AI 自动选择接口",
          system_prompt_placeholder:
            "用于 AI 选择接口的系统提示词（支持 Liquid 变量）",
          user_prompt_placeholder:
            "用于 AI 选择接口的用户提示词（支持 Liquid 变量）",
          ai_selection_hint:
            "提示：开启 AI 后，后端会先让 AI 在 apis 白名单里选一个接口；AI 失败会回退到你手动选择的 selectedApiId。",
          supported_apis: "支持接口（apis）",
          add_api: "新增",
          empty_api_hint:
            "还没有接口，点击“新增”添加一条（建议先加 quota: GET /api/quota）",
          delete_api: "删除",
          api_path_placeholder: "请填写接口地址",
          selected_api: "当前执行接口（selectedApiId）",
          select_api: "请选择接口",
          add_api_first: "请先新增接口",
          fallback_api_hint: "关闭AI默认执行的接口",
        },
        ui: {
          dialog_title_edit_text: "编辑文本内容",
          tip_press: "按",
          tip_insert_variable: "插入变量",
          available_count: "（{{count}} 个可用）",
          finish_editing: "完成编辑",
        },
      },
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
  const join = i18nBase.language === "zh" ? "" : " ";
  return keys.join(join);
}

export { useTranslation, Trans } from "react-i18next";
