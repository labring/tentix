import { type ReactNode, useMemo } from 'react';
import { type JSONContent } from '@tiptap/react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import hljs from 'highlight.js/lib/core';

import 'highlight.js/styles/github.css';
import './content-styles.css';

import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';


hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);

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

const RenderContent = ({content}: {content: JSONContent}): ReactNode => {
  if (!content) return null;

  if (content.type === 'doc') {
    return (
      <>
        {content.content?.map((node, index) => <RenderContent key={index} content={node} />)}
      </>
    );
  }

  if (content.type === 'paragraph') {
    return (
      <p 
        key={Math.random()} 
        className="content-paragraph"
        style={{
          wordBreak: 'break-all',
          overflowWrap: 'anywhere',
          maxWidth: '100%',
          minWidth: 0
        }}
      >
        {content.content?.map((node, index) => <RenderContent key={index} content={node} />)}
      </p>
    );
  }

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

  if (content.type === 'bulletList') {
    return (
      <ul key={Math.random()} className="content-bullet-list">
        {content.content?.map((node, index) => <RenderContent key={index} content={node} />)}
      </ul>
    );
  }

  // 添加有序列表处理
  if (content.type === 'orderedList') {
    return (
      <ol key={Math.random()} className="content-ordered-list" start={content.attrs?.start || 1}>
        {content.content?.map((node, index) => <RenderContent key={index} content={node} />)}
      </ol>
    );
  }

  if (content.type === 'listItem') {
    return (
      <li key={Math.random()} className="content-list-item">
        {content.content?.map((node, index) => <RenderContent key={index} content={node} />)}
      </li>
    );
  }

  if (content.type === 'blockquote') {
    return (
      <blockquote key={Math.random()} className="content-blockquote">
        {content.content?.map((node, index) => <RenderContent key={index} content={node} />)}
      </blockquote>
    );
  }

  // 添加标题处理
  if (content.type === 'heading') {
    const level = content.attrs?.level || 1;
    const className = `content-heading content-heading-${level}`;
    const children = content.content?.map((node, index) => <RenderContent key={index} content={node} />);
    
    switch (level) {
      case 1:
        return <h1 key={Math.random()} className={className}>{children}</h1>;
      case 2:
        return <h2 key={Math.random()} className={className}>{children}</h2>;
      case 3:
        return <h3 key={Math.random()} className={className}>{children}</h3>;
      case 4:
        return <h4 key={Math.random()} className={className}>{children}</h4>;
      case 5:
        return <h5 key={Math.random()} className={className}>{children}</h5>;
      case 6:
        return <h6 key={Math.random()} className={className}>{children}</h6>;
      default:
        return <h1 key={Math.random()} className={className}>{children}</h1>;
    }
  }

  // 添加水平线处理
  if (content.type === 'horizontalRule') {
    return <hr key={Math.random()} className="content-horizontal-rule" />;
  }

  // 添加硬换行处理
  if (content.type === 'hardBreak') {
    return <br key={Math.random()} />;
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
          case 'code':
            textNode = <code key={Math.random()} className="content-inline-code">{textNode}</code>;
            break;
        }
      });
    }
    
    return textNode;
  }

  return null;
};

const ContentRenderer = ({ doc, isMine = false }: { doc: JSONContent, isMine?: boolean }) => {
  return <div 
    className={`content-renderer ${isMine ? 'my-msg' : 'other-msg'}`}
    style={{
      wordBreak: 'break-all',
      overflowWrap: 'anywhere',
      maxWidth: '100%',
      minWidth: 0
    }}
  >
    <RenderContent content={doc} />
  </div>;
};

export default ContentRenderer; 