import React, { ReactNode, useMemo } from 'react';
import { JSONContent } from '@tiptap/react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css'; // 可以选择其他样式
import './content-styles.css';

// 创建代码块组件进行高亮
const CodeBlock = ({ language, content }: { language: string; content: string }) => {
  const highlightedCode = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(content, { language }).value;
    } else {
      return hljs.highlightAuto(content).value;
    }
  }, [language, content]);

  return (
    <pre className={`content-code-block hljs language-${language || 'plaintext'}`}>
      <code 
        className={language ? `language-${language}` : ''}
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </pre>
  );
};

export const renderContent = (content: JSONContent): ReactNode => {
  if (!content) return null;

  // 处理文档根节点
  if (content.type === 'doc') {
    return (
      <div className="content-doc">
        {content.content?.map((node, index) => renderContent(node))}
      </div>
    );
  }

  // 处理段落
  if (content.type === 'paragraph') {
    return (
      <p key={Math.random()} className="content-paragraph">
        {content.content?.map((node, index) => renderContent(node))}
      </p>
    );
  }

  // 处理代码块
  if (content.type === 'codeBlock') {
    const language = content.attrs?.language || '';
    const codeContent = content.content?.map((node) => node.text).join('') || '';
    
    return (
      <CodeBlock 
        key={Math.random()} 
        language={language} 
        content={codeContent} 
      />
    );
  }

  // 处理无序列表
  if (content.type === 'bulletList') {
    return (
      <ul key={Math.random()} className="content-bullet-list">
        {content.content?.map((node, index) => renderContent(node))}
      </ul>
    );
  }

  if (content.type === 'listItem') {
    return (
      <li key={Math.random()} className="content-list-item">
        {content.content?.map((node, index) => renderContent(node))}
      </li>
    );
  }

  if (content.type === 'blockquote') {
    return (
      <blockquote key={Math.random()} className="content-blockquote">
        {content.content?.map((node, index) => renderContent(node))}
      </blockquote>
    );
  }

  if (content.type === 'image') {
    return (
      <PhotoProvider key={Math.random()}>
        <div className="content-image-container">
          <PhotoView src={content.attrs?.src || ''}>
            <img 
              src={content.attrs?.src || ''} 
              alt={content.attrs?.alt || ''} 
              title={content.attrs?.title || ''} 
              width={content.attrs?.width} 
              height={content.attrs?.height}
              className="content-image cursor-pointer"
            />
          </PhotoView>
        </div>
      </PhotoProvider>
    );
  }

  if (content.type === 'text') {
    let textNode: ReactNode = content.text || '';
    
    if (content.marks) {
      content.marks.forEach(mark => {
        switch (mark.type) {
          case 'bold':
            textNode = <strong key={Math.random()} className="content-bold">{textNode}</strong>;
            break;
          case 'italic':
            textNode = <em key={Math.random()} className="content-italic">{textNode}</em>;
            break;
          case 'underline':
            textNode = <u key={Math.random()} className="content-underline">{textNode}</u>;
            break;
          case 'strike':
            textNode = <s key={Math.random()} className="content-strike">{textNode}</s>;
            break;
        }
      });
    }
    
    return textNode;
  }

  return null;
};

export const ContentRenderer = ({ content }: { content: JSONContent }) => {
  return <div className="content-renderer">{renderContent(content)}</div>;
};

export default ContentRenderer; 