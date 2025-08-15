// 排除敏感信息
export const basicUserCols = {
  columns: {
    id: true,
    name: true,
    nickname: true,
    avatar: true,
    role: true,
  },
} as const;

export const membersCols = {
  agent: basicUserCols,
  customer: basicUserCols,
  technicians: {
    with: {
      user: basicUserCols,
    },
  },
} as const;
