import i18nBase from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

export const i18next = i18nBase.use(initReactI18next).init({
  debug: process.env.NODE_ENV !== "production",
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translation: {
        hello: "Hello",
        tkt_one: "ticket",
        tkt_other: "tickets",
        team: "team",
        reports: "reports",
        klg_base: "knowledge base",
        ntfcs: "notifications",
        settings: "settings",
        docs_management: "docs management",

        area: "area",
        title: "title",
        category: "category",
        priority: "priority",
        status: "status",
        rqst_by: "requested by",
        created_at: "created at",
        updated_at: "updated at",
        sbmt_date: "submitted at",

        all: "all",
        pending: "pending",
        in_progress: "in progress",
        completed: "completed",

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

        tkt_list: "$t(tkt_other) list",
        tkt_system: "$t(tkt_other) system",
        tkt_create: "create $t(tkt_one)",
        tkt_edit: "edit $t(tkt_one)",
        tkt_delete: "delete $t(tkt_one)",
        tkt_view: "view $t(tkt_one)",
        tkt_status: "$t(tkt_other) status",
        tkt_status_pending: "pending",
        dashboard: "dashboard",

        // Error and Not Found Pages
        error_title: "Error",
        error_message: "Sorry, something went wrong",
        not_found_title: "Not Found",
        not_found_message: "The page you're looking for doesn't exist",
        go_back: "Go back",

        plz_pvd_info: "Provide information about your issue or request",
      },
    },
    zh: {
      translation: {
        dashboard: "面板",
        tkt_one: "工单",
        tkt_other: "工单",
        team: "团队",
        reports: "报告",
        klg_base: "知识库",
        settings: "设置",
        ntfcs: "通知",
        docs_management: "文档管理",

        area: "区域",
        title: "标题",
        category: "分类",
        priority: "优先级",
        status: "状态",
        rqst_by: "提交者",
        created_at: "创建时间",
        updated_at: "更新时间",
        sbmt_date: "提交时间",

        all: "全部",
        pending: "待处理",
        in_progress: "处理中",
        completed: "已完成",
        scheduled: "计划中",
        resolved: "已解决",

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

        other: "其他",
        bug: "bug",
        feature: "功能",
        question: "问题",

        open_menu: "打开菜单",
        view_details: "查看详情",
        update_status: "更新状态",
        transfer: "转移工单",

        adjust_prty: "调整优先级",
        raise_req: "提高优先级",
        mark_as_solved: "标记为已解决",
        close: "关闭",

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

        // Error and Not Found Pages
        error_title: "错误",
        error_message: "抱歉，出现了错误",
        not_found_title: "未找到",
        not_found_message: "您正在寻找的页面不存在",
        go_back: "返回",
        reset: "重置",

        create_new_ticket: "创建新工单",
        select: "选择",
        details: "详情",
        plz_pvd_info: "请提供有关您的问题或请求的信息",
        title_ph: "简要描述您的问题或请求",

        module: "模块",

        
        applaunchpad: "应用管理",
        costcenter: "费用中心",
        appmarket: "应用市场",
        db: "数据库",
        account_center: "账户中心",
        aiproxy: "AI Proxy",
        devbox: "Devbox",
        task: "任务",
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
        desc_ph: "在此输入描述... 图片可以拖拽或粘贴",

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


        tktH: {
          create: "$t(tkt)创建",
          update: "$t(tkt)信息更新",
          assign: "$t(tkt)被系统分配给了{{assignee}}",
          close: "$t(tkt)关闭",
          upgrade: "$t(tkt)优先级变化为 - {{priority}}",
          resolve: "$t(tkt)被标记为已解决",
          transfer: "$t(tkt)被转交给{{assignee}}",
          makeRequest: "提出了需求",
          other: "$t(other)",
        },

        info: "信息",
        assigned_to: "指派给",
        last_updated: "最后更新$t(time)",
        dateTime: "{{val, datetime}}",
      },
    },
  },
});

export default i18nBase;

export function joinTrans(keys: string[]) {
  const { i18n } = useTranslation();
  const join = i18n.language === "zh" ? "" : " ";
  return keys.join(join);
}

export { useTranslation, Trans } from "react-i18next";
