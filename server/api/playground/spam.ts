export const loremText = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          marks: [
            {
              type: "bold",
            },
          ],
          text: "Lorem Ipsum",
        },
        {
          type: "text",
          marks: [
            {
              type: "textStyle",
              attrs: {
                color: "rgb(0, 0, 0)",
              },
            },
          ],
          text: " is ",
        },
        {
          type: "text",
          marks: [
            {
              type: "textStyle",
              attrs: {
                color: "rgb(0, 0, 0)",
              },
            },
            {
              type: "italic",
            },
            {
              type: "underline",
            },
          ],
          text: "simply dummy text",
        },
        {
          type: "text",
          marks: [
            {
              type: "textStyle",
              attrs: {
                color: "rgb(0, 0, 0)",
              },
            },
          ],
          text: " of the printing and typesetting industry. ",
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. ",
            },
            {
              type: "text",
              marks: [
                {
                  type: "code",
                },
              ],
              text: "code something",
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          marks: [
            {
              type: "code",
            },
          ],
          text: "code something",
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: {
        language: null,
      },
      content: [
        {
          type: "text",
          text: "test",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          marks: [
            {
              type: "textStyle",
              attrs: {
                color: "rgb(0, 0, 0)",
              },
            },
            {
              type: "strike",
            },
          ],
          text: "It has survived not only five centuries,",
        },
        {
          type: "text",
          marks: [
            {
              type: "textStyle",
              attrs: {
                color: "rgb(0, 0, 0)",
              },
            },
          ],
          text: " but also the leap into electronic typesetting, remaining essentially unchanged. ",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          marks: [
            {
              type: "textStyle",
              attrs: {
                color: "rgb(0, 0, 0)",
              },
            },
          ],
          text: "It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
        },
      ],
    },
  ],
};
