import os
from jinja2 import Environment, FileSystemLoader

def generate_pdf(data: dict, output_filename: str):
    """
    Renders an HTML template with Jinja2 using provided LLM JSON data,
    and converts the HTML to a PDF using WeasyPrint or ReportLab fallback.
    """
    # Setup Jinja environment
    template_dir = os.path.join(os.path.dirname(__file__), 'templates')
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template('report.html')

    # Render HTML string
    html_out = template.render(**data)

    # Output paths
    output_path = os.path.join(os.path.dirname(__file__), output_filename)
    
    # 1. Try WeasyPrint
    try:
        from weasyprint import HTML
        HTML(string=html_out).write_pdf(output_path)
        print(f"Generated PDF with WeasyPrint successfully at: {output_path}")
        return output_path
    except Exception as e:
        print(f"WeasyPrint unavailable/failed ({e}), falling back to ReportLab...")

    # 2. Try ReportLab
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
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
        
        # Custom styles
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#1a365d'),
            alignment=1,
            spaceAfter=12
        )

        h1_style = ParagraphStyle(
            'SectionH1',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=19,
            textColor=colors.HexColor('#1a365d'),
            spaceBefore=10,
            spaceAfter=6
        )

        h3_style = ParagraphStyle(
            'SectionH3',
            parent=styles['Heading3'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#2b6cb0'),
            spaceBefore=8,
            spaceAfter=4
        )

        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#333333'),
            spaceAfter=6
        )

        bullet_style = ParagraphStyle(
            'Bullet',
            parent=body_style,
            leftIndent=15,
            spaceAfter=4
        )

        score = data.get('conviction_score', 50)
        if isinstance(score, (int, float)):
            if score >= 70:
                score_color = '#48bb78'
            elif score >= 40:
                score_color = '#ecc94b'
            else:
                score_color = '#f56565'
        else:
            score_color = '#48bb78'

        score_style = ParagraphStyle(
            'Score',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=18,
            textColor=colors.white,
            alignment=1
        )

        story = []

        ticker = data.get('ticker', 'ASSET')
        story.append(Paragraph(f"{ticker} Research Report", title_style))

        # Badge
        badge_cell = Paragraph(f"Conviction Score: {score}/100", score_style)
        badge_table = Table([[badge_cell]], colWidths=[240])
        badge_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(score_color)),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        badge_wrapper = Table([[badge_table]], colWidths=['100%'])
        badge_wrapper.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
        story.append(badge_wrapper)
        story.append(Spacer(1, 12))

        # Executive Summary
        story.append(Paragraph("Executive Summary", h3_style))
        exec_summary = data.get('executive_summary', [])
        if isinstance(exec_summary, list):
            for b in exec_summary:
                story.append(Paragraph(f"• {b}", bullet_style))
        else:
            story.append(Paragraph(str(exec_summary), body_style))
        story.append(Spacer(1, 8))

        # Price vs Macro
        story.append(Paragraph("Price vs Macro Context", h3_style))
        story.append(Paragraph(data.get('price_and_macro_context', 'N/A'), body_style))
        story.append(Spacer(1, 10))

        # Divider & Company Profile
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceBefore=5, spaceAfter=10))
        story.append(Paragraph("Company Fundamentals", h1_style))
        story.append(Paragraph("Deep Dive Profile", h3_style))
        story.append(Paragraph(data.get('company_profile', 'N/A'), body_style))
        story.append(Spacer(1, 8))

        # SEC Risks
        story.append(Paragraph("SEC Filing Risks & Red Flags", h3_style))
        story.append(Paragraph(data.get('sec_filing_risks', 'N/A'), body_style))
        story.append(Spacer(1, 8))

        # Recent News
        story.append(Paragraph("Recent News & Sentiment", h3_style))
        story.append(Paragraph(data.get('recent_news', 'N/A'), body_style))
        story.append(Spacer(1, 10))

        # Sector Breakdown
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceBefore=5, spaceAfter=10))
        story.append(Paragraph("Market Context", h1_style))
        story.append(Paragraph("Sector & Industry Breakdown", h3_style))
        story.append(Paragraph(data.get('sector_breakdown', 'N/A'), body_style))

        doc.build(story)
        print(f"Generated PDF with ReportLab successfully at: {output_path}")
        return output_path
    except Exception as e2:
        print(f"ReportLab failed ({e2}), falling back to HTML output...")

    # 3. HTML fallback
    html_path = output_path.replace('.pdf', '.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_out)
    return html_path
