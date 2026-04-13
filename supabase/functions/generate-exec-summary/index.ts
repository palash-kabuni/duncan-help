import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopType, TabStopPosition } from "https://esm.sh/docx@9.6.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DocSection {
  type: "heading1" | "heading2" | "heading3" | "bullet" | "numbered" | "paragraph";
  text: string;
  bold?: boolean;
}

function parseMarkdownToSections(content: string): DocSection[] {
  const lines = content.split("\n");
  const sections: DocSection[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("### ")) {
      sections.push({ type: "heading3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("## ")) {
      sections.push({ type: "heading2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("# ")) {
      sections.push({ type: "heading1", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      sections.push({ type: "bullet", text: trimmed.slice(2) });
    } else if (/^\d+\.\s/.test(trimmed)) {
      sections.push({ type: "numbered", text: trimmed.replace(/^\d+\.\s/, "") });
    } else {
      sections.push({ type: "paragraph", text: trimmed });
    }
  }
  return sections;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), font: "Arial", size: 22 }));
    }
    if (match[1]) {
      runs.push(new TextRun({ text: match[1], bold: true, font: "Arial", size: 22 }));
    } else if (match[2]) {
      runs.push(new TextRun({ text: match[2], italics: true, font: "Arial", size: 22 }));
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), font: "Arial", size: 22 }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, font: "Arial", size: 22 }));
  }

  return runs;
}

function buildDocxDocument(title: string, weekRange: string, content: string, companyName: string): Document {
  const sections = parseMarkdownToSections(content);
  const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, font: "Arial", size: 36, color: "1A1A2E" })],
    spacing: { after: 100 },
  }));

  // Subtitle
  children.push(new Paragraph({
    children: [new TextRun({ text: weekRange, font: "Arial", size: 24, color: "64748B" })],
    spacing: { after: 60 },
  }));

  // Date line
  children.push(new Paragraph({
    children: [new TextRun({ text: `Generated on ${now} by Duncan AI`, font: "Arial", size: 18, color: "94A3B8" })],
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1A1A2E", space: 8 } },
  }));

  // Spacer
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // Content
  let bulletIndex = 0;
  for (const section of sections) {
    switch (section.type) {
      case "heading1":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: section.text, bold: true, font: "Arial", size: 28, color: "1A1A2E" })],
          spacing: { before: 300, after: 150 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0", space: 4 } },
        }));
        break;
      case "heading2":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: section.text, bold: true, font: "Arial", size: 24, color: "334155" })],
          spacing: { before: 250, after: 120 },
        }));
        break;
      case "heading3":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: section.text, bold: true, font: "Arial", size: 22, color: "475569" })],
          spacing: { before: 200, after: 100 },
        }));
        break;
      case "bullet":
        children.push(new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: parseInlineFormatting(section.text),
          spacing: { before: 40, after: 40 },
        }));
        break;
      case "numbered":
        bulletIndex++;
        children.push(new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: parseInlineFormatting(section.text),
          spacing: { before: 40, after: 40 },
        }));
        break;
      case "paragraph":
        children.push(new Paragraph({
          children: parseInlineFormatting(section.text),
          spacing: { before: 80, after: 80 },
        }));
        break;
    }
  }

  // Footer spacer + confidential note
  children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  children.push(new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0", space: 8 } },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Confidential — ${companyName} — Generated by Duncan Intelligence System`, font: "Arial", size: 16, color: "94A3B8" })],
  }));

  return new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0,
            format: "bullet" as any,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
        {
          reference: "numbers",
          levels: [{
            level: 0,
            format: "decimal" as any,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: "Arial", size: 22 } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { title, week_range, content, company_name } = body;

    if (!content || !title) {
      return new Response(JSON.stringify({ error: "title and content are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weekRange = week_range || "Weekly Executive Summary";
    const companyName = company_name || "Kabuni";

    // Generate DOCX
    const doc = buildDocxDocument(title, weekRange, content, companyName);
    const docxBuffer = await Packer.toBuffer(doc);

    // Build filename
    const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `${safeTitle}_${dateStr}.docx`;
    const blobPath = `executive-summaries/${fileName}`;

    // Upload to Azure Blob Storage
    const formData = new FormData();
    const file = new File([docxBuffer], fileName, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("file", file);
    formData.append("action", "upload");
    formData.append("path", "executive-summaries");

    const uploadRes = await fetch(`${supabaseUrl}/functions/v1/azure-blob-api`, {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Upload failed: ${err}`);
    }

    const uploadData = await uploadRes.json();

    const downloadUrl = `${supabaseUrl}/functions/v1/azure-blob-api?action=download&path=${encodeURIComponent(blobPath)}`;

    return new Response(
      JSON.stringify({
        success: true,
        file_name: fileName,
        blob_path: blobPath,
        blob_url: uploadData.url,
        download_url: downloadUrl,
        message: `Executive summary "${title}" has been generated as a Word document and saved.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Generate exec summary error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
