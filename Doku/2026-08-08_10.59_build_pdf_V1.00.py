#!/usr/bin/env python3
"""
Projekt-Pass PDF-Generator
===========================
Liest projekt-pass.json und erzeugt daraus PROJEKT-PASS.pdf.

Aufruf:
    python3 build_pdf.py
    python3 build_pdf.py pfad/zur/projekt-pass.json pfad/zur/ausgabe.pdf

Gedacht zur Nutzung durch eine KI (z.B. Claude Code): projekt-pass.json ist die
editierbare Quelle (einfaches JSON, kein Binärformat) - dieses Skript wandelt sie
bei Bedarf in ein sauber formatiertes PDF um. Die KI sollte projekt-pass.json direkt
bearbeiten (neue Changelog-Zeile, neuer Dienst, etc.) und danach dieses Skript
laufen lassen, um das PDF zu aktualisieren.
"""

import sys
import json
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

INK = colors.HexColor("#1E2027")
INK_SOFT = colors.HexColor("#5B6270")
ACCENT = colors.HexColor("#2F4858")
LINE = colors.HexColor("#D8DCE1")
ROW_ALT = colors.HexColor("#F6F8F9")
WARN = colors.HexColor("#B3452F")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=ACCENT, spaceAfter=2))
styles.add(ParagraphStyle(name="DocSub", fontName="Helvetica", fontSize=10.5, leading=14, textColor=INK_SOFT, spaceAfter=14))
styles.add(ParagraphStyle(name="SectionHead", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=ACCENT, spaceBefore=18, spaceAfter=6))
styles.add(ParagraphStyle(name="SectionSub", fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=INK, spaceBefore=10, spaceAfter=4))
styles.add(ParagraphStyle(name="Guidance", fontName="Helvetica-Oblique", fontSize=9, leading=12.5, textColor=INK_SOFT, spaceAfter=6))
styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK))
styles.add(ParagraphStyle(name="CellHead", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=colors.white))
styles.add(ParagraphStyle(name="Cell", fontName="Helvetica", fontSize=8.7, leading=12, textColor=INK))
styles.add(ParagraphStyle(name="Warn", fontName="Helvetica-Bold", fontSize=8.5, leading=12, textColor=WARN))
styles.add(ParagraphStyle(name="MetaLabel", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=INK_SOFT))
styles.add(ParagraphStyle(name="MetaValue", fontName="Helvetica", fontSize=10, leading=13, textColor=INK))


_TRANSLITERATE = {
    "–": "-", "—": " - ",  # en dash, em dash
    "‘": "'", "’": "'",  # curly single quotes
    "“": '"', "”": '"',  # curly double quotes
    "…": "...",  # ellipsis
}


def esc(text):
    """Escape characters that reportlab's mini-XML would misinterpret, and drop
    glyphs the base-14 PDF fonts can't render (emoji etc. show as black boxes).
    Common typographic characters (en/em dash, curly quotes, ellipsis) are
    transliterated to ASCII first instead of being silently dropped - otherwise
    e.g. "38.000-48.000" (em dash) collapses into the unreadable "38.00048.000"."""
    if text is None:
        return ""
    text = str(text)
    for ch, replacement in _TRANSLITERATE.items():
        text = text.replace(ch, replacement)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # strip remaining characters outside Latin-1 (covers most emoji/symbols base fonts lack)
    text = "".join(ch for ch in text if ord(ch) < 256)
    return text


def P(text, style="Body"):
    return Paragraph(esc(text), styles[style])


def PR(text, style="Body"):
    """Like P(), but for trusted static strings we write ourselves (may contain
    intentional &nbsp; / &amp; markup) - skips the escaping/stripping in esc()."""
    return Paragraph(text, styles[style])


def section_table(rows, col_widths, header=True):
    data = []
    for i, row in enumerate(rows):
        style = "CellHead" if (header and i == 0) else "Cell"
        data.append([P(c, style) for c in row])
    if not rows or len(rows) == (1 if header else 0):
        data.append([P("-", "Cell") for _ in col_widths])
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    cmds = [
        ('BOX', (0, 0), (-1, -1), 0.6, LINE),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    if header:
        cmds.append(('BACKGROUND', (0, 0), (-1, 0), ACCENT))
        for r in range(1, len(data)):
            if r % 2 == 0:
                cmds.append(('BACKGROUND', (0, r), (-1, r), ROW_ALT))
    t.setStyle(TableStyle(cmds))
    return t


def meta_block(meta_rows):
    data = [[P(k, "MetaLabel"), P(v or "-", "MetaValue")] for k, v in meta_rows]
    t = Table(data, colWidths=[45 * mm, 120 * mm])
    t.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    return t


def build(json_path, pdf_path):
    d = json.loads(Path(json_path).read_text(encoding="utf-8"))

    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=16 * mm,
        title=f"Projekt-Pass - {d.get('projektname', '')}",
    )
    story = []

    story.append(PR("PROJEKT-PASS", "DocTitle"))
    story.append(P(d.get("projektname", ""), "DocSub"))
    story.append(meta_block([
        ("Projektname", d.get("projektname", "")),
        ("Live seit", d.get("live_seit", "")),
        ("Dokument zuletzt aktualisiert", d.get("aktualisiert", "")),
        ("Nächste Prüfung fällig", d.get("naechste_pruefung", "")),
    ]))
    story.append(Spacer(1, 6 * mm))

    story.append(PR("1&nbsp;&nbsp;Ausgangslage &amp; Absicht", "SectionHead"))
    story.append(PR("Welches Problem sollte gelöst werden? Für wen? Was war der Auslöser?", "Guidance"))
    story.append(P(d.get("absicht", ""), "Body"))
    story.append(Spacer(1, 3 * mm))

    story.append(PR("2&nbsp;&nbsp;Funktionsumfang", "SectionHead"))
    story.append(section_table([["Funktion", "Kurzbeschreibung"]] + d.get("funktionen", []), [45 * mm, 125 * mm]))
    story.append(Spacer(1, 3 * mm))

    story.append(PR("3&nbsp;&nbsp;Abhängigkeiten", "SectionHead"))
    story.append(PR("3.1&nbsp; Hosting", "SectionSub"))
    story.append(section_table([["Was", "Wo / URL"]] + d.get("hosting", []), [45 * mm, 125 * mm]))

    story.append(PR("3.2&nbsp; Beteiligte Dienste", "SectionSub"))
    story.append(section_table([["Dienst", "Zweck", "Kritikalität"]] + d.get("dienste", []), [45 * mm, 90 * mm, 35 * mm]))

    story.append(PR("3.3&nbsp; Tools, Accounts &amp; Zugangsdaten", "SectionSub"))
    story.append(PR("Kein Klartext-Passwort - nur der Hinweis, WO es hinterlegt ist.", "Guidance"))
    story.append(section_table([["Dienst", "Account / E-Mail", "Passwort hinterlegt in"]] + d.get("accounts", []), [40 * mm, 65 * mm, 65 * mm]))
    story.append(Spacer(1, 3 * mm))

    story.append(PR("4&nbsp;&nbsp;Änderungsprotokoll", "SectionHead"))
    changelog = d.get("changelog", [])
    changelog_sorted = [changelog[0]] + sorted(changelog[1:], key=lambda r: r[0], reverse=True) if changelog else []
    story.append(section_table([["Datum", "Version", "Änderung"]] + changelog_sorted, [25 * mm, 20 * mm, 125 * mm]))
    story.append(Spacer(1, 3 * mm))

    story.append(PR("5&nbsp;&nbsp;Aktualisierungs-Rhythmus", "SectionHead"))
    story.append(P(d.get("rhythmus", ""), "Body"))

    offene = d.get("offene_punkte", [])
    if offene:
        story.append(Spacer(1, 3 * mm))
        story.append(PR("Offene Punkte / unklar", "SectionSub"))
        for op in offene:
            story.append(P("• " + op, "Warn"))

    kosten = d.get("kosten_und_wertschaetzung", "")
    if kosten:
        story.append(Spacer(1, 3 * mm))
        story.append(PR("6&nbsp;&nbsp;Kosten- &amp; Werteinschätzung", "SectionHead"))
        story.append(PR("Grobe, informelle KI-Schätzung zur Einordnung — keine professionelle Bewertung.", "Guidance"))
        story.append(P(kosten, "Body"))

    doc.build(story)
    print(f"OK: {pdf_path} erzeugt aus {json_path}")


if __name__ == "__main__":
    json_arg = sys.argv[1] if len(sys.argv) > 1 else "projekt-pass.json"
    pdf_arg = sys.argv[2] if len(sys.argv) > 2 else "PROJEKT-PASS.pdf"
    build(json_arg, pdf_arg)
