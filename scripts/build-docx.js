/**
 * 将 docs/user-manual.md 转换为 Word 文档（docx-js 实现）。
 *
 * 用法：node scripts/build-docx.js
 * 输出：docs/特教安全教育资源仪-用户操作手册.docx
 * 依赖：docx（npm install --no-save --no-package-lock docx）
 *
 * 支持的手册 Markdown 子集：#/##/### 标题、表格、- 无序列表（两级）、
 * 1. 有序列表、> 引用块、![图片](路径)、**粗体**、`代码`、*斜体*、--- 分隔线。
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, LevelFormat, TableOfContents, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  Footer,
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'docs', 'user-manual.md');
const IMG_DIR = path.join(ROOT, 'docs', 'manual-images');
const OUT = path.join(ROOT, 'docs', '特教安全教育资源仪-用户操作手册.docx');

const BODY_FONT = 'Microsoft YaHei';
const CODE_FONT = 'Consolas';
const BODY_SIZE = 22; // 11pt
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const CELL_BORDERS = { top: TABLE_BORDER, bottom: TABLE_BORDER, left: TABLE_BORDER, right: TABLE_BORDER };

// ---------- PNG 尺寸读取（仅解析 IHDR） ----------
function pngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('非 PNG: ' + file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------- 行内格式解析 ----------
function parseInline(text) {
  const runs = [];
  // 依次匹配 **粗体**、`代码`、[链接](url)
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]*\))/g;
  let last = 0;
  for (let m of text.matchAll(re)) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index) }));
    const tok = m[0];
    if (tok.startsWith('**')) {
      runs.push(new TextRun({ text: tok.slice(2, -2), bold: true }));
    } else if (tok.startsWith('`')) {
      runs.push(new TextRun({ text: tok.slice(1, -1), font: CODE_FONT, size: BODY_SIZE - 2 }));
    } else {
      // [文字](链接)：链接作为纯文字（Word 版不做跳转）
      runs.push(new TextRun({ text: tok.match(/^\[([^\]]+)\]/)[1] }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
  return runs;
}

function textOnly(text) {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

// ---------- Markdown 块解析 ----------
function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^#{1,3} /.test(line)) {
      const level = line.match(/^(#+)/)[1].length;
      blocks.push({ type: 'heading', level, text: line.replace(/^#+\s*/, '') });
      i++;
    } else if (/^---+\s*$/.test(line)) {
      i++; // 分隔线忽略
    } else if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i].replace(/-+/g, '-'))) {
          rows.push(lines[i]);
        }
        i++;
      }
      // 过滤掉分隔行（如 |---|---|）
      blocks.push({ type: 'table', rows: rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r)) });
    } else if (/^>/.test(line)) {
      const quoted = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoted.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: quoted.join('') });
    } else if (/^\s*- /.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*- /.test(lines[i])) {
        const m = lines[i].match(/^(\s*)- (.*)$/);
        items.push({ level: m[1].length >= 2 ? 1 : 0, text: m[2] });
        i++;
      }
      blocks.push({ type: 'bullets', items });
    } else if (/^\s*\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s*/, ''));
        i++;
      }
      blocks.push({ type: 'numbered', items });
    } else if (/^!\[.*\]\(.*\)$/.test(line)) {
      const m = line.match(/^!\[(.*)\]\((.*)\)$/);
      blocks.push({ type: 'image', alt: m[1], file: m[2] });
      i++;
    } else {
      blocks.push({ type: 'para', text: line });
      i++;
    }
  }
  return blocks;
}

// ---------- docx 元素生成 ----------
const numberingConfig = [{ reference: 'bullet-list', levels: [
  { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 260 } } } },
  { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 900, hanging: 260 } } } },
]}];
let numRefCounter = 0;

function renderBlock(block, isFirstChapterHeading = false) {
  switch (block.type) {
    case 'heading': {
      if (block.level === 1) {
        return new Paragraph({
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: !isFirstChapterHeading,
          children: [new TextRun({ text: textOnly(block.text) })],
        });
      }
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: textOnly(block.text) })],
      });
    }
    case 'para':
      return new Paragraph({
        spacing: { after: 120, line: 340 },
        children: parseInline(block.text),
      });
    case 'quote':
      return new Paragraph({
        spacing: { before: 80, after: 160, line: 340 },
        indent: { left: 300 },
        shading: { type: ShadingType.CLEAR, fill: 'FFF6E9' },
        children: parseInline(block.text),
      });
    case 'bullets':
      return block.items.map(
        (it) => new Paragraph({
          numbering: { reference: 'bullet-list', level: it.level },
          spacing: { after: 60, line: 340 },
          children: parseInline(it.text),
        })
      );
    case 'numbered': {
      const ref = `num-${++numRefCounter}`;
      numberingConfig.push({ reference: ref, levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 260 } } } },
      ]});
      return block.items.map(
        (it) => new Paragraph({
          numbering: { reference: ref, level: 0 },
          spacing: { after: 60, line: 340 },
          children: parseInline(it),
        })
      );
    }
    case 'table': {
      const cells = block.rows.map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const cols = cells[0].length;
      const totalWidth = 9026; // A4 可用宽度（约 15.9cm）
      const colWidth = Math.floor(totalWidth / cols);
      return new Table({
        columnWidths: Array(cols).fill(colWidth),
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        rows: cells.map((row, ri) => new TableRow({
          tableHeader: ri === 0,
          children: row.map((cell) => new TableCell({
            borders: CELL_BORDERS,
            width: { size: colWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'DCE9F7' } : undefined,
            children: [new Paragraph({ spacing: { after: 0, line: 300 }, children: parseInline(cell) })],
          })),
        })),
      });
    }
    case 'image': {
      const file = path.join(IMG_DIR, path.basename(block.file));
      if (!fs.existsSync(file)) throw new Error('图片不存在: ' + file);
      const { w, h } = pngSize(file);
      const maxW = block.alt.includes('卡片') ? 380 : 600;
      const width = Math.min(maxW, w);
      const height = Math.round((h / w) * width);
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 40 },
          children: [new ImageRun({
            type: 'png',
            data: fs.readFileSync(file),
            transformation: { width, height },
            altText: { title: block.alt, description: block.alt, name: block.alt },
          })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: `图：${block.alt}`, size: 18, color: '808080' })],
        }),
      ];
    }
    default:
      return [];
  }
}

// ---------- 主流程 ----------
const md = fs.readFileSync(MD, 'utf8');
const lines = md.split(/\r?\n/);
const blocks = parseBlocks(lines);
// 跳过顶部 H1 标题（作为文档标题单独渲染）
const contentBlocks = blocks.filter((b) => !(b.type === 'heading' && b.level === 1));

const children = [];
children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('特教安全教育资源仪 · 用户操作手册')] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 }, children: [new TextRun({ text: '适用版本：1.0.3', size: 22, color: '595959' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: '适用对象：学校教师、家长等日常使用者', size: 22, color: '595959' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: '软件激活由安装方负责，本手册不涉及激活/许可相关内容', size: 20, color: '808080' })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new TableOfContents('目录', { hyperlink: true, headingStyleRange: '1-2' }));
children.push(new Paragraph({ children: [new PageBreak()] }));

let firstChapter = true;
for (const block of contentBlocks) {
  if (block.type === 'heading' && block.level === 1) {
    const out = renderBlock(block, firstChapter);
    children.push(...(Array.isArray(out) ? out : [out]));
    firstChapter = false;
  } else {
    const out = renderBlock(block);
    if (Array.isArray(out)) children.push(...out);
    else if (out) children.push(out);
  }
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: BODY_FONT, size: BODY_SIZE } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal',
        run: { size: 44, bold: true, color: '1F3864', font: BODY_FONT },
        paragraph: { spacing: { before: 3600, after: 480 }, alignment: AlignmentType.CENTER } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: '1F3864', font: BODY_FONT },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, color: '2F5496', font: BODY_FONT },
        paragraph: { spacing: { before: 260, after: 140 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: numberingConfig },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '第 ', size: 18, color: '808080' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '808080' }),
            new TextRun({ text: ' 页 / 共 ', size: 18, color: '808080' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '808080' }),
            new TextRun({ text: ' 页', size: 18, color: '808080' }),
          ],
        })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log(`✅ 已生成 ${OUT}（${(buffer.length / 1024).toFixed(0)}KB）`);
});
