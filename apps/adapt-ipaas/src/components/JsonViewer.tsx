'use client';

interface JsonViewerProps {
  data: Record<string, unknown> | null;
  title?: string;
  maxHeight?: string;
}

function syntaxHighlight(json: string): string {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export default function JsonViewer({ data, title, maxHeight = '500px' }: JsonViewerProps) {
  if (!data) {
    return (
      <div className="json-viewer flex items-center justify-center" style={{ minHeight: '200px' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>No data available</p>
      </div>
    );
  }

  const formatted = JSON.stringify(data, null, 2);
  const highlighted = syntaxHighlight(formatted);

  return (
    <div>
      {title && (
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          {title}
        </h3>
      )}
      <div
        className="json-viewer"
        style={{ maxHeight, overflowY: 'auto' }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
