import React from 'react'

/**
 * Lightweight Markdown rendering component
 * No third-party dependencies. Covers syntax common in Q&A scenarios: headings,
 * bold, inline code, ordered/unordered lists (with nested indentation), and plain paragraphs.
 */

/** Inline parsing: **bold**, `inline code` */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*.+?\*\*|`[^`]+?`)/g
  let lastIndex = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      parts.push(
        <strong key={`${keyPrefix}-b${i}`} className="md-strong">{tok.slice(2, -2)}</strong>,
      )
    } else {
      parts.push(
        <code key={`${keyPrefix}-c${i}`} className="md-code">{tok.slice(1, -1)}</code>,
      )
    }
    lastIndex = m.index + tok.length
    i++
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface ListItem {
  indent: number
  ordered: boolean
  content: string
}

interface ListNode {
  item: ListItem
  children: ListNode[]
}

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/

/** Build consecutive list items into a nested tree by indentation and render */
function renderList(items: ListItem[], keyBase: string): React.ReactNode {
  const uniqueIndents = Array.from(new Set(items.map((it) => it.indent))).sort((a, b) => a - b)
  const levelOf = (indent: number) => uniqueIndents.indexOf(indent)

  const root: ListNode[] = []
  const stack: ListNode[] = []
  items.forEach((it) => {
    const node: ListNode = { item: it, children: [] }
    const level = levelOf(it.indent)
    while (stack.length > level) stack.pop()
    if (stack.length === 0) root.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  })

  let k = 0
  const renderNodes = (nodes: ListNode[]): React.ReactNode => {
    const ordered = nodes[0]?.item.ordered
    const Tag = (ordered ? 'ol' : 'ul') as 'ol' | 'ul'
    return (
      <Tag className="md-list" key={`${keyBase}-l${k++}`}>
        {nodes.map((n) => {
          const key = `${keyBase}-li${k++}`
          return (
            <li className="md-li" key={key}>
              {parseInline(n.item.content, key)}
              {n.children.length > 0 && renderNodes(n.children)}
            </li>
          )
        })}
      </Tag>
    )
  }
  return renderNodes(root)
}

const MarkdownText: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // Heading # ~ ####
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (h) {
      const level = h[1].length
      const key2 = `h${key++}`
      blocks.push(
        <div key={key2} className={`md-h md-h${level}`}>{parseInline(h[2], key2)}</div>,
      )
      i++
      continue
    }

    // Consecutive list
    if (LIST_RE.test(line)) {
      const items: ListItem[] = []
      while (i < lines.length && LIST_RE.test(lines[i])) {
        const mm = LIST_RE.exec(lines[i])!
        items.push({ indent: mm[1].length, ordered: /\d+\./.test(mm[2]), content: mm[3] })
        i++
      }
      blocks.push(<div key={`l${key++}`}>{renderList(items, `l${key}`)}</div>)
      continue
    }

    // Plain paragraph
    const key3 = `p${key++}`
    blocks.push(<p key={key3} className="md-p">{parseInline(trimmed, key3)}</p>)
    i++
  }

  return <div className="md-body">{blocks}</div>
}

export default MarkdownText
