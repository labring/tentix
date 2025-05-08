type cardType = {
  msg_type: "interactive";
  card: {
    type: "template";
    data: {
      template_id: string;
      template_version_name: string;
      template_variable?: Record<string, any>;
    };
  };
};

type CardType = "new_ticket";

const cardMap: Record<"new_ticket", cardType> = {
  new_ticket: {
    msg_type: "interactive",
    card: {
      type: "template",
      data: {
        template_id: "AAq4SPHXffwrs",
        template_version_name: "1.0.3",
      },
    },
  },
};

type Card1Variable = {
  title: string;
  description: string;
  time: string;
  assignee: string;
  number: number;
  ticket_url: {
    url: string;
  };
};

export async function sendFeishuCard(
  cardType: CardType,
  variable: Card1Variable,
) {
  const data = Object.assign(cardMap[cardType], {
    card: {
      ...cardMap[cardType].card,
      data: {
        ...cardMap[cardType].card.data,
        template_variable: variable,
      },
    },
  }) satisfies cardType;
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bot/v2/hook/${process.env.FEISHU_BOT_WEBHOOK_URL}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    throw new Error("Failed to send Feishu card");
  }
  return res.json();
}
