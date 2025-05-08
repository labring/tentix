import React from 'react';
import { ContentRenderer } from './content-renderer.js';
import { JSONContent } from '@tiptap/react';

// 您提供的测试内容
const testContent: JSONContent = {
  "type": "doc",
  "content": [
      {
          "type": "codeBlock",
          "attrs": {
              "language": "typescript"
          },
          "content": [
              {
                  "type": "text",
                  "text": "console.log('Hello, world!')"
              }
          ]
      },
      {
          "type": "bulletList",
          "content": [
              {
                  "type": "listItem",
                  "content": [
                      {
                          "type": "paragraph",
                          "content": [
                              {
                                  "type": "text",
                                  "text": "Ancilla quidem c"
                              },
                              {
                                  "type": "text",
                                  "marks": [
                                      {
                                          "type": "strike"
                                      },
                                      {
                                          "type": "underline"
                                      }
                                  ],
                                  "text": "ado canoni"
                              },
                              {
                                  "type": "text",
                                  "text": "cus cimentarius convoco"
                              },
                              {
                                  "type": "text",
                                  "marks": [
                                      {
                                          "type": "bold"
                                      },
                                      {
                                          "type": "italic"
                                      }
                                  ],
                                  "text": " accusantium b"
                              },
                              {
                                  "type": "text",
                                  "text": "revis stabilis."
                              }
                          ]
                      }
                  ]
              },
              {
                  "type": "listItem",
                  "content": [
                      {
                          "type": "paragraph",
                          "content": [
                              {
                                  "type": "text",
                                  "text": "Hic convoco crur verbera "
                              },
                              {
                                  "type": "text",
                                  "marks": [
                                      {
                                          "type": "bold"
                                      }
                                  ],
                                  "text": "vinculum"
                              },
                              {
                                  "type": "text",
                                  "text": " cena"
                              },
                              {
                                  "type": "text",
                                  "marks": [
                                      {
                                          "type": "strike"
                                      },
                                      {
                                          "type": "underline"
                                      }
                                  ],
                                  "text": "culu"
                              },
                              {
                                  "type": "text",
                                  "text": "m."
                              }
                          ]
                      }
                  ]
              }
          ]
      },
      {
          "type": "blockquote",
          "content": [
              {
                  "type": "paragraph",
                  "content": [
                      {
                          "type": "text",
                          "marks": [
                              {
                                  "type": "bold"
                              }
                          ],
                          "text": "Vivo rerum appositus tersus strues nesciunt coerceo. Ab eos villa adipisci veritatis chirographum sordeo "
                      },
                      {
                          "type": "text",
                          "marks": [
                              {
                                  "type": "bold"
                              },
                              {
                                  "type": "italic"
                              },
                              {
                                  "type": "underline"
                              }
                          ],
                          "text": "laudantium error pel. "
                      }
                  ]
              }
          ]
      },
      {
          "type": "paragraph",
          "content": [
              {
                  "type": "text",
                  "text": "Consequuntur vulgo supra coadunatio antea tunc amissio reiciendis."
              }
          ]
      },
      {
          "type": "image",
          "attrs": {
              "src": "https://alkktkqgapi.sealosgzg.site/tentix-dev/2025-05-07/5lnhsg-image.png",
              "alt": "",
              "title": "",
              "id": null,
              "width": 204.28959375,
              "height": 120,
              "fileName": null
          }
      }
  ]
};

export const TestRenderer: React.FC = () => {
  return (
    <div className="test-renderer">
      <h2>测试富文本渲染</h2>
      <div className="content-container">
        <ContentRenderer content={testContent} />
      </div>
    </div>
  );
};

export default TestRenderer; 