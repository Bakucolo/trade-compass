import os
from jinja2 import Environment, FileSystemLoader

def generate_pdf(data: dict, output_filename: str):
    """
    Renders research data to an institutional-grade PDF report using ReportLab
    with Executive Scorecard, structured financial tables, risk callouts, and typography.
    """
    output_path = os.path.join(os.path.dirname(__file__), output_filename)
    report_title = data.get('report_title', f"{data.get('ticker', 'ASSET')} Research Report")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#0f172a'),
            alignment=1,
            spaceAfter=4
        )

        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor('#64748b'),
            alignment=1,
            spaceAfter=10
        )

        h1_style = ParagraphStyle(
            'SectionH1',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#1e293b'),
            spaceBefore=10,
            spaceAfter=5
        )

        h2_style = ParagraphStyle(
            'SectionH2',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#334155'),
            spaceBefore=6,
            spaceAfter=3
        )

        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#334155'),
            spaceAfter=5
        )

        bullet_style = ParagraphStyle(
            'Bullet',
            parent=body_style,
            leftIndent=12,
            spaceAfter=2.5
        )

        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#0f172a')
        )

        table_cell_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#334155')
        )

        score = data.get('conviction_score', 75)
        if isinstance(score, (int, float)):
            if score >= 70:
                score_color = '#10b981'
            elif score >= 40:
                score_color = '#f59e0b'
            else:
                score_color = '#ef4444'
        else:
            score_color = '#10b981'

        score_style = ParagraphStyle(
            'Score',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=colors.white,
            alignment=1
        )

        story = []
        ticker = data.get('ticker', 'ASSET')
        story.append(Paragraph(f"{report_title}", title_style))
        story.append(Paragraph(f"Autonomous Equity Research Dossier for {ticker} • Generated on {data.get('date', 'Today')}", subtitle_style))

        # Top Badge
        badge_cell = Paragraph(f"Analyst Conviction Score: {score}/100", score_style)
        badge_table = Table([[badge_cell]], colWidths=[240])
        badge_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(score_color)),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        badge_wrapper = Table([[badge_table]], colWidths=['100%'])
        badge_wrapper.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
        story.append(badge_wrapper)
        story.append(Spacer(1, 8))

        # Executive Summary
        exec_summary = data.get('executive_summary', [])
        if exec_summary:
            story.append(Paragraph("Executive Summary & Key Takeaways", h1_style))
            if isinstance(exec_summary, list):
                for b in exec_summary:
                    story.append(Paragraph(f"• {b}", bullet_style))
            else:
                story.append(Paragraph(str(exec_summary), body_style))
            story.append(Spacer(1, 6))

        # Recursive renderer helper for structured dicts / lists in PDF
        def render_element(val, current_depth=0):
            elements = []
            if val is None:
                return elements

            if isinstance(val, (str, int, float, bool)):
                elements.append(Paragraph(str(val), body_style))
                return elements

            if isinstance(val, list):
                for item in val:
                    if isinstance(item, (str, int, float, bool)):
                        elements.append(Paragraph(f"• {item}", bullet_style))
                    elif isinstance(item, dict):
                        elements.extend(render_element(item, current_depth + 1))
                return elements

            if isinstance(val, dict):
                # Check if it's a simple key-value table
                is_simple = all(isinstance(v, (str, int, float, bool)) or v is None for v in val.values())
                if is_simple and len(val) > 1 and current_depth > 0:
                    table_data = []
                    for k, v in val.items():
                        k_clean = k.replace('_', ' ').title()
                        table_data.append([
                            Paragraph(f"<b>{k_clean}</b>", table_header_style),
                            Paragraph(str(v) if v is not None else 'N/A', table_cell_style)
                        ])
                    t = Table(table_data, colWidths=[180, 320])
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
                        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                        ('TOPPADDING', (0,0), (-1,-1), 3),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                        ('LEFTPADDING', (0,0), (-1,-1), 6),
                        ('RIGHTPADDING', (0,0), (-1,-1), 6),
                    ]))
                    elements.append(Spacer(1, 2))
                    elements.append(t)
                    elements.append(Spacer(1, 4))
                    return elements

                # Nested sub-sections
                for k, v in val.items():
                    sub_title = k.replace('_', ' ').title()
                    elements.append(Paragraph(sub_title, h2_style if current_depth > 0 else h1_style))
                    elements.extend(render_element(v, current_depth + 1))
                return elements

            elements.append(Paragraph(str(val), body_style))
            return elements

        # Unpack report body if nested
        root_data = data.get('report', data)
        standard_keys = {'ticker', 'conviction_score', 'executive_summary', 'report_title', 'date', 'sections', 'scorecard'}

        # Render all sections
        for key, val in root_data.items():
            if key in standard_keys or val is None:
                continue

            sec_title = key.replace('_', ' ').title()
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#cbd5e1'), spaceBefore=8, spaceAfter=6))
            story.append(Paragraph(sec_title, h1_style))
            story.extend(render_element(val, current_depth=1))
            story.append(Spacer(1, 4))

        doc.build(story)
        print(f"Generated PDF with ReportLab successfully at: {output_path}")
        return output_path
    except Exception as e:
        print(f"ReportLab PDF generation error: {e}")
        fallback_path = output_path.replace('.pdf', '.txt')
        with open(fallback_path, 'w', encoding='utf-8') as f:
            f.write(f"=== {report_title} ===\n\n")
            for k, v in data.items():
                f.write(f"[{k}]\n{v}\n\n")
        return fallback_path
