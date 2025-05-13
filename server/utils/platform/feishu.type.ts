

export type FeishuDepartmentsInfo = {
  code: number;
  data: {
    items: {
      chat_id: string;
      department_id: string;
      group_chat_employee_types: number[];
      i18n_name: {
        en_us: string;
        ja_jp: string;
        zh_cn: string;
      };
      leaders: {
        leaderType: number;
      }[];
      name: string;
      open_department_id: string;
      status: {
        is_deleted: boolean;
      };
    }[];
  };
  msg: string;
};
